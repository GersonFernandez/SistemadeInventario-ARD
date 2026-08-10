from django.db import migrations


def enable_tecnico_service_order_manage(apps, schema_editor):
    RolePermission = apps.get_model('accounts', 'RolePermission')

    try:
        rp = RolePermission.objects.get(role='tecnico')
    except RolePermission.DoesNotExist:
        return

    permissions = dict(rp.permissions or {})
    if permissions.get('service_orders.manage') is True:
        return

    permissions['service_orders.manage'] = True
    rp.permissions = permissions
    rp.save(update_fields=['permissions', 'updated_at'])


def disable_tecnico_service_order_manage(apps, schema_editor):
    RolePermission = apps.get_model('accounts', 'RolePermission')

    try:
        rp = RolePermission.objects.get(role='tecnico')
    except RolePermission.DoesNotExist:
        return

    permissions = dict(rp.permissions or {})
    if permissions.get('service_orders.manage') is False:
        return

    permissions['service_orders.manage'] = False
    rp.permissions = permissions
    rp.save(update_fields=['permissions', 'updated_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0004_rolepermission'),
    ]

    operations = [
        migrations.RunPython(enable_tecnico_service_order_manage, disable_tecnico_service_order_manage),
    ]
