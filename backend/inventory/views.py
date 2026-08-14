from django.db import IntegrityError, transaction
from django.db.models import Q, Max
from django.http import FileResponse
from django.utils import timezone
from datetime import datetime
import json
import uuid
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend, FilterSet, NumberFilter
from django_filters import rest_framework as django_filters
from utils.reports import build_report
from .models import (
    Category,
    Brand,
    ProductModel,
    ProductState,
    UnitMeasure,
    Location,
    LocationType,
    Item,
    StockMovement,
    Transfer,
    ItemUnit,
    ItemLoan,
    RepairRecord,
    InstallationRecord,
    EntradaProducto,
    EntradaProductoAttachment,
)
from .serializers import (
    CategorySerializer,
    BrandSerializer,
    ProductModelSerializer,
    ProductStateSerializer,
    UnitMeasureSerializer,
    LocationSerializer,
    LocationTypeSerializer,
    LocationTypeSimpleSerializer,
    ItemListSerializer,
    ItemDetailSerializer,
    StockMovementSerializer,
    TransferSerializer,
    ItemUnitSerializer,
    ItemUnitCreateSerializer,
    ItemLoanSerializer,
    RepairRecordSerializer,
    InstallationRecordSerializer,
    InstallationBatchCreateSerializer,
    EntradaProductoSerializer,
    EntradaProductoAttachmentSerializer,
    EntradaProductoBatchCreateSerializer,
)
from .permissions import IsAlmacenistaOrAdmin, IsAdminAlmacenistaOrTecnico
from accounts.permissions import require_permission
from audit.models import AuditLog


class ItemFilter(FilterSet):
    category = NumberFilter(field_name='category__id')
    location = NumberFilter(field_name='location__id')
    kind = django_filters.CharFilter(field_name='kind')
    is_base_product = django_filters.BooleanFilter(field_name='is_base_product')

    class Meta:
        model = Item
        fields = ['category', 'is_active', 'location', 'kind', 'track_by_serial', 'is_base_product']


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'catalogs.view'
    manage_permission_key = 'catalogs.manage'


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'catalogs.view'
    manage_permission_key = 'catalogs.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active']

    def get_queryset(self):
        queryset = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is None:
            return queryset.order_by('-is_active', 'name')
        return queryset.order_by('-is_active', 'name')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class ProductModelViewSet(viewsets.ModelViewSet):
    queryset = ProductModel.objects.select_related('brand').all()
    serializer_class = ProductModelSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'catalogs.view'
    manage_permission_key = 'catalogs.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active', 'brand']

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by('-is_active', 'name')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class ProductStateViewSet(viewsets.ModelViewSet):
    queryset = ProductState.objects.all()
    serializer_class = ProductStateSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'catalogs.view'
    manage_permission_key = 'catalogs.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active']

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by('-is_active', 'name')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class UnitMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitMeasure.objects.all()
    serializer_class = UnitMeasureSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'catalogs.view'
    manage_permission_key = 'catalogs.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active']

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by('-is_active', 'name')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class LocationTypeViewSet(viewsets.ModelViewSet):
    """CRUD de tipos de ubicación. Lectura abierta, escritura solo admin/almacenista."""
    queryset = LocationType.objects.all()
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'locations.view'
    manage_permission_key = 'locations.manage'
    pagination_class = None

    def get_serializer_class(self):
        if self.action == 'list':
            return LocationTypeSimpleSerializer
        return LocationTypeSerializer

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
                Q(code__icontains=search) | Q(name__icontains=search)
            )

        return queryset.order_by('name')

    def perform_destroy(self, instance):
        if instance.locations.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                f'No se puede eliminar el tipo "{instance.name}" porque tiene {instance.locations.count()} ubicación(es) asociada(s).'
            )
        instance.delete()


