from django.db import IntegrityError, transaction
from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.exceptions import ValidationError
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter

from .models import Category, Brand, ProductModel, ProductState, Location, Item, UnitMeasure
from .serializers import (
    CategorySerializer,
    BrandSerializer,
    ProductModelSerializer,
    ProductStateSerializer,
    UnitMeasureSerializer,
    LocationSimpleSerializer,
    ItemListSerializer,
    ItemDetailSerializer,
)
from .permissions import IsAlmacenistaOrAdmin


class ProductCategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'abbreviation', 'description']

    def get_queryset(self):
        return super().get_queryset().order_by('name')


class ProductBrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'description']

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by('-is_active', 'name')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class ProductModelViewSet(viewsets.ModelViewSet):
    queryset = ProductModel.objects.select_related('brand').all()
    serializer_class = ProductModelSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['is_active', 'brand']
    search_fields = ['name', 'description', 'brand__name']

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
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'code', 'description']

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by('-is_active', 'name')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class ProductUnitMeasureViewSet(viewsets.ModelViewSet):
    queryset = UnitMeasure.objects.all()
    serializer_class = UnitMeasureSerializer
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['is_active']
    search_fields = ['name', 'code', 'description']

    def get_queryset(self):
        queryset = super().get_queryset()
        return queryset.order_by('-is_active', 'name')

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])


class ProductLocationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Location.objects.select_related('location_type', 'parent').all()
    serializer_class = LocationSimpleSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [SearchFilter]
    search_fields = ['name', 'codigo', 'location_type__name']


class ProductItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related('category', 'location', 'brand', 'product_model', 'state').all()
    permission_classes = [permissions.IsAuthenticated, IsAlmacenistaOrAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['category', 'brand', 'product_model', 'state', 'kind', 'is_active']

    def get_serializer_class(self):
        if self.action == 'list':
            return ItemListSerializer
        return ItemDetailSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(part_number__icontains=search)
                | Q(numero_serie__icontains=search)
                | Q(marca__icontains=search)
                | Q(modelo__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        category = serializer.validated_data.get('category')
        for _ in range(3):
            code = self._generate_code(category)
            try:
                with transaction.atomic():
                    serializer.save(code=code, is_base_product=True)
                return
            except IntegrityError as exc:
                if 'inventory_item_code_key' not in str(exc):
                    raise

        raise ValidationError({
            'detail': 'No se pudo generar un código único para el producto. Intente nuevamente.'
        })

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active', 'updated_at'])

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
