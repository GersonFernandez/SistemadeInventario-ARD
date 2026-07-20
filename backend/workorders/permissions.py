from rest_framework import permissions


class IsAlmacenistaOrAdmin(permissions.BasePermission):
    """Permite escritura solo a admin o almacenista. Técnicos solo lectura y solicitud de repuestos."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.user.role in ('admin', 'almacenista'):
            return True

        if request.user.role == 'tecnico':
            if request.method in permissions.SAFE_METHODS:
                return True
            # Técnicos solo pueden solicitar repuestos
            return getattr(view, 'action', None) == 'request_part'

        return False


class IsAssignedTechnicianOrAdmin(permissions.BasePermission):
    """Permite ver/actualizar una OT solo al técnico asignado o admin/almacenista."""

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.role in ('admin', 'almacenista'):
            return True

        if user.role == 'tecnico':
            assigned_user = getattr(obj, 'technician', None) or getattr(obj, 'assigned_technician', None)
            if assigned_user != user:
                return False
            action = getattr(view, 'action', None)
            return request.method in permissions.SAFE_METHODS or action in ('request_part', 'transition', 'add_note', 'complete_service')

        return False