class LocationViewSet(viewsets.ModelViewSet):
    queryset = Location.objects.select_related('location_type', 'parent').all()
    serializer_class = LocationSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'locations.view'
    manage_permission_key = 'locations.manage'
    filter_backends = [DjangoFilterBackend, SearchFilter]
    search_fields = ['name', 'codigo', 'location_type__name']

    def get_queryset(self):
        queryset = super().get_queryset()
        location_type = self.request.query_params.get('location_type')
        parent = self.request.query_params.get('parent')

        if location_type:
            queryset = queryset.filter(location_type_id=location_type)
        if parent is not None:
            if parent == '' or parent == 'null':
                queryset = queryset.filter(parent__isnull=True)
            else:
                queryset = queryset.filter(parent_id=parent)

        return queryset

    def perform_destroy(self, instance):
        if instance.items.exists():
            from rest_framework.exceptions import ValidationError
            raise ValidationError(
                'No se puede eliminar la ubicación porque tiene artículos asociados.'
            )
        instance.delete()


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('category', 'location', 'brand', 'product_model', 'state').all()
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'products.view'
    manage_permission_key = 'products.manage'
    permission_map_by_action = {
        'critical': 'inventory.view',
        'report': 'reports.export',
        'add_unit': 'products.manage',
    }
    filter_backends = [DjangoFilterBackend]
    filterset_class = ItemFilter

    def get_serializer_class(self):
        if self.action == 'list':
            return ItemListSerializer
        return ItemDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        kind = self.request.query_params.get('kind')
        for_reception = self.request.query_params.get('for_reception')

        if for_reception is not None and for_reception.lower() in ('true', '1'):
            queryset = queryset.filter(
                is_base_product=True,
                brand__isnull=False,
                product_model__isnull=False,
                category__isnull=False,
            )

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(sku__icontains=search)
                | Q(part_number__icontains=search)
                | Q(application__icontains=search)
            )

        if kind:
            queryset = queryset.filter(kind=kind)

        return queryset

    def filter_queryset(self, queryset):
        queryset = super().filter_queryset(queryset)
        critical = self.request.query_params.get('critical')

        if critical is None:
            return queryset

        if critical.lower() in ('true', '1'):
            return [item for item in queryset if item.is_critical]
        if critical.lower() in ('false', '0'):
            return [item for item in queryset if not item.is_critical]
        return queryset

    def perform_create(self, serializer):
        category = serializer.validated_data.get('category')
        for _ in range(3):
            code = self._generate_code(category)
            try:
                with transaction.atomic():
                    serializer.save(code=code)
                return
            except IntegrityError as exc:
                if 'inventory_item_code_key' not in str(exc):
                    raise

        from rest_framework.exceptions import ValidationError
        raise ValidationError({
            'detail': 'No se pudo generar un código único para el artículo. Intente nuevamente.'
        })

    def _generate_code(self, category):
        abbreviation = category.abbreviation.upper()
        prefix = f"{abbreviation}-"
        existing_codes = Item.objects.filter(code__startswith=prefix).values_list('code', flat=True)
        max_suffix = 0

        for code in existing_codes:
            try:
                suffix = int(str(code).split('-')[-1])
            except (TypeError, ValueError):
                continue
            max_suffix = max(max_suffix, suffix)

        new_num = max_suffix + 1
        return f"{abbreviation}-{new_num:03d}"

    @action(detail=False, methods=['get'])
    def report(self, request):
        require_permission(request.user, 'reports.export', 'No tiene permisos para generar reportes.')

        format = request.query_params.get('type', 'pdf')
        if format not in ('pdf', 'excel'):
            return Response({'detail': 'Formato inválido. Use pdf o excel.'}, status=status.HTTP_400_BAD_REQUEST)

        only_critical = request.query_params.get('critical', 'false').lower() == 'true'
        only_herramientas = request.query_params.get('kind', '').lower() == 'herramienta'

        # Reutiliza exactamente los mismos filtros del listado
        # (search, category, location, kind, is_active, critical, etc.).
        items = list(self.filter_queryset(self.get_queryset()))

        headers = ['Código', 'Nombre', 'SKU', 'Categoría', 'Ubicación', 'Stock', 'Mínimo', 'Unidad', 'Estado']
        rows = [
            [
                item.code or '—',
                item.name,
                item.sku or '—',
                item.category.name,
                item.location.get_breadcrumb() if item.location else '—',
                item.stock_available,
                item.minimum_stock,
                item.unit,
                'Activo' if item.is_active else 'Inactivo',
            ]
            for item in items
        ]

        if only_critical:
            title = 'Reporte de Stock Crítico'
        elif only_herramientas:
            title = 'Reporte de Herramientas / Instrumentos'
        else:
            title = 'Reporte de Inventario'

        buffer = build_report(title, headers, rows, format)
        content_type = 'application/pdf' if format == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'pdf' if format == 'pdf' else 'xlsx'
        suffix = 'critico' if only_critical else ('herramientas' if only_herramientas else 'completo')
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"inventario_{suffix}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{extension}",
            content_type=content_type,
        )

    @action(detail=False, methods=['get'])
    def critical(self, request):
        queryset = self.filter_queryset(self.get_queryset())

        # Para coincidir con Inventario por defecto, solo activos cuando
        # no se especifica explícitamente is_active.
        if 'is_active' not in request.query_params:
            queryset = queryset.filter(is_active=True)

        items = [item for item in queryset if item.is_critical]
        page = self.paginate_queryset(items)
        if page is not None:
            serializer = ItemListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ItemListSerializer(items, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_unit(self, request, pk=None):
        """Agrega una unidad física (serial) a un item con track_by_serial=True."""
        item = self.get_object()
        if not item.track_by_serial:
            return Response(
                {'detail': 'Este item no está configurado para rastrear por serial. Active track_by_serial primero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serial_number = request.data.get('serial_number', '').strip()
        if not serial_number:
            return Response(
                {'serial_number': 'Requerido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if ItemUnit.objects.filter(item=item, serial_number=serial_number).exists():
            return Response(
                {'serial_number': f'Ya existe una unidad con este serial para {item.name}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        unit = ItemUnit.objects.create(item=item, serial_number=serial_number)
        return Response(ItemUnitSerializer(unit).data, status=status.HTTP_201_CREATED)


class StockMovementViewSet(viewsets.ModelViewSet):
    queryset = StockMovement.objects.select_related('item').all()
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'inventory.view'
    manage_permission_key = 'inventory.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['item', 'movement_type', 'document_type']

    def get_queryset(self):
        queryset = super().get_queryset()
        item_id = self.request.query_params.get('item')
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        return queryset

    def perform_create(self, serializer):
        with transaction.atomic():
            item = Item.objects.select_for_update().get(pk=serializer.validated_data['item'].pk)
            movement = serializer.save()

            if movement.movement_type == StockMovement.MovementType.ENTRY:
                item.quantity += movement.quantity
            elif movement.movement_type == StockMovement.MovementType.EXIT:
                if item.quantity < movement.quantity:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError('Stock insuficiente para registrar la salida.')
                item.quantity -= movement.quantity

            item.save(update_fields=['quantity'])


class TransferFilter(FilterSet):
    item = NumberFilter(field_name='item__id')
    origin_location = NumberFilter(field_name='origin_location__id')
    destination_location = NumberFilter(field_name='destination_location__id')
    requested_by = NumberFilter(field_name='requested_by__id')
    approved_by = NumberFilter(field_name='approved_by__id')

    class Meta:
        model = Transfer
        fields = ['item', 'origin_location', 'destination_location', 'status',
                  'requested_by', 'approved_by']


class TransferViewSet(viewsets.ModelViewSet):
    queryset = Transfer.objects.select_related(
        'item', 'origin_location', 'destination_location',
        'requested_by', 'approved_by',
    ).all()
    serializer_class = TransferSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'inventory.view'
    manage_permission_key = 'inventory.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_class = TransferFilter

    def get_queryset(self):
        queryset = super().get_queryset()
        item_id = self.request.query_params.get('item')
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        transfer = self.get_object()
        if transfer.status != Transfer.Status.PENDIENTE:
            return Response(
                {'detail': 'Solo se pueden aprobar traslados pendientes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        require_permission(request.user, 'inventory.manage', 'No tiene permisos para aprobar traslados.')
        with transaction.atomic():
            item = Item.objects.select_for_update().get(pk=transfer.item.pk)
            transfer.status = Transfer.Status.COMPLETADA
            transfer.approved_by = request.user
            transfer.completed_at = timezone.now()
            item.location = transfer.destination_location
            item.save(update_fields=['location'])
            transfer.save()
        return Response(self.get_serializer(transfer).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        transfer = self.get_object()
        if transfer.status != Transfer.Status.PENDIENTE:
            return Response(
                {'detail': 'Solo se pueden rechazar traslados pendientes.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        require_permission(request.user, 'inventory.manage', 'No tiene permisos para rechazar traslados.')
        transfer.status = Transfer.Status.RECHAZADA
        transfer.approved_by = request.user
        transfer.completed_at = timezone.now()
        transfer.notes = (transfer.notes + '\n' if transfer.notes else '') + \
            f"Rechazado por {request.user.name}"
        transfer.save()


class ItemUnitFilter(FilterSet):
    item = NumberFilter(field_name='item__id')
    status = django_filters.CharFilter(field_name='status')

    class Meta:
        model = ItemUnit
        fields = ['item', 'status']


class ItemUnitViewSet(viewsets.ModelViewSet):
    """Unidades físicas (con serial) de items con track_by_serial=True (típicamente herramientas)."""
    queryset = ItemUnit.objects.select_related('item').all()
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'inventory.view'
    manage_permission_key = 'inventory.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_class = ItemUnitFilter

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ItemUnitCreateSerializer
        return ItemUnitSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        overdue = self.request.query_params.get('overdue')
        if overdue == 'true':
            queryset = queryset.filter(status=ItemUnit.Status.ASIGNADO, loans__returned_at__isnull=True).distinct()
        return queryset

    def perform_destroy(self, instance):
        if instance.status == ItemUnit.Status.ASIGNADO:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('No se puede eliminar una unidad actualmente prestada. Devuélvala primero.')
        if instance.status != ItemUnit.Status.DISPOSED:
            from rest_framework.exceptions import ValidationError
            raise ValidationError('Solo se pueden eliminar unidades dadas de baja.')
        instance.delete()

    @action(detail=True, methods=['post'])
    def set_status(self, request, pk=None):
        """Cambia el estado de una unidad manualmente (Disponible / En Reparación / Descargado)."""
        unit = self.get_object()
        new_status = request.data.get('status')
        reason = request.data.get('reason', '').strip()

        valid = {ItemUnit.Status.AVAILABLE, ItemUnit.Status.MAINTENANCE, ItemUnit.Status.DISPOSED}
        if new_status not in valid:
            return Response(
                {'detail': f'Estado inválido. Use uno de: {sorted(valid)}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if unit.status == ItemUnit.Status.ASIGNADO:
            return Response(
                {'detail': 'No se puede cambiar el estado de una unidad actualmente asignada. Devuélvala primero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            if new_status == ItemUnit.Status.DISPOSED:
                unit.status = ItemUnit.Status.DISPOSED
                unit.disposed_at = timezone.now()
                unit.disposal_reason = reason
                unit.save()
            elif new_status == ItemUnit.Status.MAINTENANCE:
                unit.status = ItemUnit.Status.MAINTENANCE
                unit.save()
            else:
                unit.status = ItemUnit.Status.AVAILABLE
                unit.save()

        return Response(ItemUnitSerializer(unit).data)

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Recibe la devolución de una unidad prestada.

        Cierra el ItemLoan activo, marca returned_at, libera la unidad
        y opcionalmente cambia su estado final.

        Body:
        {
            "final_status": "available" | "maintenance" | "disposed" (default: available),
            "notes": "Motivo si va a maintenance/disposed"
        }
        """
        from datetime import timedelta

        unit = self.get_object()
        if unit.status != ItemUnit.Status.ASIGNADO:
            return Response(
                {'detail': 'La unidad no está asignada, no hay nada que recibir.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            loan = ItemLoan.objects.select_for_update().get(
                item_unit=unit, returned_at__isnull=True
            )
        except ItemLoan.DoesNotExist:
            return Response(
                {'detail': 'No hay préstamo activo para esta unidad.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        final_status = request.data.get('final_status', ItemUnit.Status.AVAILABLE)
        if final_status not in (ItemUnit.Status.AVAILABLE, ItemUnit.Status.MAINTENANCE, ItemUnit.Status.DISPOSED):
            return Response(
                {'detail': f'Estado final inválido. Use uno de: available, maintenance, disposed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        notes = (request.data.get('notes') or '').strip()

        with transaction.atomic():
            loan.returned_at = timezone.now()
            loan.returned_to = request.user
            if notes:
                prefix = loan.notes + '\n' if loan.notes else ''
                loan.notes = f"{prefix}Devolución: {notes}"
            loan.save()

            if final_status == ItemUnit.Status.AVAILABLE:
                unit.return_to_stock()
            elif final_status == ItemUnit.Status.MAINTENANCE:
                unit.status = ItemUnit.Status.MAINTENANCE
                unit.save()
            else:
                unit.status = ItemUnit.Status.DISPOSED
                unit.disposed_at = timezone.now()
                unit.disposal_reason = notes
                unit.save()

        return Response(ItemUnitSerializer(unit).data)


class ItemLoanViewSet(viewsets.ModelViewSet):
    """Préstamos de unidades físicas (ItemUnit) a un solicitante o usuario del taller."""
    queryset = ItemLoan.objects.select_related(
        'item_unit', 'item_unit__item', 'loaned_to', 'loaned_to_user', 'loaned_by', 'returned_to',
    ).all()
    serializer_class = ItemLoanSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'inventory.view'
    manage_permission_key = 'inventory.manage'
    permission_map_by_action = {
        'report': 'reports.export',
    }
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['item_unit', 'loaned_to', 'loaned_to_user', 'loaned_by']

    def get_queryset(self):
        queryset = super().get_queryset()
        returned = self.request.query_params.get('returned_at')
        if returned == 'null':
            queryset = queryset.filter(returned_at__isnull=True)
        overdue = self.request.query_params.get('overdue')
        if overdue == 'true':
            queryset = queryset.filter(returned_at__isnull=True, expected_return_at__lt=timezone.now())
        return queryset

    def perform_create(self, serializer):
        serializer.save(loaned_by=self.request.user)

    @action(detail=True, methods=['post'])
    def return_unit(self, request, pk=None):
        loan = self.get_object()
        if loan.returned_at:
            return Response(
                {'detail': 'Esta unidad ya fue devuelta.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            loan.return_unit(user=request.user)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(loan).data)

    @action(detail=True, methods=['post'])
    def extend(self, request, pk=None):
        """Extiende la fecha de devolución esperada por N días."""
        from datetime import timedelta

        loan = self.get_object()
        if loan.returned_at:
            return Response(
                {'detail': 'El préstamo ya fue devuelto.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            days = int(request.data.get('days', 0))
        except (TypeError, ValueError):
            return Response({'detail': 'Días inválidos.'}, status=status.HTTP_400_BAD_REQUEST)
        if days < 1 or days > 365:
            return Response(
                {'detail': 'Debe indicar entre 1 y 365 días.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        loan.expected_return_at = loan.expected_return_at + timedelta(days=days)
        loan.save()
        return Response(self.get_serializer(loan).data)

    @action(detail=False, methods=['get'])
    def report(self, request):
        """Reporte de asignaciones en PDF o Excel.

        Query params:
        - type: pdf|excel (default: pdf)
        - status: active|all (default: active). active = no devueltos; all = histórico
        - overdue: true|false (default: false). Filtra solo vencidos.
        """
        from datetime import datetime as dt
        require_permission(request.user, 'reports.export', 'No tiene permisos para generar reportes.')

        fmt = request.query_params.get('type', 'pdf')
        if fmt not in ('pdf', 'excel'):
            return Response(
                {'detail': 'Formato inválido. Use pdf o excel.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        status_filter = request.query_params.get('status', 'active')
        only_overdue = request.query_params.get('overdue', 'false').lower() == 'true'

        loans = self.get_queryset()
        if status_filter == 'active':
            loans = loans.filter(returned_at__isnull=True)
        if only_overdue:
            loans = loans.filter(returned_at__isnull=True, expected_return_at__lt=timezone.now())

        loans = loans.order_by('-loaned_at')

        headers = [
            'ID', 'Item', 'Serial', 'Asignado a', 'Prestado por',
            'Fecha préstamo', 'Devolución esperada', 'Devuelto en', 'Estado',
        ]
        rows = []
        for l in loans:
            recipient = l.loaned_to.name if l.loaned_to else (
                l.loaned_to_user.name if l.loaned_to_user else '—'
            )
            if l.returned_at:
                estado = 'Devuelto'
            elif l.is_overdue():
                estado = 'VENCIDO'
            else:
                estado = 'Vigente'
            rows.append([
                l.id,
                l.item_unit.item.name,
                l.item_unit.serial_number,
                recipient,
                l.loaned_by.name,
                l.loaned_at.strftime('%d/%m/%Y'),
                l.expected_return_at.strftime('%d/%m/%Y'),
                l.returned_at.strftime('%d/%m/%Y') if l.returned_at else '—',
                estado,
            ])

        title_suffix = ''
        if status_filter == 'active':
            title_suffix = ' (Activos)'
            if only_overdue:
                title_suffix = ' (Vencidos)'
        else:
            title_suffix = ' (Histórico)'

        buffer = build_report(
            'Reporte de Prestamos de Herramientas' + title_suffix,
            headers,
            rows,
            fmt,
            include_signatures=True,
        )
        content_type = (
            'application/pdf' if fmt == 'pdf'
            else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        extension = 'pdf' if fmt == 'pdf' else 'xlsx'
        ts = dt.now().strftime('%Y%m%d_%H%M%S')
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"prestamos_{ts}.{extension}",
            content_type=content_type,
        )


class RepairRecordViewSet(viewsets.ModelViewSet):
    queryset = RepairRecord.objects.select_related('item', 'technician').all()
    serializer_class = RepairRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminAlmacenistaOrTecnico]
    view_permission_key = 'service_orders.view'
    manage_permission_key = 'service_orders.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['item', 'technician', 'is_active']

    def perform_create(self, serializer):
        technician = serializer.validated_data.get('technician') or self.request.user
        repair = serializer.save(technician=technician)

        in_repair_state = ProductState.objects.filter(code='en_reparacion').first()
        if in_repair_state:
            repair.item.state = in_repair_state
            repair.item.save(update_fields=['state'])

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class InstallationRecordViewSet(viewsets.ModelViewSet):
    queryset = InstallationRecord.objects.select_related('item', 'technician', 'location').all()
    serializer_class = InstallationRecordSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdminAlmacenistaOrTecnico]
    view_permission_key = 'service_orders.view'
    manage_permission_key = 'service_orders.manage'
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['item', 'technician', 'location', 'is_active']

    def perform_create(self, serializer):
        technician = serializer.validated_data.get('technician') or self.request.user
        state = serializer.validated_data.get('item').state
        state_snapshot = state.name if state else ''
        installation = serializer.save(technician=technician)
        installation.state_snapshot = state_snapshot
        installation.save(update_fields=['state_snapshot'])

        installed_state = ProductState.objects.filter(code='instalado').first()
        installation.item.location = installation.location
        installation.item.numero_serie = installation.serial_number
        if installed_state:
            installation.item.state = installed_state
            installation.item.save(update_fields=['location', 'numero_serie', 'state'])
        else:
            installation.item.save(update_fields=['location', 'numero_serie'])

    @action(detail=False, methods=['post'])
    def create_batch(self, request):
        serializer = InstallationBatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = serializer.validated_data
        location = validated['location']
        installed_at = validated.get('installed_at') or timezone.now()
        common_notes = validated.get('notes', '')
        rows = validated['items']

        created = []
        installed_state_default = ProductState.objects.filter(code='instalado').first()

        with transaction.atomic():
            for row in rows:
                item = row['item']
                state = row.get('state') or installed_state_default
                row_notes = row.get('notes', '')
                merged_notes = row_notes or common_notes

                record = InstallationRecord.objects.create(
                    item=item,
                    technician=request.user,
                    location=location,
                    serial_number=row['serial_number'],
                    state_snapshot=state.name if state else '',
                    installed_at=installed_at,
                    notes=merged_notes,
                )

                item.location = location
                item.numero_serie = row['serial_number']
                if state:
                    item.state = state
                    item.save(update_fields=['location', 'numero_serie', 'state'])
                else:
                    item.save(update_fields=['location', 'numero_serie'])

                created.append(record)

        return Response(
            InstallationRecordSerializer(created, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class EntradaProductoFilter(FilterSet):
    marca = NumberFilter(field_name='marca__id')
    modelo = NumberFilter(field_name='modelo__id')
    ubicacion = NumberFilter(field_name='ubicacion__id')
    tipo = django_filters.CharFilter(field_name='tipo')
    fecha_recepcion = django_filters.DateFromToRangeFilter(field_name='fecha_recepcion')

    class Meta:
        model = EntradaProducto
        fields = ['marca', 'modelo', 'ubicacion', 'tipo', 'fecha_recepcion']


class EntradaProductoViewSet(viewsets.ModelViewSet):
    queryset = EntradaProducto.objects.select_related(
        'marca', 'modelo', 'categoria', 'ubicacion', 'registrado_por', 'base_product'
    ).all()
    serializer_class = EntradaProductoSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    view_permission_key = 'reception.view'
    manage_permission_key = 'reception.manage'
    permission_map_by_action = {
        'receipt': 'reports.export',
        'history_report': 'reports.export',
        'attachments': 'reception.view',
        'upload_attachments': 'reception.manage',
        'upload_signed_receipt': 'reception.manage',
    }
    filter_backends = [DjangoFilterBackend]
    filterset_class = EntradaProductoFilter

    def get_queryset(self):
        queryset = super().get_queryset()
        reception_id = self.request.query_params.get('reception_id')
        search = (self.request.query_params.get('search') or '').strip()
        if reception_id:
            queryset = queryset.filter(reception_id=reception_id)
        if search:
            queryset = queryset.filter(
                Q(reception_id__icontains=search)
                | Q(marca__name__icontains=search)
                | Q(modelo__name__icontains=search)
                | Q(categoria__name__icontains=search)
                | Q(entregado_por_nombre__icontains=search)
                | Q(entregado_por_apellido__icontains=search)
                | Q(entregado_por_cedula__icontains=search)
                | Q(entregado_por_rango_cargo__icontains=search)
                | Q(observaciones__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        serializer.save(registrado_por=self.request.user)

    @action(detail=False, methods=['post'])
    def create_batch(self, request):
        payload = request.data.get('payload')
        if payload:
            try:
                payload = json.loads(payload)
            except json.JSONDecodeError:
                return Response({'detail': 'El payload JSON es inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            payload = request.data

        serializer = EntradaProductoBatchCreateSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        reception_id = f"REC-{timezone.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
        fecha_recepcion = serializer.validated_data.get('fecha_recepcion') or timezone.now()
        observaciones_global = serializer.validated_data.get('observaciones', '')
        ubicacion = serializer.validated_data['ubicacion']
        entregado_por_nombre = serializer.validated_data['entregado_por_nombre']
        entregado_por_apellido = serializer.validated_data['entregado_por_apellido']
        entregado_por_cedula = serializer.validated_data['entregado_por_cedula']
        entregado_por_rango_cargo = serializer.validated_data['entregado_por_rango_cargo']
        lineas = serializer.validated_data['lineas']

        created = []
        with transaction.atomic():
            for idx, linea in enumerate(lineas, start=1):
                try:
                    base_product = linea.get('item') or self._resolve_base_product_for_line(linea)
                    seriales = self._prepare_seriales(
                        tipo=linea['tipo'],
                        cantidad=linea['cantidad'],
                        seriales=linea.get('seriales') or [],
                        marca=linea['marca'].name,
                        modelo=linea['modelo'].name,
                        index_offset=idx,
                    )
                except ValueError as exc:
                    transaction.set_rollback(True)
                    return Response(
                        {'detail': f'Línea {idx}: {exc}'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                entrada = EntradaProducto.objects.create(
                    reception_id=reception_id,
                    marca=linea['marca'],
                    modelo=linea['modelo'],
                    categoria=linea['categoria'],
                    base_product=base_product,
                    tipo=linea['tipo'],
                    cantidad=linea['cantidad'],
                    seriales=seriales,
                    ubicacion=ubicacion,
                    observaciones=(linea.get('observaciones') or observaciones_global or ''),
                    entregado_por_nombre=entregado_por_nombre,
                    entregado_por_apellido=entregado_por_apellido,
                    entregado_por_cedula=entregado_por_cedula,
                    entregado_por_rango_cargo=entregado_por_rango_cargo,
                    fecha_recepcion=fecha_recepcion,
                    registrado_por=request.user,
                )
                created.append(entrada)
                self._register_inventory_for_line(entrada, base_product=base_product)

            for uploaded in request.FILES.getlist('photos'):
                EntradaProductoAttachment.objects.create(
                    reception_id=reception_id,
                    file=uploaded,
                    attachment_type=EntradaProductoAttachment.AttachmentType.FOTO,
                    uploaded_by=request.user,
                )

            for uploaded in request.FILES.getlist('documents'):
                EntradaProductoAttachment.objects.create(
                    reception_id=reception_id,
                    file=uploaded,
                    attachment_type=EntradaProductoAttachment.AttachmentType.DOCUMENTO,
                    uploaded_by=request.user,
                )

            for uploaded in request.FILES.getlist('signed_receipt'):
                EntradaProductoAttachment.objects.create(
                    reception_id=reception_id,
                    file=uploaded,
                    attachment_type=EntradaProductoAttachment.AttachmentType.COMPROBANTE_FIRMADO,
                    uploaded_by=request.user,
                )

            # Backward compatibility: generic attachments list is treated as documentos.
            for uploaded in request.FILES.getlist('attachments'):
                EntradaProductoAttachment.objects.create(
                    reception_id=reception_id,
                    file=uploaded,
                    attachment_type=EntradaProductoAttachment.AttachmentType.DOCUMENTO,
                    uploaded_by=request.user,
                )

        self._log_reception_event(
            reception_id=reception_id,
            action=AuditLog.Action.CREATE,
            event='reception_created',
            details={
                'line_count': len(created),
                'photos_uploaded': len(request.FILES.getlist('photos')),
                'documents_uploaded': len(request.FILES.getlist('documents')) + len(request.FILES.getlist('attachments')),
                'signed_uploaded': len(request.FILES.getlist('signed_receipt')),
            },
        )

        result = EntradaProductoSerializer(created, many=True)
        return Response({'reception_id': reception_id, 'lineas': result.data}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def receipt(self, request):
        reception_id = request.query_params.get('reception_id')
        fmt = request.query_params.get('type', 'pdf')

        if not reception_id:
            return Response({'detail': 'reception_id es requerido.'}, status=status.HTTP_400_BAD_REQUEST)
        if fmt not in ('pdf', 'excel'):
            return Response({'detail': 'Formato inválido. Use pdf o excel.'}, status=status.HTTP_400_BAD_REQUEST)

        entries = self.get_queryset().filter(reception_id=reception_id).order_by('id')
        if not entries.exists():
            return Response({'detail': 'No se encontraron líneas para esta recepción.'}, status=status.HTTP_404_NOT_FOUND)

        first = entries.first()
        headers = ['Recepción', 'Fecha', 'Tipo', 'Marca', 'Modelo', 'Categoría', 'Cantidad', 'No. Serie', 'Observaciones']
        rows = []
        for entry in entries:
            seriales_display = ', '.join(entry.seriales) if entry.seriales else (entry.base_product.numero_serie if entry.base_product and entry.base_product.numero_serie else '—')
            rows.append([
                entry.reception_id,
                entry.fecha_recepcion.strftime('%d/%m/%Y %H:%M'),
                entry.get_tipo_display(),
                entry.marca.name,
                entry.modelo.name,
                entry.categoria.name,
                entry.cantidad,
                seriales_display,
                entry.observaciones or '—',
            ])

        buffer = build_report(
            'COMPROBANTE',
            headers,
            rows,
            fmt,
            include_signatures=True,
            signature_names={
                'delivered_by': f"{first.entregado_por_nombre} {first.entregado_por_apellido} ({first.entregado_por_rango_cargo})",
                'received_by': first.registrado_por.name,
            },
            receipt_mode=True,
        )
        content_type = 'application/pdf' if fmt == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'pdf' if fmt == 'pdf' else 'xlsx'

        self._log_reception_event(
            reception_id=reception_id,
            action=AuditLog.Action.UPDATE,
            event='reception_receipt_downloaded',
            details={
                'format': fmt,
                'line_count': entries.count(),
            },
        )

        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"recepcion_{reception_id}.{extension}",
            content_type=content_type,
        )

    @action(detail=False, methods=['get'], url_path='history-report')
    def history_report(self, request):
        fmt = request.query_params.get('type', 'pdf')
        if fmt not in ('pdf', 'excel'):
            return Response({'detail': 'Formato inválido. Use pdf o excel.'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.filter_queryset(self.get_queryset()).order_by('-fecha_recepcion', '-id')

        headers = [
            'Recepción', 'Fecha', 'Tipo', 'Marca', 'Modelo', 'Categoría',
            'Cantidad', 'No. Serie', 'Ubicación', 'Entregado por', 'Cédula', 'Registrado por',
        ]
        rows = []
        for entry in queryset:
            entregado_por = f"{entry.entregado_por_nombre} {entry.entregado_por_apellido}".strip()
            seriales_display = ', '.join(entry.seriales) if entry.seriales else (entry.base_product.numero_serie if entry.base_product and entry.base_product.numero_serie else '—')
            rows.append([
                entry.reception_id,
                entry.fecha_recepcion.strftime('%d/%m/%Y %H:%M'),
                entry.get_tipo_display(),
                entry.marca.name,
                entry.modelo.name,
                entry.categoria.name,
                entry.cantidad,
                seriales_display,
                entry.ubicacion.get_breadcrumb() if entry.ubicacion else '—',
                entregado_por or '—',
                entry.entregado_por_cedula or '—',
                entry.registrado_por.name if entry.registrado_por else '—',
            ])

        if not rows:
            rows = [['—', '—', '—', '—', '—', '—', 0, '—', '—', '—', '—', '—']]

        metadata_lines = []
        if request.query_params.get('tipo'):
            metadata_lines.append(f"Tipo: {request.query_params.get('tipo')}")
        if request.query_params.get('fecha_recepcion_after'):
            metadata_lines.append(f"Desde: {request.query_params.get('fecha_recepcion_after')}")
        if request.query_params.get('fecha_recepcion_before'):
            metadata_lines.append(f"Hasta: {request.query_params.get('fecha_recepcion_before')}")
        if request.query_params.get('search'):
            metadata_lines.append(f"Búsqueda: {request.query_params.get('search')}")

        buffer = build_report('Historial de Recepciones', headers, rows, fmt, metadata_lines=metadata_lines)
        content_type = 'application/pdf' if fmt == 'pdf' else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        extension = 'pdf' if fmt == 'pdf' else 'xlsx'
        return FileResponse(
            buffer,
            as_attachment=True,
            filename=f"historial_recepciones_{timezone.now().strftime('%Y%m%d_%H%M%S')}.{extension}",
            content_type=content_type,
        )

    @action(detail=False, methods=['post'])
    def upload_signed_receipt(self, request):
        reception_id = request.data.get('reception_id') or request.query_params.get('reception_id')
        if not reception_id:
            return Response({'detail': 'reception_id es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        entries = self.get_queryset().filter(reception_id=reception_id)
        if not entries.exists():
            return Response({'detail': 'No se encontró la recepción indicada.'}, status=status.HTTP_404_NOT_FOUND)

        uploaded_files = request.FILES.getlist('signed_receipt') or request.FILES.getlist('file')
        if not uploaded_files:
            return Response({'detail': 'Debe adjuntar al menos un archivo.'}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        for uploaded in uploaded_files:
            attachment = EntradaProductoAttachment.objects.create(
                reception_id=reception_id,
                file=uploaded,
                attachment_type=EntradaProductoAttachment.AttachmentType.COMPROBANTE_FIRMADO,
                uploaded_by=request.user,
            )
            created.append(attachment)

        self._log_reception_event(
            reception_id=reception_id,
            action=AuditLog.Action.UPDATE,
            event='signed_receipt_uploaded',
            details={
                'files_count': len(created),
                'filenames': [f.name for f in uploaded_files],
            },
        )

        data = EntradaProductoAttachmentSerializer(created, many=True, context={'request': request}).data
        return Response({'reception_id': reception_id, 'adjuntos': data}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def upload_attachments(self, request):
        reception_id = request.data.get('reception_id') or request.query_params.get('reception_id')
        if not reception_id:
            return Response({'detail': 'reception_id es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        entries = self.get_queryset().filter(reception_id=reception_id)
        if not entries.exists():
            return Response({'detail': 'No se encontró la recepción indicada.'}, status=status.HTTP_404_NOT_FOUND)

        created = []
        for uploaded in request.FILES.getlist('photos'):
            created.append(EntradaProductoAttachment.objects.create(
                reception_id=reception_id,
                file=uploaded,
                attachment_type=EntradaProductoAttachment.AttachmentType.FOTO,
                uploaded_by=request.user,
            ))

        for uploaded in request.FILES.getlist('documents'):
            created.append(EntradaProductoAttachment.objects.create(
                reception_id=reception_id,
                file=uploaded,
                attachment_type=EntradaProductoAttachment.AttachmentType.DOCUMENTO,
                uploaded_by=request.user,
            ))

        for uploaded in request.FILES.getlist('signed_receipt'):
            created.append(EntradaProductoAttachment.objects.create(
                reception_id=reception_id,
                file=uploaded,
                attachment_type=EntradaProductoAttachment.AttachmentType.COMPROBANTE_FIRMADO,
                uploaded_by=request.user,
            ))

        if not created:
            return Response({'detail': 'Debe adjuntar al menos un archivo.'}, status=status.HTTP_400_BAD_REQUEST)

        self._log_reception_event(
            reception_id=reception_id,
            action=AuditLog.Action.UPDATE,
            event='reception_attachments_uploaded',
            details={
                'photos_count': len(request.FILES.getlist('photos')),
                'documents_count': len(request.FILES.getlist('documents')),
                'signed_count': len(request.FILES.getlist('signed_receipt')),
            },
        )

        data = EntradaProductoAttachmentSerializer(created, many=True, context={'request': request}).data
        return Response({'reception_id': reception_id, 'adjuntos': data}, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def attachments(self, request):
        reception_id = request.query_params.get('reception_id')
        attachment_type = request.query_params.get('attachment_type')

        if not reception_id:
            return Response({'detail': 'reception_id es requerido.'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = EntradaProductoAttachment.objects.filter(reception_id=reception_id).order_by('-created_at')
        if attachment_type:
            queryset = queryset.filter(attachment_type=attachment_type)

        self._log_reception_event(
            reception_id=reception_id,
            action=AuditLog.Action.UPDATE,
            event='reception_attachments_viewed',
            details={
                'attachment_type': attachment_type or 'all',
                'count': queryset.count(),
            },
        )

        data = EntradaProductoAttachmentSerializer(queryset, many=True, context={'request': request}).data
        return Response({'reception_id': reception_id, 'adjuntos': data})

    def _log_reception_event(self, reception_id, action, event, details=None):
        request = getattr(self, 'request', None)
        user = request.user if request and request.user.is_authenticated else None
        ip = None
        if request:
            forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
            ip = forwarded.split(',')[0].strip() if forwarded else request.META.get('REMOTE_ADDR')

        AuditLog.objects.create(
            action=action,
            model_name='inventory.reception',
            object_id=str(reception_id),
            changes={
                'event': event,
                'details': details or {},
            },
            user=user,
            ip_address=ip,
        )

    def _prepare_seriales(self, tipo, cantidad, seriales, marca, modelo, index_offset=1):
        cleaned = [s.strip() for s in seriales if str(s).strip()]
        if len(cleaned) != len(set(cleaned)):
            raise ValueError('Hay seriales duplicados en la misma línea.')

        if tipo == EntradaProducto.Tipo.USADO and not cleaned:
            cleaned = self._generate_seriales(cantidad, marca, modelo, index_offset)
        elif cleaned and len(cleaned) != cantidad:
            raise ValueError('La cantidad de seriales debe coincidir con la cantidad de unidades.')

        return cleaned

    def _generate_seriales(self, cantidad, marca, modelo, index_offset):
        base = timezone.now().strftime('%Y%m%d%H%M%S')
        mark = ''.join([c for c in marca.upper() if c.isalnum()])[:4] or 'MRCA'
        model = ''.join([c for c in modelo.upper() if c.isalnum()])[:4] or 'MODL'
        return [f"AUT-{mark}-{model}-{base}-{index_offset + i:02d}" for i in range(cantidad)]

    def _resolve_base_product_for_line(self, linea):
        candidates = Item.objects.filter(
            is_base_product=True,
            is_active=True,
            brand=linea['marca'],
            product_model=linea['modelo'],
            category=linea['categoria'],
        ).order_by('id')

        count = candidates.count()
        if count == 0:
            raise ValueError(
                f"No existe producto base para {linea['marca'].name} / {linea['modelo'].name} / {linea['categoria'].name}. Regístrelo en el módulo Productos antes de recepción."
            )
        if count > 1:
            raise ValueError(
                f"Hay múltiples productos base para {linea['marca'].name} / {linea['modelo'].name} / {linea['categoria'].name}. Mantenga un único producto base para esa combinación."
            )
        return candidates.first()

    def _register_inventory_for_line(self, entrada, base_product):
        item = base_product
        if entrada.ubicacion:
            item.location = entrada.ubicacion
        item.quantity += entrada.cantidad
        if entrada.tipo == EntradaProducto.Tipo.USADO:
            item.track_by_serial = True
            item.kind = Item.Kind.HERRAMIENTA

        update_fields = ['quantity', 'track_by_serial', 'kind']
        if entrada.ubicacion:
            update_fields.append('location')
        item.save(update_fields=update_fields)

        StockMovement.objects.create(
            item=item,
            movement_type=StockMovement.MovementType.ENTRY,
            quantity=entrada.cantidad,
            document_type=StockMovement.DocumentType.DIRECTO,
            document_number=entrada.reception_id,
            notes=f"Recepción de mercancía ({entrada.get_tipo_display()})",
        )

        if entrada.seriales and item.track_by_serial:
            existing = set(ItemUnit.objects.filter(item=item).values_list('serial_number', flat=True))
            for serial in entrada.seriales:
                if serial not in existing:
                    ItemUnit.objects.create(item=item, serial_number=serial, notes=f"Alta por recepción {entrada.reception_id}")
