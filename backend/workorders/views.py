from django.db import transaction
from django.db.models import Q, Sum, Max
from django.contrib.auth import get_user_model
from django.http import FileResponse
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from utils.reports import build_report
from .models import Despacho, LineaDespacho, Solicitante, ServiceOrder, ServiceOrderLog
from inventory.models import Item, ItemUnit, ItemLoan, StockMovement, EntradaProducto
from inventory.serializers import ItemListSerializer
from .serializers import (
    DespachoListSerializer,
    DespachoDetailSerializer,
    LineaDespachoSerializer,
    SolicitanteSerializer,
    SolicitanteSimpleSerializer,
    ServiceOrderSerializer,
)
from .permissions import IsAlmacenistaOrAdmin, IsAssignedTechnicianOrAdmin
from .services import DispatchService


User = get_user_model()


class SolicitanteViewSet(viewsets.ModelViewSet):
    """Personas/unidades que solicitan despachos.

    Lectura: cualquier usuario autenticado (para autocomplete).
    Escritura: solo admin/almacenista.
    """
    queryset = Solicitante.objects.select_related('unit').all()
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    pagination_class = None

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    def get_serializer_class(self):
        if self.action == 'list':
            return SolicitanteSimpleSerializer
        return SolicitanteSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        search = self.request.query_params.get('search')

        if is_active is not None:
            if is_active.lower() in ('true', '1'):
                queryset = queryset.filter(is_active=True)
            elif is_active.lower() in ('false', '0'):
                queryset = queryset.filter(is_active=False)
        else:
            queryset = queryset.filter(is_active=True)

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(rank__icontains=search) | Q(agent_id__icontains=search)
                | Q(unit__name__icontains=search)
            )

        return queryset.order_by('name')[:50]

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class DespachoViewSet(viewsets.ModelViewSet):
    """Despachos de almacén. Creación inmediata y atómica via DispatchService.

    Endpoints custom:
    - POST /work-orders/despachos/  → DispatchService.create()
    - GET  /work-orders/despachos/?solicitante=ID → filtrar por solicitante
    - POST /work-orders/despachos/{id}/cancel/ → revertir y anular
    """
    queryset = Despacho.objects.select_related(
        'solicitante', 'solicitante__unit', 'unit', 'delivered_by', 'cancelled_by',
    ).prefetch_related('lineas', 'lineas__item', 'lineas__item_unit').all()
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'solicitante', 'unit', 'delivered_by']

    def get_serializer_class(self):
        if self.action == 'list':
            return DespachoListSerializer
        return DespachoDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')

        if search:
            queryset = queryset.filter(
                Q(ot_number__icontains=search) |
                Q(solicitante__name__icontains=search) |
                Q(unit__name__icontains=search) |
                Q(equipment_reference__icontains=search)
            )
        if date_from:
            queryset = queryset.filter(issued_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(issued_at__date__lte=date_to)
        return queryset

    def create(self, request, *args, **kwargs):
        """Crea un Despacho + líneas + StockMovements/ItemLoans atómicamente.

        Payload:
        {
            "solicitante_id": int,
            "unit_id": int|null,
            "equipment_reference": str (opcional),
            "notes": str (opcional),
            "items": [
                {"item_id": int, "quantity": int, "item_unit_id": int|null, "notes": str},
                ...
            ]
        }
        """
        items_payload = request.data.get('items', [])
        if not items_payload:
            return Response(
                {'detail': 'Debe incluir al menos un item en el despacho.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            enforce_received_origin = str(request.data.get('require_received', 'false')).lower() in ('true', '1')
            despacho = DispatchService.create(
                user=request.user,
                solicitante_id=request.data.get('solicitante_id'),
                unit_id=request.data.get('unit_id'),
                equipment_reference=request.data.get('equipment_reference', ''),
                notes=request.data.get('notes', ''),
                items=items_payload,
                enforce_received_origin=enforce_received_origin,
            )
        except (ValueError, Item.DoesNotExist, ItemUnit.DoesNotExist) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(despacho)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='dispatchable-items')
    def dispatchable_items(self, request):
        """Lista de artículos despachables provenientes de recepción con stock disponible."""
        search = (request.query_params.get('search') or '').strip()

        received_totals = {
            row['base_product']: row['total']
            for row in EntradaProducto.objects.filter(base_product__isnull=False)
            .values('base_product')
            .annotate(total=Sum('cantidad'))
        }

        if not received_totals:
            return Response([])

        queryset = Item.objects.select_related('category', 'location', 'brand', 'product_model', 'state').filter(
            is_active=True,
            id__in=received_totals.keys(),
        )

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(sku__icontains=search)
                | Q(part_number__icontains=search)
                | Q(application__icontains=search)
            )

        items = [item for item in queryset if item.stock_available > 0]
        payload = ItemListSerializer(items, many=True).data

        for row in payload:
            row['received_quantity'] = int(received_totals.get(row['id'], 0) or 0)

        return Response(payload)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Anula un despacho y revierte los movimientos de stock y asignaciones."""
        despacho = self.get_object()
        if despacho.is_cancelled():
            return Response(
                {'detail': 'Este despacho ya está anulado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get('reason', '').strip()
        if not reason:
            return Response(
                {'detail': 'Debe indicar el motivo de la anulación.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            DispatchService.cancel(
                despacho=despacho,
                user=request.user,
                reason=reason,
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(despacho).data)

    @action(detail=False, methods=['get'])
    def report(self, request):
        format = request.query_params.get('type', 'pdf')
        if format not in ('pdf', 'excel'):
            return Response({'detail': 'Formato inválido. Use pdf o excel.'}, status=status.HTTP_400_BAD_REQUEST)

        despachos = self.get_queryset()
        headers = ['DV', 'Fecha', 'Solicitante', 'Unidad', 'Items', 'Entregado por', 'Estado']
        rows = [
            [
                d.ot_number,
                d.issued_at.strftime('%d/%m/%Y %H:%M'),
                d.solicitante.name,
                d.unit.name if d.unit else '—',
                d.lineas.count(),
                d.delivered_by.name,
                d.get_status_display(),
            ]
            for d in despachos
        ]

        buffer = build_report('Reporte de Despachos', headers, rows, format)
        content_type = 'application/pdf' if format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'pdf' if format == 'pdf' else 'xlsx'
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"despachos_{timezone.now().strftime('%Y%m%d_%H%M%S')}.{extension}",
            content_type=content_type,
        )

    @action(detail=False, methods=['get'], url_path='reception-dispatch-report')
    def reception_dispatch_report(self, request):
        format = request.query_params.get('type', 'pdf')
        if format not in ('pdf', 'excel'):
            return Response({'detail': 'Formato inválido. Use pdf o excel.'}, status=status.HTTP_400_BAD_REQUEST)

        date_from = request.query_params.get('from')
        date_to = request.query_params.get('to')

        received_qs = EntradaProducto.objects.filter(base_product__isnull=False)
        dispatch_qs = LineaDespacho.objects.filter(despacho__status=Despacho.Status.ISSUED)

        if date_from:
            received_qs = received_qs.filter(fecha_recepcion__date__gte=date_from)
            dispatch_qs = dispatch_qs.filter(despacho__issued_at__date__gte=date_from)
        if date_to:
            received_qs = received_qs.filter(fecha_recepcion__date__lte=date_to)
            dispatch_qs = dispatch_qs.filter(despacho__issued_at__date__lte=date_to)

        received_agg = {
            row['base_product']: {
                'total_received': int(row['total_received'] or 0),
                'last_reception': row['last_reception'],
            }
            for row in received_qs.values('base_product').annotate(
                total_received=Sum('cantidad'),
                last_reception=Max('fecha_recepcion'),
            )
        }
        dispatched_agg = {
            row['item']: {
                'total_dispatched': int(row['total_dispatched'] or 0),
                'last_dispatch': row['last_dispatch'],
            }
            for row in dispatch_qs.values('item').annotate(
                total_dispatched=Sum('quantity'),
                last_dispatch=Max('despacho__issued_at'),
            )
        }

        item_ids = set(received_agg.keys()) | set(dispatched_agg.keys())
        items = Item.objects.select_related('location').filter(id__in=item_ids).order_by('name')

        headers = [
            'Producto', 'Código', 'Ubicación',
            'Recibido', 'Despachado', 'Balance',
            'Stock actual', 'Última recepción', 'Último despacho',
        ]
        rows = []
        for item in items:
            rec = received_agg.get(item.id, {})
            dsp = dispatched_agg.get(item.id, {})
            total_received = rec.get('total_received', 0)
            total_dispatched = dsp.get('total_dispatched', 0)
            balance = total_received - total_dispatched
            last_reception = rec.get('last_reception')
            last_dispatch = dsp.get('last_dispatch')

            rows.append([
                item.name,
                item.code or item.sku or item.part_number or '—',
                item.location.get_breadcrumb() if item.location else '—',
                total_received,
                total_dispatched,
                balance,
                item.stock_available,
                last_reception.strftime('%d/%m/%Y %H:%M') if last_reception else '—',
                last_dispatch.strftime('%d/%m/%Y %H:%M') if last_dispatch else '—',
            ])

        metadata_lines = []
        if date_from:
            metadata_lines.append(f'Desde: {date_from}')
        if date_to:
            metadata_lines.append(f'Hasta: {date_to}')
        if not metadata_lines:
            metadata_lines.append('Rango: histórico completo')

        buffer = build_report('Reporte Recepción vs Despacho', headers, rows, format, metadata_lines=metadata_lines)
        content_type = 'application/pdf' if format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'pdf' if format == 'pdf' else 'xlsx'
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"recepcion_vs_despacho_{timezone.now().strftime('%Y%m%d_%H%M%S')}.{extension}",
            content_type=content_type,
        )

    @action(detail=True, methods=['get'])
    def receipt(self, request, pk=None):
        despacho = self.get_object()
        format = request.query_params.get('type', 'pdf')
        if format not in ('pdf', 'excel'):
            return Response({'detail': 'Formato inválido. Use pdf o excel.'}, status=status.HTTP_400_BAD_REQUEST)

        headers = ['DV', 'Artículo', 'Código', 'Serial', 'Cantidad', 'Solicitante', 'Fecha']
        rows = []
        for linea in despacho.lineas.all():
            rows.append([
                despacho.ot_number,
                linea.item.name,
                linea.item.code or '—',
                linea.item_unit.serial_number if linea.item_unit else '—',
                linea.quantity,
                despacho.solicitante.name,
                despacho.issued_at.strftime('%d/%m/%Y %H:%M'),
            ])

        buffer = build_report(
            f'Comprobante de Despacho {despacho.ot_number}',
            headers,
            rows,
            format,
            include_signatures=True,
        )
        content_type = 'application/pdf' if format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'pdf' if format == 'pdf' else 'xlsx'
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"comprobante_{despacho.ot_number}.{extension}",
            content_type=content_type,
        )


class ServiceOrderViewSet(viewsets.ModelViewSet):
    """Órdenes de servicio de reparación, instalación y mantenimiento."""

    queryset = ServiceOrder.objects.select_related(
        'equipment', 'assigned_technician', 'created_by', 'unit'
    ).prefetch_related('items', 'items__item', 'logs', 'logs__actor').all()
    serializer_class = ServiceOrderSerializer
    permission_classes = [permissions.IsAuthenticated, IsAssignedTechnicianOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['service_type', 'status', 'assigned_technician', 'equipment_condition', 'unit']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        search = self.request.query_params.get('search')

        if user.role == 'tecnico':
            queryset = queryset.filter(assigned_technician=user)

        if search:
            queryset = queryset.filter(
                Q(service_number__icontains=search)
                | Q(equipment_name_snapshot__icontains=search)
                | Q(equipment_brand_snapshot__icontains=search)
                | Q(equipment_model_snapshot__icontains=search)
                | Q(equipment_serial_number__icontains=search)
                | Q(items__item_name_snapshot__icontains=search)
                | Q(items__serial_number__icontains=search)
                | Q(items__description__icontains=search)
            )

        return queryset.distinct()

    def perform_create(self, serializer):
        if self.request.user.role not in ('admin', 'almacenista'):
            raise PermissionDenied('Solo administradores o almacenistas pueden crear órdenes de servicio.')
        service_order = serializer.save(created_by=self.request.user)
        ServiceOrderLog.objects.create(
            service_order=service_order,
            actor=self.request.user,
            event='created',
            to_status=service_order.status,
            note='Orden de servicio creada.',
        )

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        if request.user.role not in ('admin', 'almacenista'):
            return Response({'detail': 'Sin permisos para asignar técnicos.'}, status=status.HTTP_403_FORBIDDEN)

        service_order = self.get_object()
        technician_id = request.data.get('technician_id')
        if not technician_id:
            return Response({'detail': 'Debe indicar technician_id.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            technician = User.objects.get(pk=technician_id, role='tecnico', is_active=True)
        except User.DoesNotExist:
            return Response({'detail': 'Técnico no encontrado o inactivo.'}, status=status.HTTP_400_BAD_REQUEST)

        service_order.assigned_technician = technician
        service_order.save(update_fields=['assigned_technician', 'updated_at'])
        ServiceOrderLog.objects.create(
            service_order=service_order,
            actor=request.user,
            event='assigned',
            to_status=service_order.status,
            note=f'Técnico asignado: {technician.name}',
        )
        return Response(self.get_serializer(service_order).data)

    @action(detail=True, methods=['post'])
    def transition(self, request, pk=None):
        service_order = self.get_object()
        new_status = request.data.get('status')
        note = (request.data.get('note') or '').strip()

        allowed_statuses = {choice[0] for choice in ServiceOrder.Status.choices}
        if new_status not in allowed_statuses:
            return Response({'detail': 'Estado inválido.'}, status=status.HTTP_400_BAD_REQUEST)

        allowed_transitions = {
            ServiceOrder.Status.RECIBIDO: {ServiceOrder.Status.EN_DIAGNOSTICO, ServiceOrder.Status.CANCELADO},
            ServiceOrder.Status.EN_DIAGNOSTICO: {ServiceOrder.Status.EN_PROCESO, ServiceOrder.Status.PENDIENTE_REPUESTO, ServiceOrder.Status.CANCELADO},
            ServiceOrder.Status.PENDIENTE_REPUESTO: {ServiceOrder.Status.EN_PROCESO, ServiceOrder.Status.CANCELADO},
            ServiceOrder.Status.EN_PROCESO: {ServiceOrder.Status.COMPLETADO, ServiceOrder.Status.PENDIENTE_REPUESTO, ServiceOrder.Status.CANCELADO},
            ServiceOrder.Status.COMPLETADO: {ServiceOrder.Status.ENTREGADO, ServiceOrder.Status.CANCELADO},
            ServiceOrder.Status.ENTREGADO: set(),
            ServiceOrder.Status.CANCELADO: set(),
        }

        old_status = service_order.status
        if new_status == old_status:
            return Response({'detail': 'La orden ya está en ese estado.'}, status=status.HTTP_400_BAD_REQUEST)

        if new_status not in allowed_transitions.get(old_status, set()):
            return Response({'detail': 'Transición de estado no permitida.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            service_order.status = new_status
            if new_status == ServiceOrder.Status.COMPLETADO and not service_order.completed_at:
                service_order.completed_at = timezone.now()
            if new_status == ServiceOrder.Status.ENTREGADO and not service_order.delivered_at:
                service_order.delivered_at = timezone.now()
            service_order.save(update_fields=['status', 'completed_at', 'delivered_at', 'updated_at'])

            ServiceOrderLog.objects.create(
                service_order=service_order,
                actor=request.user,
                event='status_transition',
                from_status=old_status,
                to_status=new_status,
                note=note,
            )

        return Response(self.get_serializer(service_order).data)

    @action(detail=True, methods=['post'])
    def add_note(self, request, pk=None):
        service_order = self.get_object()
        note = (request.data.get('note') or '').strip()
        if not note:
            return Response({'detail': 'Debe escribir una nota.'}, status=status.HTTP_400_BAD_REQUEST)

        ServiceOrderLog.objects.create(
            service_order=service_order,
            actor=request.user,
            event='note',
            from_status=service_order.status,
            to_status=service_order.status,
            note=note,
        )
        return Response(self.get_serializer(service_order).data)

    @action(detail=True, methods=['post'])
    def complete_service(self, request, pk=None):
        service_order = self.get_object()
        diagnosis = (request.data.get('diagnosis') or '').strip()
        work_performed = (request.data.get('work_performed') or '').strip()
        close_note = (request.data.get('notes') or '').strip()

        if not diagnosis:
            return Response({'detail': 'Debe registrar el diagnóstico final.'}, status=status.HTTP_400_BAD_REQUEST)
        if not work_performed:
            return Response({'detail': 'Debe registrar el trabajo realizado.'}, status=status.HTTP_400_BAD_REQUEST)
        if service_order.status in (ServiceOrder.Status.ENTREGADO, ServiceOrder.Status.CANCELADO):
            return Response({'detail': 'La orden no puede completarse en su estado actual.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            previous_status = service_order.status
            service_order.diagnosis = diagnosis
            service_order.work_performed = work_performed
            if close_note:
                existing = (service_order.notes or '').strip()
                service_order.notes = f"{existing}\n\n[Cierre técnico]\n{close_note}".strip() if existing else f"[Cierre técnico]\n{close_note}"
            service_order.status = ServiceOrder.Status.COMPLETADO
            if not service_order.completed_at:
                service_order.completed_at = timezone.now()
            service_order.save(update_fields=['diagnosis', 'work_performed', 'notes', 'status', 'completed_at', 'updated_at'])

            ServiceOrderLog.objects.create(
                service_order=service_order,
                actor=request.user,
                event='completed',
                from_status=previous_status,
                to_status=ServiceOrder.Status.COMPLETADO,
                note='Cierre técnico completado.',
            )

        return Response(self.get_serializer(service_order).data)

    @action(detail=True, methods=['get'])
    def completion_receipt(self, request, pk=None):
        service_order = self.get_object()
        format = request.query_params.get('type', 'pdf')
        if format not in ('pdf', 'excel'):
            return Response({'detail': 'Formato inválido. Use pdf o excel.'}, status=status.HTTP_400_BAD_REQUEST)

        if service_order.status not in (ServiceOrder.Status.COMPLETADO, ServiceOrder.Status.ENTREGADO):
            return Response(
                {'detail': 'El comprobante de cierre solo está disponible para órdenes completadas o entregadas.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rows = []
        for line in service_order.items.select_related('item').all():
            rows.append([
                line.item_name_snapshot or line.item.name,
                line.serial_number or '—',
                line.description or '—',
                line.get_equipment_condition_display(),
            ])

        metadata_lines = [
            f"Orden: {service_order.service_number}",
            f"Tipo de servicio: {service_order.get_service_type_display()}",
            f"Estado: {service_order.get_status_display()}",
            f"Técnico asignado: {service_order.assigned_technician.name if service_order.assigned_technician else 'Sin asignar'}",
            f"Fecha de recepción: {service_order.received_at.strftime('%d/%m/%Y %H:%M')}",
            f"Fecha de cierre: {service_order.completed_at.strftime('%d/%m/%Y %H:%M') if service_order.completed_at else '—'}",
            f"Diagnóstico: {service_order.diagnosis or '—'}",
            f"Trabajo realizado: {service_order.work_performed or '—'}",
        ]

        recipient_name = ' '.join(
            p for p in [service_order.recipient_first_name, service_order.recipient_last_name] if p
        ).strip() or 'Sin especificar'
        recipient_meta = [
            f"Nombre/Apellido: {recipient_name}",
            f"Cédula: {service_order.recipient_id_card or '—'}",
            f"Rango/Cargo: {service_order.recipient_rank_position or '—'}",
        ]
        metadata_lines.extend(recipient_meta)

        buffer = build_report(
            f"Comprobante de Cierre {service_order.service_number}",
            ['Producto', 'Serial', 'Descripción', 'Estado'],
            rows,
            format,
            include_signatures=True,
            signature_names={
                'delivered_by': service_order.assigned_technician.name if service_order.assigned_technician else '',
                'received_by': recipient_name,
            },
            metadata_lines=metadata_lines,
        )

        content_type = 'application/pdf' if format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'pdf' if format == 'pdf' else 'xlsx'
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"cierre_{service_order.service_number}.{extension}",
            content_type=content_type,
        )
