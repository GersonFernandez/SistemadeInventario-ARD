from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LoginView,
    RefreshView,
    LogoutView,
    MeView,
    UserViewSet,
    RolePermissionViewSet,
    PasswordChangeView,
    AdminResetPasswordView,
    SystemSettingView,
)

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'role-permissions', RolePermissionViewSet, basename='role-permission')

urlpatterns = [
    path('auth/login/', LoginView.as_view(), name='login'),
    path('auth/refresh/', RefreshView.as_view(), name='refresh'),
    path('auth/logout/', LogoutView.as_view(), name='logout'),
    path('auth/me/', MeView.as_view(), name='me'),
    path('auth/change-password/', PasswordChangeView.as_view(), name='change-password'),
    path('auth/admin-reset-password/', AdminResetPasswordView.as_view(), name='admin-reset-password'),
    path('settings/session/', SystemSettingView.as_view(), name='system-session-setting'),
] + router.urls
