from django.db import migrations


def add_state_snapshot_column(apps, schema_editor):
    if schema_editor.connection.vendor != 'sqlite':
        schema_editor.execute("ALTER TABLE inventory_installationrecord ADD COLUMN IF NOT EXISTS state_snapshot varchar(100) NOT NULL DEFAULT ''")
        return

    table_name = 'inventory_installationrecord'
    columns = schema_editor.connection.introspection.get_columns(table_name)
    if any(column['name'] == 'state_snapshot' for column in columns):
        return

    schema_editor.execute(f'ALTER TABLE {table_name} ADD COLUMN state_snapshot varchar(100) NOT NULL DEFAULT ""')


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0018_installationrecord_serial_number_and_more'),
    ]

    operations = [
        migrations.RunPython(add_state_snapshot_column, migrations.RunPython.noop),
    ]