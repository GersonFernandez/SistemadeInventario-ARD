from rest_framework import permissions


class IsAlmacenistaOrAdmin(permissions.BasePermission):
    """Permite escritura solo a admin o almacenista. Técnicos solo lectura."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return request.user.role in ('admin', 'almacenista')


class IsAdminAlmacenistaOrTecnico(permissions.BasePermission):
    """Permite escritura a admin, almacenista y técnico."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        if request.method in permissions.SAFE_METHODS:
            return True

        return request.user.role in ('admin', 'almacenista', 'tecnico')
