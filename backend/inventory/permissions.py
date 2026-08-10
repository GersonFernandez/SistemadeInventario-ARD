from rest_framework import permissions
from accounts.permissions import HasViewSetPermissionMatrix


class IsAlmacenistaOrAdmin(HasViewSetPermissionMatrix):
    """Matriz dinámica: lectura/escritura según claves configuradas en cada ViewSet."""

    default_view_permission_key = 'inventory.view'
    default_manage_permission_key = 'inventory.manage'


class IsAdminAlmacenistaOrTecnico(HasViewSetPermissionMatrix):
    """Matriz dinámica para módulos técnicos de mantenimiento/instalación."""

    default_view_permission_key = 'service_orders.view'
    default_manage_permission_key = 'service_orders.manage'
