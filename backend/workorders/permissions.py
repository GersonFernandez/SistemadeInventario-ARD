from rest_framework import permissions
from accounts.permissions import HasViewSetPermissionMatrix, has_permission_key, resolve_permission_key


class IsAlmacenistaOrAdmin(HasViewSetPermissionMatrix):
    """Matriz dinámica para despacho/solicitantes."""

    default_view_permission_key = 'despachos.view'
    default_manage_permission_key = 'despachos.manage'


class IsAssignedTechnicianOrAdmin(permissions.BasePermission):
    """Matriz dinámica + restricción de técnico asignado para órdenes de servicio."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        permission_key = resolve_permission_key(
            view,
            request,
            default_view_key='service_orders.view',
            default_manage_key='service_orders.manage',
        )
        return has_permission_key(request.user, permission_key)

    def has_object_permission(self, request, view, obj):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.role in ('admin', 'almacenista'):
            return self.has_permission(request, view)

        can_view = has_permission_key(user, 'service_orders.view')
        can_manage = has_permission_key(user, 'service_orders.manage')

        if user.role != 'tecnico':
            return False

        assigned_user = getattr(obj, 'technician', None) or getattr(obj, 'assigned_technician', None)
        if assigned_user != user:
            return False

        if request.method in permissions.SAFE_METHODS:
            return can_view

        return can_manage
