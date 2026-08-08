from rest_framework import serializers
from datetime import timedelta
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.mail import send_mail
from django.conf import settings
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import SystemSetting

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    agent_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=20,
        validators=[],
    )

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role', 'agent_id', 'is_active', 'must_change_password', 'date_joined']
        read_only_fields = ['id', 'must_change_password', 'date_joined']

    def validate_agent_id(self, value):
        normalized_value = value.strip() if value else None
        if normalized_value:
            queryset = User.objects.filter(agent_id=normalized_value)
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)
            if queryset.exists():
                raise serializers.ValidationError('Esta matrícula ya está asignada a otro usuario.')
        return normalized_value


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    agent_id = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=20,
        validators=[],
    )

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'role', 'agent_id', 'password']

    def create(self, validated_data):
        validated_data['must_change_password'] = True
        user = User.objects.create_user(**validated_data)
        if user.role == User.Role.TECNICO:
            send_mail(
                subject='Registro de técnico en Sistema de Inventario',
                message=(
                    f'Hola {user.name},\n\n'
                    'Tu cuenta de técnico fue creada exitosamente.\n'
                    'Ya puedes acceder al sistema con tu correo institucional.'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=True,
            )
        return user

    def validate_password(self, value):
        validate_password(value)
        return value

    def validate_agent_id(self, value):
        normalized_value = value.strip() if value else None
        if normalized_value and User.objects.filter(agent_id=normalized_value).exists():
            raise serializers.ValidationError('Esta matrícula ya está asignada a otro usuario.')
        return normalized_value


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    confirm_new_password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, attrs):
        user = self.context['request'].user
        if not user.check_password(attrs['current_password']):
            raise serializers.ValidationError({'current_password': 'La contraseña actual es incorrecta.'})
        if attrs['new_password'] != attrs['confirm_new_password']:
            raise serializers.ValidationError({'confirm_new_password': 'Las contraseñas no coinciden.'})
        validate_password(attrs['new_password'], user=user)
        return attrs


class AdminResetPasswordSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ['session_timeout_minutes', 'updated_at']
        read_only_fields = ['updated_at']

    def validate_session_timeout_minutes(self, value):
        if value < 5 or value > 240:
            raise serializers.ValidationError('El tiempo de sesión debe estar entre 5 y 240 minutos.')
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        session_minutes = SystemSetting.get_solo().session_timeout_minutes
        token.set_exp(lifetime=timedelta(minutes=session_minutes))
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        data['session_timeout_minutes'] = SystemSetting.get_solo().session_timeout_minutes
        return data
