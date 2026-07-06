from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from dirtyfields import DirtyFieldsMixin


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('El correo electrónico es obligatorio')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', User.Role.ADMIN)
        return self.create_user(email, password, **extra_fields)


class User(DirtyFieldsMixin, AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        ADMIN = 'admin', 'Administrador'
        ALMACENISTA = 'almacenista', 'Encargado de Inventario'
        TECNICO = 'tecnico', 'Técnico'

    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.TECNICO)
    agent_id = models.CharField(max_length=20, blank=True, null=True, unique=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']

    class Meta:
        ordering = ['name']
        verbose_name = 'usuario'
        verbose_name_plural = 'usuarios'

    def __str__(self):
        return f"{self.name} ({self.email})"

    @property
    def is_almacenista(self):
        return self.role == self.Role.ALMACENISTA or self.role == self.Role.ADMIN

    @property
    def is_tecnico(self):
        return self.role == self.Role.TECNICO


class SystemSetting(models.Model):
    """Configuración global editable por administradores."""

    singleton_key = models.CharField(max_length=50, unique=True, default='global')
    session_timeout_minutes = models.PositiveIntegerField(default=15)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'configuración del sistema'
        verbose_name_plural = 'configuración del sistema'

    def __str__(self):
        return f"Configuración global ({self.session_timeout_minutes} min)"

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(singleton_key='global')
        return obj
