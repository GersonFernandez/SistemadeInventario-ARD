from django.db import migrations


def add_state_snapshot_column(apps, schema_editor):
    table_name = 'inventory_installationrecord'

    if schema_editor.connection.vendor != 'sqlite':
        schema_editor.execute(
            f"ALTER TABLE {table_name} ADD COLUMN IF NOT EXISTS state_snapshot varchar(100) NOT NULL DEFAULT ''"
        )
        return

    cursor = schema_editor.connection.cursor()
    cursor.execute(f'PRAGMA table_info({table_name})')
    columns = [row[1] for row in cursor.fetchall()]
    if 'state_snapshot' in columns:
        return

    schema_editor.execute(f'ALTER TABLE {table_name} ADD COLUMN state_snapshot varchar(100) NOT NULL DEFAULT ""')


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0018_installationrecord_serial_number_and_more'),
    ]

    operations = [
        migrations.RunPython(add_state_snapshot_column, migrations.RunPython.noop),
    ]