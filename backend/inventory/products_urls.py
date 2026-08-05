from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .products_views import (
    ProductCategoryViewSet,
    ProductBrandViewSet,
    ProductModelViewSet,
    ProductStateViewSet,
    ProductUnitMeasureViewSet,
    ProductLocationViewSet,
    ProductItemViewSet,
)

router = DefaultRouter()
router.register(r'categories', ProductCategoryViewSet, basename='product-category')
router.register(r'brands', ProductBrandViewSet, basename='product-brand')
router.register(r'product-models', ProductModelViewSet, basename='product-model')
router.register(r'product-states', ProductStateViewSet, basename='product-state')
router.register(r'unit-measures', ProductUnitMeasureViewSet, basename='product-unit-measure')
router.register(r'locations', ProductLocationViewSet, basename='product-location')
router.register(r'items', ProductItemViewSet, basename='product-item')

urlpatterns = [
    path('', include(router.urls)),
]
