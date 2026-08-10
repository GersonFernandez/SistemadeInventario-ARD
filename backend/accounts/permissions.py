from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


def has_permission_key(user, permission_key):
    if not user or not user.is_authenticated:
        return False
    if not permission_key:
        return True
    from .models import RolePermission
    return RolePermission.has_user_permission(user, permission_key)


def require_permission(user, permission_key, message='No tiene permisos para realizar esta operación.'):
    if not has_permission_key(user, permission_key):
        raise PermissionDenied(message)


def resolve_permission_key(view, request, default_view_key=None, default_manage_key=None):
    action = getattr(view, 'action', None)
    action_map = getattr(view, 'permission_map_by_action', {}) or {}

    if action in action_map:
        return action_map[action]

    if request.method in permissions.SAFE_METHODS:
        return getattr(view, 'view_permission_key', default_view_key)

    return getattr(view, 'manage_permission_key', default_manage_key)


class HasPermissionKey(permissions.BasePermission):
    """Permission for APIView classes using `required_permission_key` attribute."""

    def has_permission(self, request, view):
        key = getattr(view, 'required_permission_key', None)
        return has_permission_key(request.user, key)


class HasViewSetPermissionMatrix(permissions.BasePermission):
    """Permission for ViewSet classes using view/manage keys and optional action map."""

    default_view_permission_key = None
    default_manage_permission_key = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        permission_key = resolve_permission_key(
            view,
            request,
            default_view_key=self.default_view_permission_key,
            default_manage_key=self.default_manage_permission_key,
        )
        return has_permission_key(request.user, permission_key)

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class IsAlmacenista(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_almacenista


class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == request.user.Role.ADMIN


class IsTecnico(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_tecnico


class ReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS
