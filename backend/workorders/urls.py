from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DespachoViewSet, SolicitanteViewSet, ServiceOrderViewSet

router = DefaultRouter()
router.register(r'despachos', DespachoViewSet, basename='despacho')
router.register(r'solicitantes', SolicitanteViewSet, basename='solicitante')
router.register(r'service-orders', ServiceOrderViewSet, basename='service-order')

urlpatterns = [
    path('', include(router.urls)),
]
