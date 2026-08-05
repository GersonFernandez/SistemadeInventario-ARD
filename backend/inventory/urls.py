from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, BrandViewSet, ProductModelViewSet, ProductStateViewSet,
    UnitMeasureViewSet, LocationTypeViewSet, LocationViewSet, ItemViewSet,
    StockMovementViewSet, TransferViewSet,
    ItemUnitViewSet, ItemLoanViewSet,
    RepairRecordViewSet, InstallationRecordViewSet,
    EntradaProductoViewSet,
)

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'brands', BrandViewSet, basename='brand')
router.register(r'product-models', ProductModelViewSet, basename='productmodel')
router.register(r'product-states', ProductStateViewSet, basename='productstate')
router.register(r'unit-measures', UnitMeasureViewSet, basename='unitmeasure')
router.register(r'location-types', LocationTypeViewSet, basename='locationtype')
router.register(r'locations', LocationViewSet, basename='location')
router.register(r'items', ItemViewSet, basename='item')
router.register(r'stock-movements', StockMovementViewSet, basename='stockmovement')
router.register(r'transfers', TransferViewSet, basename='transfer')
router.register(r'item-units', ItemUnitViewSet, basename='itemunit')
router.register(r'item-loans', ItemLoanViewSet, basename='itemloan')
router.register(r'repairs', RepairRecordViewSet, basename='repairrecord')
router.register(r'installations', InstallationRecordViewSet, basename='installationrecord')
router.register(r'product-entries', EntradaProductoViewSet, basename='entradaproducto')

urlpatterns = [
    path('', include(router.urls)),
]
