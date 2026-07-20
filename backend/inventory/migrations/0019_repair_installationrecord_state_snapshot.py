from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0018_installationrecord_serial_number_and_more'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                "ALTER TABLE inventory_installationrecord "
                "ADD COLUMN IF NOT EXISTS state_snapshot varchar(100) NOT NULL DEFAULT '';"
            ),
            reverse_sql=(
                "ALTER TABLE inventory_installationrecord "
                "DROP COLUMN IF EXISTS state_snapshot;"
            ),
        ),
    ]