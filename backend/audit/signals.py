from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.db.migrations.recorder import MigrationRecorder
from .models import AuditLog
from .middleware import get_current_request

SENSITIVE_FIELDS = {'password'}


def _format_dirty(instance, dirty):
    """Normalize get_dirty_fields() output into {field: {old, new}}.

    django-dirtyfields' get_dirty_fields() returns {field: saved_value}.
    We need to also read the current value via getattr() to capture 'new'.
    """
    result = {}
    for field, saved_value in (dirty or {}).items():
        if field in SENSITIVE_FIELDS:
            result[field] = {'old': '[REDACTED]', 'new': '[REDACTED]'}
            continue
        try:
            current_value = getattr(instance, field, None)
        except Exception:
            current_value = None
        result[field] = {
            'old': None if saved_value is None else str(saved_value),
            'new': None if current_value is None else str(current_value),
        }
    return result


@receiver(post_save)
def log_save(sender, instance, created, **kwargs):
    if sender == AuditLog or sender == MigrationRecorder.Migration:
        return

    request = get_current_request()
    user = request.user if request and request.user.is_authenticated else None
    ip = request.META.get('REMOTE_ADDR') if request else None

    action = AuditLog.Action.CREATE if created else AuditLog.Action.UPDATE
    changes = {}
    if not created and hasattr(instance, 'get_dirty_fields'):
        try:
            dirty = instance.get_dirty_fields()
            changes = _format_dirty(instance, dirty)
        except Exception:
            changes = {}

    AuditLog.objects.create(
        action=action,
        model_name=f"{sender._meta.app_label}.{sender._meta.model_name}",
        object_id=str(instance.pk),
        changes=changes,
        user=user,
        ip_address=ip,
    )


@receiver(post_delete)
def log_delete(sender, instance, **kwargs):
    if sender == AuditLog or sender == MigrationRecorder.Migration:
        return

    request = get_current_request()
    user = request.user if request and request.user.is_authenticated else None
    ip = request.META.get('REMOTE_ADDR') if request else None

    snapshot = {}
    for field in instance._meta.fields:
        if field.name in SENSITIVE_FIELDS:
            snapshot[field.name] = '[REDACTED]'
            continue
        try:
            value = getattr(instance, field.name)
            snapshot[field.name] = str(value) if value is not None else None
        except Exception:
            snapshot[field.name] = None

    AuditLog.objects.create(
        action=AuditLog.Action.DELETE,
        model_name=f"{sender._meta.app_label}.{sender._meta.model_name}",
        object_id=str(instance.pk),
        changes={'snapshot': snapshot},
        user=user,
        ip_address=ip,
    )
