from django.db import DatabaseError
from rest_framework import serializers
from django.contrib.auth import get_user_model
from utils.validators import normalize_dominican_cedula
from .models import (
    Despacho,
    LineaDespacho,
    Solicitante,
    ServiceOrder,
    ServiceOrderLog,
    ServiceOrderItem,
)

User = get_user_model()


class SolicitanteSerializer(serializers.ModelSerializer):
    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    unit_type = serializers.CharField(source='unit.get_location_type_display', read_only=True, default=None)
    full_name = serializers.CharField(read_only=True)
    despachos_count = serializers.SerializerMethodField()

    class Meta:
        model = Solicitante
        fields = [
            'id', 'name', 'rank', 'unit', 'unit_name', 'unit_type',
            'agent_id', 'notes', 'is_active', 'full_name',
            'despachos_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_despachos_count(self, obj):
        return obj.despachos.count()

    def validate_agent_id(self, value):
        return normalize_dominican_cedula(value) if value else ''


class SolicitanteSimpleSerializer(serializers.ModelSerializer):
    """Serializer para listados/autocomplete con campos clave de UI."""

    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Solicitante
        fields = [
            'id', 'name', 'rank', 'full_name',
            'unit', 'unit_name',
            'agent_id', 'notes', 'is_active',
        ]


class LineaDespachoSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_code = serializers.CharField(source='item.code', read_only=True)
    item_kind = serializers.CharField(source='item.kind', read_only=True)
    item_unit_serial = serializers.CharField(source='item_unit.serial_number', read_only=True, default=None)

    class Meta:
        model = LineaDespacho
        fields = [
            'id', 'despacho', 'item', 'item_name', 'item_code', 'item_kind',
            'item_unit', 'item_unit_serial',
            'quantity', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'despacho']


class DespachoListSerializer(serializers.ModelSerializer):
    solicitante_name = serializers.CharField(source='solicitante.name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    delivered_by_name = serializers.CharField(source='delivered_by.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lineas_count = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Despacho
        fields = [
            'id', 'ot_number', 'solicitante', 'solicitante_name',
            'unit', 'unit_name',
            'delivered_by', 'delivered_by_name',
            'status', 'status_display',
            'issued_at', 'cancelled_at',
            'equipment_reference', 'notes',
            'lineas_count', 'total_items',
        ]

    def get_lineas_count(self, obj):
        return obj.lineas.count()

    def get_total_items(self, obj):
        return sum(linea.quantity for linea in obj.lineas.all())


class DespachoDetailSerializer(serializers.ModelSerializer):
    solicitante_detail = SolicitanteSerializer(source='solicitante', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    delivered_by_name = serializers.CharField(source='delivered_by.name', read_only=True)
    cancelled_by_name = serializers.CharField(source='cancelled_by.name', read_only=True, default=None)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    lineas = LineaDespachoSerializer(many=True, read_only=True)
    lineas_count = serializers.SerializerMethodField()
    total_items = serializers.SerializerMethodField()

    class Meta:
        model = Despacho
        fields = [
            'id', 'ot_number',
            'solicitante', 'solicitante_detail',
            'unit', 'unit_name',
            'delivered_by', 'delivered_by_name',
            'status', 'status_display',
            'issued_at', 'cancelled_at', 'cancelled_by', 'cancelled_by_name', 'cancellation_reason',
            'equipment_reference', 'notes',
            'lineas', 'lineas_count', 'total_items',
        ]
        read_only_fields = [
            'id', 'ot_number', 'delivered_by', 'issued_at',
            'status', 'cancelled_at', 'cancelled_by', 'cancellation_reason',
        ]

    def get_lineas_count(self, obj):
        return obj.lineas.count()

    def get_total_items(self, obj):
        return sum(linea.quantity for linea in obj.lineas.all())


class DespachoCreateSerializer(serializers.ModelSerializer):
    """Serializer para creación de Despacho. No se usa directamente;
    la creación se hace via DispatchService.create() para atomicidad.
    """
    class Meta:
        model = Despacho
        fields = [
            'id', 'ot_number', 'solicitante', 'unit', 'equipment_reference', 'notes',
            'status', 'issued_at', 'delivered_by',
        ]
        read_only_fields = ['id', 'ot_number', 'status', 'issued_at', 'delivered_by']

    def validate(self, data):
        if not data.get('solicitante'):
            raise serializers.ValidationError({'solicitante': 'Requerido.'})
        return data


class ServiceOrderSerializer(serializers.ModelSerializer):
    service_type_display = serializers.CharField(source='get_service_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    equipment_name = serializers.CharField(source='equipment.name', read_only=True)
    assigned_technician_name = serializers.CharField(source='assigned_technician.name', read_only=True, default=None)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    unit_name = serializers.CharField(source='unit.name', read_only=True, default=None)
    logs = serializers.SerializerMethodField()
    history = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    grouped_items = serializers.SerializerMethodField()

    write_items = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        allow_empty=False,
    )

    def get_logs(self, obj):
        logs = obj.logs.select_related('actor').all()[:20]
        return [
            {
                'id': log.id,
                'event': log.event,
                'from_status': log.from_status,
                'to_status': log.to_status,
                'actor_id': log.actor_id,
                'actor_name': log.actor.name if log.actor else 'Sistema',
                'note': log.note,
                'created_at': log.created_at,
            }
            for log in logs
        ]

    def get_history(self, obj):
        try:
            repair_records = list(
                obj.equipment.repair_records.select_related('technician').filter(is_active=True)
            )
        except DatabaseError:
            repair_records = []

        try:
            installation_records = list(
                obj.equipment.installation_records.select_related('technician', 'location').filter(is_active=True)
            )
        except DatabaseError:
            installation_records = []

        service_orders = obj.equipment.service_orders.select_related('assigned_technician').exclude(pk=obj.pk)

        entries = []
        for repair in repair_records:
            entries.append({
                'type': 'reparacion',
                'title': 'Reparación',
                'date': repair.repaired_at,
                'technician': repair.technician.name,
                'details': repair.details,
                'item': repair.item.name,
                'serial': repair.item.numero_serie or None,
                'attachment': repair.attachment.url if repair.attachment else None,
            })
        for installation in installation_records:
            entries.append({
                'type': 'instalacion',
                'title': 'Instalación',
                'date': installation.installed_at,
                'technician': installation.technician.name,
                'details': installation.notes,
                'location': installation.location.name,
                'item': installation.item.name,
                'serial': installation.serial_number or installation.item.numero_serie or None,
                'state_snapshot': installation.state_snapshot or None,
            })
        for service_order in service_orders:
            entries.append({
                'type': 'orden_servicio',
                'title': service_order.get_service_type_display(),
                'date': service_order.received_at,
                'technician': service_order.assigned_technician.name if service_order.assigned_technician else None,
                'details': service_order.diagnosis or service_order.work_performed or service_order.notes,
                'status': service_order.get_status_display(),
                'serial': service_order.equipment_serial_number,
                'service_number': service_order.service_number,
                'diagnosis': service_order.diagnosis,
                'work_performed': service_order.work_performed,
                'received_at': service_order.received_at,
                'completed_at': service_order.completed_at,
                'delivered_at': service_order.delivered_at,
            })

        entries.sort(key=lambda entry: entry['date'], reverse=True)
        return entries[:30]

    def get_items(self, obj):
        return [
            {
                'id': line.id,
                'item': line.item_id,
                'item_name': line.item_name_snapshot or line.item.name,
                'item_brand': line.item_brand_snapshot,
                'item_model': line.item_model_snapshot,
                'serial_number': line.serial_number,
                'description': line.description,
                'equipment_condition': line.equipment_condition,
                'equipment_condition_display': line.get_equipment_condition_display(),
            }
            for line in obj.items.select_related('item').all()
        ]

    def get_grouped_items(self, obj):
        grouped = {}
        for line in obj.items.select_related('item').all():
            key = (
                line.item_name_snapshot or line.item.name,
                line.serial_number,
                (line.description or '').strip(),
                line.equipment_condition,
            )
            if key not in grouped:
                grouped[key] = {
                    'product': key[0],
                    'serial': key[1],
                    'description': key[2],
                    'state': key[3],
                    'state_display': line.get_equipment_condition_display(),
                    'count': 0,
                }
            grouped[key]['count'] += 1
        return list(grouped.values())

    class Meta:
        model = ServiceOrder
        fields = [
            'id', 'service_number', 'service_type', 'service_type_display',
            'equipment', 'equipment_name', 'equipment_condition',
            'equipment_serial_number',
            'equipment_name_snapshot', 'equipment_brand_snapshot',
            'equipment_model_snapshot', 'equipment_description_snapshot',
            'assigned_technician', 'assigned_technician_name',
            'created_by', 'created_by_name',
            'unit', 'unit_name',
            'recipient_first_name', 'recipient_last_name',
            'recipient_id_card', 'recipient_rank_position',
            'status', 'status_display',
            'diagnosis', 'work_performed', 'notes',
            'items', 'grouped_items', 'write_items',
            'logs',
            'history',
            'received_at', 'completed_at', 'delivered_at',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'service_number',
            'equipment_name_snapshot', 'equipment_brand_snapshot',
            'equipment_model_snapshot', 'equipment_description_snapshot',
            'created_by', 'received_at', 'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'equipment': {'required': False},
            'equipment_serial_number': {'required': False},
        }

    def validate_assigned_technician(self, value):
        if value and value.role != 'tecnico':
            raise serializers.ValidationError('Solo se puede asignar un usuario con rol técnico.')
        return value

    def validate_recipient_id_card(self, value):
        return normalize_dominican_cedula(value) if value else ''

    def validate_equipment(self, value):
        if not value.is_base_product:
            raise serializers.ValidationError('La orden de servicio solo puede usar productos base registrados.')
        if not value.is_active:
            raise serializers.ValidationError('El producto base seleccionado está inactivo.')
        return value

    def validate(self, data):
        items = self.initial_data.get('write_items')
        if items:
            normalized = []
            seen_keys = set()
            for idx, raw in enumerate(items, start=1):
                item_id = raw.get('item')
                serial = (raw.get('serial_number') or '').strip()
                condition = raw.get('equipment_condition') or ServiceOrder.EquipmentCondition.USADO
                description = (raw.get('description') or '').strip()

                if not item_id:
                    raise serializers.ValidationError({'write_items': f'Línea {idx}: item es obligatorio.'})
                if condition not in {choice[0] for choice in ServiceOrder.EquipmentCondition.choices}:
                    raise serializers.ValidationError({'write_items': f'Línea {idx}: equipment_condition inválido.'})

                try:
                    item = self.fields['equipment'].queryset.get(pk=item_id)
                except Exception:
                    raise serializers.ValidationError({'write_items': f'Línea {idx}: item no válido.'})

                self.validate_equipment(item)
                duplicate_key = (item.id, serial.lower() if serial else '')
                if duplicate_key in seen_keys:
                    raise serializers.ValidationError({
                        'write_items': f'Línea {idx}: no se permite repetir el mismo producto y serial en la orden.'
                    })
                seen_keys.add(duplicate_key)

                normalized.append({
                    'item': item,
                    'serial_number': serial,
                    'equipment_condition': condition,
                    'description': description,
                })

            if not normalized:
                raise serializers.ValidationError({'write_items': 'Debe incluir al menos un producto.'})

            data['__normalized_items__'] = normalized
            first = normalized[0]
            data['equipment'] = first['item']
            data['equipment_serial_number'] = first['serial_number']
            data['equipment_condition'] = first['equipment_condition']
            return data

        data['equipment_serial_number'] = (data.get('equipment_serial_number') or '').strip()
        return data

    def create(self, validated_data):
        normalized_items = validated_data.pop('__normalized_items__', None)
        validated_data.pop('write_items', None)
        service_order = super().create(validated_data)

        if normalized_items:
            ServiceOrderItem.objects.bulk_create([
                ServiceOrderItem(
                    service_order=service_order,
                    item=line['item'],
                    serial_number=line['serial_number'],
                    description=line['description'],
                    equipment_condition=line['equipment_condition'],
                )
                for line in normalized_items
            ])
        else:
            ServiceOrderItem.objects.create(
                service_order=service_order,
                item=service_order.equipment,
                serial_number=service_order.equipment_serial_number,
                description=service_order.equipment_description_snapshot,
                equipment_condition=service_order.equipment_condition,
            )

        return service_order
