from django.db import models, transaction
from django.core.validators import MinValueValidator
from django.conf import settings
from dirtyfields import DirtyFieldsMixin


class Solicitante(DirtyFieldsMixin, models.Model):
    """Persona o unidad que solicita un despacho de almacén.

    Puede ser un oficial, suboficial, marinero, o una dependencia/unidad naval
    que requiera consumibles o herramientas. Se crea 'on-the-fly' desde el
    formulario de despacho con autocomplete.
    """

    name = models.CharField(max_length=150, help_text='Nombre completo del solicitante')
    rank = models.CharField(max_length=50, blank=True, help_text='Rango o grado militar (opcional)')
    unit = models.ForeignKey(
        'inventory.Location',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='solicitantes',
        help_text='Unidad/base de procedencia',
    )
    agent_id = models.CharField(max_length=30, blank=True, help_text='Cédula militar o ID (opcional)')
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'solicitante'
        verbose_name_plural = 'solicitantes'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
        ]

    def __str__(self):
        if self.rank:
            return f"{self.rank} {self.name}"
        return self.name

    @property
    def full_name(self):
        return f"{self.rank} {self.name}".strip() if self.rank else self.name


class Despacho(DirtyFieldsMixin, models.Model):
    """Vale de despacho de almacén: entrega de items a un solicitante.

    Se crea y ejecuta en un solo paso (despacho inmediato). Al confirmarse,
    se descuentan las cantidades de stock (consumibles) o se marcan las
    unidades como Asignado (herramientas serializadas).
    """

    class Status(models.TextChoices):
        ISSUED = 'issued', 'Despachado'
        CANCELLED = 'cancelled', 'Anulado'

    ot_number = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        help_text='Número correlativo del despacho (formato DV-YYYY-XXXXX)',
    )
    solicitante = models.ForeignKey(
        Solicitante,
        on_delete=models.PROTECT,
        related_name='despachos',
        help_text='Persona o unidad que recibe el despacho',
    )
    unit = models.ForeignKey(
        'inventory.Location',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='despachos_recibidos',
        help_text='Unidad/buque de procedencia del solicitante (opcional)',
    )
    delivered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='despachos_entregados',
        help_text='Usuario del taller que entrega (auto desde sesión)',
    )
    issued_at = models.DateTimeField(
        auto_now_add=True,
        help_text='Fecha y hora del despacho',
    )
    equipment_reference = models.CharField(
        max_length=255,
        blank=True,
        help_text='Referencia libre al equipo o sistema destino (opcional)',
    )
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ISSUED,
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='despachos_anulados',
    )
    cancellation_reason = models.TextField(blank=True)

    class Meta:
        verbose_name = 'despacho'
        verbose_name_plural = 'despachos'
        ordering = ['-issued_at']
        indexes = [
            models.Index(fields=['status', '-issued_at']),
            models.Index(fields=['solicitante', '-issued_at']),
        ]

    def __str__(self):
        return f"{self.ot_number} → {self.solicitante.name}"

    def save(self, *args, **kwargs):
        if not self.ot_number:
            self.ot_number = self.generate_despacho_number()
        super().save(*args, **kwargs)

    @classmethod
    @transaction.atomic
    def generate_despacho_number(cls):
        from django.utils import timezone as tz
        from django.db import connection

        year = tz.now().year
        prefix = f"DV-{year}-"

        qs = cls.objects.filter(ot_number__startswith=prefix).order_by('-ot_number')
        if connection.vendor != 'sqlite':
            qs = qs.select_for_update()
        last = qs.first()

        next_sequence = 1
        if last:
            suffix = last.ot_number[len(prefix):]
            try:
                next_sequence = int(suffix) + 1
            except (ValueError, TypeError):
                next_sequence = 1

        return f"{prefix}{next_sequence:05d}"

    def is_cancelled(self):
        return self.status == self.Status.CANCELLED


class LineaDespacho(DirtyFieldsMixin, models.Model):
    """Línea de un despacho: un item (consumible) o una unidad física (herramienta)."""

    despacho = models.ForeignKey(
        Despacho,
        on_delete=models.CASCADE,
        related_name='lineas',
    )
    item = models.ForeignKey(
        'inventory.Item',
        on_delete=models.PROTECT,
        related_name='lineas_despacho',
    )
    item_unit = models.ForeignKey(
        'inventory.ItemUnit',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='lineas_despacho',
        help_text='Unidad física específica (solo para herramientas serializadas)',
    )
    quantity = models.PositiveIntegerField(
        validators=[MinValueValidator(1)],
        help_text='Cantidad despachada (1 para herramientas)',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'línea de despacho'
        verbose_name_plural = 'líneas de despacho'
        ordering = ['id']

    def __str__(self):
        if self.item_unit:
            return f"{self.item.name} [{self.item_unit.serial_number}] x{self.quantity}"
        return f"{self.item.name} x{self.quantity}"

    def is_serialized(self):
        return self.item_unit_id is not None
