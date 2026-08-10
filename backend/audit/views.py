from rest_framework import viewsets, permissions
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, DateTimeFilter, CharFilter
from .models import AuditLog
from .serializers import AuditLogSerializer
from accounts.permissions import HasPermissionKey


class IsAdminOrAlmacenista(permissions.BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ('admin', 'almacenista')
        )


class AuditLogFilter(FilterSet):
    timestamp_from = DateTimeFilter(field_name='timestamp', lookup_expr='gte')
    timestamp_to = DateTimeFilter(field_name='timestamp', lookup_expr='lte')
    object_id = CharFilter(field_name='object_id', lookup_expr='exact')

    class Meta:
        model = AuditLog
        fields = ['action', 'model_name', 'user', 'object_id',
                  'timestamp_from', 'timestamp_to']


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('user').all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermissionKey]
    required_permission_key = 'audit.view'
    filter_backends = [DjangoFilterBackend]
    filterset_class = AuditLogFilter
