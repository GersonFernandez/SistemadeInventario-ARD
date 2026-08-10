from rest_framework import generics, viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.contrib.auth import get_user_model
from django.utils.crypto import get_random_string
from django.core.mail import send_mail
from django.conf import settings
from .models import SystemSetting, RolePermission
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    CustomTokenObtainPairSerializer,
    PasswordChangeSerializer,
    AdminResetPasswordSerializer,
    SystemSettingSerializer,
    RolePermissionSerializer,
)
from .permissions import HasPermissionKey, require_permission

User = get_user_model()


class LoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RefreshView(TokenRefreshView):
    pass


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({'detail': 'Sesión cerrada correctamente'}, status=status.HTTP_200_OK)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        RolePermission.ensure_defaults()
        data = UserSerializer(request.user).data
        data['session_timeout_minutes'] = SystemSetting.get_solo().session_timeout_minutes
        data['permissions'] = RolePermission.get_permissions_for_user(request.user)
        return Response(data)


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data['new_password'])
        request.user.must_change_password = False
        request.user.save(update_fields=['password', 'must_change_password'])

        send_mail(
            subject='Cambio de contraseña confirmado',
            message=(
                f'Hola {request.user.name},\n\n'
                'Tu contraseña fue cambiada correctamente.\n'
                'Si no realizaste este cambio, contacta al administrador de inmediato.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[request.user.email],
            fail_silently=True,
        )
        return Response({'detail': 'Contraseña actualizada y confirmación enviada por correo.'})


class AdminResetPasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated, HasPermissionKey]
    required_permission_key = 'users.manage'

    def post(self, request):
        serializer = AdminResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            user = User.objects.get(id=serializer.validated_data['user_id'])
        except User.DoesNotExist:
            return Response({'detail': 'Usuario no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        temporary_password = get_random_string(length=12)
        user.set_password(temporary_password)
        user.must_change_password = True
        user.save(update_fields=['password', 'must_change_password'])

        send_mail(
            subject='Restablecimiento de contraseña',
            message=(
                f'Hola {user.name},\n\n'
                'Un administrador restableció tu contraseña.\n'
                f'Contraseña temporal: {temporary_password}\n\n'
                'Debes cambiarla en tu próximo acceso.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=True,
        )
        return Response({'detail': 'Contraseña temporal enviada por correo al usuario.'})


class SystemSettingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        setting = SystemSetting.get_solo()
        return Response(SystemSettingSerializer(setting).data)

    def put(self, request):
        require_permission(
            request.user,
            'users.manage',
            'Solo usuarios con permisos de gestión pueden modificar la configuración.',
        )
        setting = SystemSetting.get_solo()
        serializer = SystemSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = [permissions.IsAuthenticated, HasPermissionKey]
    required_permission_key = 'users.manage'

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


class RolePermissionViewSet(viewsets.ModelViewSet):
    serializer_class = RolePermissionSerializer
    permission_classes = [permissions.IsAuthenticated, HasPermissionKey]
    required_permission_key = 'roles.manage'
    http_method_names = ['get', 'put', 'patch', 'head', 'options']

    def get_queryset(self):
        RolePermission.ensure_defaults()
        return RolePermission.objects.all().order_by('role')
