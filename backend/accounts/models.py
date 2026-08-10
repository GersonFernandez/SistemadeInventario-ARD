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
    must_change_password = models.BooleanField(default=False)
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


class RolePermission(models.Model):
    """Configuración de permisos por rol para módulos y acciones del sistema."""

    PERMISSION_KEYS = (
        'users.manage',
        'roles.manage',
        'inventory.view',
        'inventory.manage',
        'products.view',
        'products.manage',
        'service_orders.view',
        'service_orders.manage',
        'reception.view',
        'reception.manage',
        'despachos.view',
        'despachos.manage',
        'solicitantes.view',
        'solicitantes.manage',
        'locations.view',
        'locations.manage',
        'catalogs.view',
        'catalogs.manage',
        'audit.view',
        'reports.export',
    )

    role = models.CharField(max_length=20, choices=User.Role.choices, unique=True)
    permissions = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['role']
        verbose_name = 'permiso por rol'
        verbose_name_plural = 'permisos por rol'

    def __str__(self):
        return f"Permisos de {self.role}"

    @classmethod
    def default_permissions_for_role(cls, role):
        base = {key: False for key in cls.PERMISSION_KEYS}

        if role == User.Role.ADMIN:
            return {key: True for key in cls.PERMISSION_KEYS}

        if role == User.Role.ALMACENISTA:
            allowed = {
                'inventory.view',
                'inventory.manage',
                'products.view',
                'products.manage',
                'service_orders.view',
                'service_orders.manage',
                'reception.view',
                'reception.manage',
                'despachos.view',
                'despachos.manage',
                'solicitantes.view',
                'solicitantes.manage',
                'locations.view',
                'locations.manage',
                'catalogs.view',
                'catalogs.manage',
                'reports.export',
            }
            for key in allowed:
                base[key] = True
            return base

        if role == User.Role.TECNICO:
            allowed = {
                'inventory.view',
                'products.view',
                'service_orders.view',
                'service_orders.manage',
                'solicitantes.view',
            }
            for key in allowed:
                base[key] = True
            return base

        return base

    @classmethod
    def ensure_defaults(cls):
        for role in User.Role.values:
            obj, created = cls.objects.get_or_create(
                role=role,
                defaults={'permissions': cls.default_permissions_for_role(role)},
            )
            if created:
                continue

            changed = False
            merged = dict(obj.permissions or {})
            for key, value in cls.default_permissions_for_role(role).items():
                if key not in merged:
                    merged[key] = value
                    changed = True

            invalid_keys = [key for key in merged.keys() if key not in cls.PERMISSION_KEYS]
            if invalid_keys:
                for key in invalid_keys:
                    merged.pop(key, None)
                changed = True

            if changed:
                obj.permissions = merged
                obj.save(update_fields=['permissions', 'updated_at'])

    @classmethod
    def get_permissions_for_role(cls, role):
        """Return merged permissions for a role, falling back to defaults if row is missing."""
        cls.ensure_defaults()
        try:
            obj = cls.objects.only('permissions').get(role=role)
            merged = cls.default_permissions_for_role(role)
            merged.update(obj.permissions or {})
            return merged
        except cls.DoesNotExist:
            return cls.default_permissions_for_role(role)

    @classmethod
    def get_permissions_for_user(cls, user):
        if not user or not getattr(user, 'is_authenticated', False):
            return {}
        return cls.get_permissions_for_role(user.role)

    @classmethod
    def has_user_permission(cls, user, permission_key):
        return bool(cls.get_permissions_for_user(user).get(permission_key, False))
