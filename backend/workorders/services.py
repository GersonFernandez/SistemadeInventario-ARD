"""Servicio de creación y cancelación de Despachos de almacén.

Garantiza atomicidad mediante transaction.atomic() + select_for_update().
"""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from inventory.models import Item, ItemUnit, ItemLoan, StockMovement, EntradaProducto
from .models import Despacho, LineaDespacho


class DispatchService:
    """Lógica de negocio para despachar y anular despachos."""

    @staticmethod
    @transaction.atomic
    def create(*, user, solicitante_id, unit_id, equipment_reference, notes, items, enforce_received_origin=False):
        """Crea un Despacho, sus líneas, y ejecuta los movimientos de stock atómicamente.

        Para cada línea:
        - Si es un consumible (no track_by_serial): descuenta item.quantity, crea StockMovement.EXIT
        - Si es una herramienta (track_by_serial=True): asigna la ItemUnit (status='asignado'),
          crea ItemLoan vinculado al solicitante, NO descuenta quantity.

        Args:
            user: Usuario del taller que entrega.
            solicitante_id: int (FK a Solicitante)
            unit_id: int|null (FK a Location, opcional)
            equipment_reference: str (opcional)
            notes: str (opcional)
            items: lista de dicts {item_id, quantity, item_unit_id|null, notes}

        Returns:
            Despacho creado.

        Raises:
            ValidationError: si hay stock insuficiente, item inactivo, o unidad no disponible.
        """
        from workorders.models import Solicitante
        from inventory.models import Location

        if not solicitante_id:
            raise ValidationError('Debe especificar un solicitante.')
        if not items:
            raise ValidationError('Debe incluir al menos un item en el despacho.')

        try:
            solicitante = Solicitante.objects.get(pk=solicitante_id, is_active=True)
        except Solicitante.DoesNotExist:
            raise ValidationError(f'Solicitante {solicitante_id} no existe o está inactivo.')

        unit = None
        if unit_id:
            try:
                unit = Location.objects.get(pk=unit_id)
            except Location.DoesNotExist:
                raise ValidationError(f'Unidad {unit_id} no existe.')

        item_ids = [it['item_id'] for it in items]
        items_locked = {it.pk: it for it in Item.objects.select_for_update().filter(pk__in=item_ids)}

        for line in items:
            item_id = line.get('item_id')
            if item_id not in items_locked:
                raise ValidationError(f'Item {item_id} no existe.')
            item = items_locked[item_id]
            if not item.is_active:
                raise ValidationError(f'El item {item.name} está inactivo y no puede despacharse.')
            if enforce_received_origin and not EntradaProducto.objects.filter(base_product_id=item.id).exists():
                raise ValidationError(
                    f'El item {item.name} no proviene de recepción de mercancías y no puede despacharse desde este módulo.'
                )

            quantity = int(line.get('quantity', 0))
            if quantity < 1:
                raise ValidationError(f'La cantidad para {item.name} debe ser >= 1.')

            item_unit_id = line.get('item_unit_id')
            if item.track_by_serial:
                if not item_unit_id:
                    raise ValidationError(
                        f'Para herramientas serializadas como {item.name}, debe seleccionar la unidad específica.'
                    )
                if quantity != 1:
                    raise ValidationError(
                        f'Para herramientas como {item.name}, solo se despacha 1 unidad por línea.'
                    )
                try:
                    unit_obj = ItemUnit.objects.select_for_update().get(pk=item_unit_id, item=item)
                except ItemUnit.DoesNotExist:
                    raise ValidationError(f'Unidad {item_unit_id} no existe para {item.name}.')
                if unit_obj.status != ItemUnit.Status.AVAILABLE:
                    raise ValidationError(
                        f'La unidad {unit_obj.serial_number} de {item.name} no está disponible (estado: {unit_obj.get_status_display()}).'
                    )
            else:
                if item_unit_id:
                    raise ValidationError(
                        f'{item.name} no requiere selección de unidad individual.'
                    )
                if item.quantity < quantity:
                    raise ValidationError(
                        f'Stock insuficiente para {item.name}. Disponible: {item.quantity}, solicitado: {quantity}.'
                    )

        despacho = Despacho.objects.create(
            solicitante=solicitante,
            unit=unit,
            delivered_by=user,
            equipment_reference=equipment_reference or '',
            notes=notes or '',
        )

        for line in items:
            item = items_locked[line['item_id']]
            quantity = int(line['quantity'])
            item_unit_id = line.get('item_unit_id')
            line_notes = line.get('notes', '')

            linea = LineaDespacho.objects.create(
                despacho=despacho,
                item=item,
                item_unit_id=item_unit_id,
                quantity=quantity,
                notes=line_notes,
            )

            if item.track_by_serial and item_unit_id:
                unit_obj = ItemUnit.objects.select_for_update().get(pk=item_unit_id)
                expected_return_at = timezone.now() + timezone.timedelta(days=30)
                ItemLoan.objects.create(
                    item_unit=unit_obj,
                    loaned_to=solicitante,
                    loaned_by=user,
                    expected_return_at=expected_return_at,
                    notes=f'Asignado en despacho {despacho.ot_number}',
                )
            else:
                item.quantity -= quantity
                item.save(update_fields=['quantity', 'updated_at'])
                StockMovement.objects.create(
                    item=item,
                    movement_type=StockMovement.MovementType.EXIT,
                    quantity=quantity,
                    document_type=StockMovement.DocumentType.DIRECTO,
                    document_number=despacho.ot_number,
                    notes=f'Despacho {despacho.ot_number} a {solicitante.name}',
                )

        return despacho

    @staticmethod
    @transaction.atomic
    def cancel(*, despacho, user, reason):
        """Anula un despacho y revierte los movimientos de stock y asignaciones.

        Para cada línea:
        - Si era consumible: crea StockMovement.ENTRY inverso, suma item.quantity
        - Si era herramienta: marca ItemLoan.returned_at, libera la ItemUnit
        """
        if despacho.is_cancelled():
            raise ValidationError('Este despacho ya está anulado.')

        for linea in despacho.lineas.select_for_update().all():
            if linea.item_unit_id:
                try:
                    loan = ItemLoan.objects.select_for_update().get(
                        item_unit_id=linea.item_unit_id, returned_at__isnull=True
                    )
                except ItemLoan.DoesNotExist:
                    loan = None
                if loan:
                    loan.returned_at = timezone.now()
                    loan.returned_to = user
                    loan.notes = (loan.notes + '\n' if loan.notes else '') + \
                        f'Devuelto por anulación de despacho {despacho.ot_number}'
                    loan.save()
                unit_obj = ItemUnit.objects.select_for_update().get(pk=linea.item_unit_id)
                if unit_obj.status == ItemUnit.Status.ASIGNADO:
                    unit_obj.return_to_stock()
            else:
                item = Item.objects.select_for_update().get(pk=linea.item_id)
                item.quantity += linea.quantity
                item.save(update_fields=['quantity', 'updated_at'])
                StockMovement.objects.create(
                    item=item,
                    movement_type=StockMovement.MovementType.ENTRY,
                    quantity=linea.quantity,
                    document_type=StockMovement.DocumentType.DIRECTO,
                    document_number=f"ANUL-{despacho.ot_number}",
                    notes=f'Anulación de despacho {despacho.ot_number}. Motivo: {reason}',
                )

        despacho.status = Despacho.Status.CANCELLED
        despacho.cancelled_at = timezone.now()
        despacho.cancelled_by = user
        despacho.cancellation_reason = reason
        despacho.save()
