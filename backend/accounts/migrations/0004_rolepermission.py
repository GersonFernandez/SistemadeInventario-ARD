from django.db import migrations, models


def seed_role_permissions(apps, schema_editor):
    User = apps.get_model('accounts', 'User')
    RolePermission = apps.get_model('accounts', 'RolePermission')

    permission_keys = [
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
    ]

    def defaults_for_role(role):
        base = {key: False for key in permission_keys}
        if role == 'admin':
            return {key: True for key in permission_keys}
        if role == 'almacenista':
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
        if role == 'tecnico':
            allowed = {
                'inventory.view',
                'products.view',
                'service_orders.view',
                'solicitantes.view',
            }
            for key in allowed:
                base[key] = True
            return base
        return base

    role_choices = User._meta.get_field('role').choices
    for role, _label in role_choices:
        RolePermission.objects.get_or_create(
            role=role,
            defaults={'permissions': defaults_for_role(role)},
        )


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_user_must_change_password'),
    ]

    operations = [
        migrations.CreateModel(
            name='RolePermission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('admin', 'Administrador'), ('almacenista', 'Encargado de Inventario'), ('tecnico', 'Técnico')], max_length=20, unique=True)),
                ('permissions', models.JSONField(default=dict)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'permiso por rol',
                'verbose_name_plural': 'permisos por rol',
                'ordering': ['role'],
            },
        ),
        migrations.RunPython(seed_role_permissions, migrations.RunPython.noop),
    ]
