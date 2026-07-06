from django.db import migrations
from django.db.models import Count


def merge_duplicate_parts(apps, schema_editor):
    WorkOrderPart = apps.get_model('workorders', 'WorkOrderPart')
    AuditLog = apps.get_model('audit', 'AuditLog')

    duplicates = (
        WorkOrderPart.objects
        .exclude(status='rejected')
        .values('work_order_id', 'item_id')
        .annotate(c=Count('id'))
        .filter(c__gt=1)
    )

    for dup in duplicates:
        parts = list(
            WorkOrderPart.objects
            .filter(work_order_id=dup['work_order_id'], item_id=dup['item_id'])
            .exclude(status='rejected')
            .order_by('-created_at')
        )

        if len(parts) <= 1:
            continue

        keeper = parts[0]
        total_qty = sum(p.quantity_requested for p in parts)
        approved_qty = sum(
            p.quantity_approved or 0 for p in parts if p.status == 'approved'
        )

        for extra in parts[1:]:
            extra.status = 'rejected'
            extra.save(update_fields=['status'])
            AuditLog.objects.create(
                action='UPDATE',
                model_name='workorders.workorderpart',
                object_id=str(extra.pk),
                changes={'status': {'old': extra.status, 'new': 'rejected'}},
                user=None,
                ip_address=None,
            )

        if total_qty != keeper.quantity_requested:
            old_qty = keeper.quantity_requested
            keeper.quantity_requested = total_qty
            if keeper.status == 'approved' and approved_qty:
                keeper.quantity_approved = approved_qty
            keeper.save(update_fields=['quantity_requested', 'quantity_approved'])
            AuditLog.objects.create(
                action='UPDATE',
                model_name='workorders.workorderpart',
                object_id=str(keeper.pk),
                changes={'quantity_requested': {'old': old_qty, 'new': total_qty}},
                user=None,
                ip_address=None,
            )


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('workorders', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(merge_duplicate_parts, noop_reverse),
    ]
