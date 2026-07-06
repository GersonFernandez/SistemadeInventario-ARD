from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.http import FileResponse
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from utils.reports import build_report
from .models import Despacho, LineaDespacho, Solicitante
from inventory.models import Item, ItemUnit, ItemLoan, StockMovement
from .serializers import (
    DespachoListSerializer,
    DespachoDetailSerializer,
    LineaDespachoSerializer,
    SolicitanteSerializer,
    SolicitanteSimpleSerializer,
)
from .permissions import IsAlmacenistaOrAdmin
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
            despacho = DispatchService.create(
                user=request.user,
                solicitante_id=request.data.get('solicitante_id'),
                unit_id=request.data.get('unit_id'),
                equipment_reference=request.data.get('equipment_reference', ''),
                notes=request.data.get('notes', ''),
                items=items_payload,
            )
        except (ValueError, Item.DoesNotExist, ItemUnit.DoesNotExist) as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(despacho)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

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
