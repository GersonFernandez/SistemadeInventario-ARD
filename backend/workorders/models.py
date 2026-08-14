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


class DespachoAttachment(models.Model):
    class AttachmentType(models.TextChoices):
        EVIDENCIA = 'evidencia', 'Evidencia'
        COMPROBANTE = 'comprobante', 'Comprobante'

    despacho = models.ForeignKey(
        Despacho,
        on_delete=models.CASCADE,
        related_name='attachments',
    )
    file = models.FileField(upload_to='despachos/attachments/%Y/%m/%d/')
    attachment_type = models.CharField(max_length=20, choices=AttachmentType.choices)
    description = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='despacho_attachments_uploaded',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'adjunto de despacho'
        verbose_name_plural = 'adjuntos de despacho'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.despacho.ot_number} - {self.attachment_type}"


class ServiceOrder(DirtyFieldsMixin, models.Model):
    """Orden de servicio técnico para equipos registrados en inventario."""

    class ServiceType(models.TextChoices):
        REPARACION = 'reparacion', 'Reparación'
        INSTALACION = 'instalacion', 'Instalación'
        MANTENIMIENTO = 'mantenimiento', 'Mantenimiento'

    class EquipmentCondition(models.TextChoices):
        NUEVO = 'nuevo', 'Nuevo'
        USADO = 'usado', 'Usado'

    class Status(models.TextChoices):
        RECIBIDO = 'recibido', 'Recibido'
        EN_DIAGNOSTICO = 'en_diagnostico', 'En diagnóstico'
        EN_PROCESO = 'en_proceso', 'En proceso'
        PENDIENTE_REPUESTO = 'pendiente_repuesto', 'Pendiente repuesto'
        COMPLETADO = 'completado', 'Completado'
        ENTREGADO = 'entregado', 'Entregado'
        CANCELADO = 'cancelado', 'Cancelado'

    service_number = models.CharField(
        max_length=20,
        unique=True,
        editable=False,
        help_text='Número correlativo del servicio (formato SRV-YYYY-XXXXX)',
    )
    service_type = models.CharField(max_length=20, choices=ServiceType.choices)
    equipment = models.ForeignKey(
        'inventory.Item',
        on_delete=models.PROTECT,
        related_name='service_orders',
        help_text='Equipo previamente registrado en inventario',
    )
    equipment_serial_number = models.CharField(
        max_length=100,
        blank=True,
        help_text='Número de serial del equipo específico recibido para servicio.',
    )
    equipment_condition = models.CharField(
        max_length=10,
        choices=EquipmentCondition.choices,
        default=EquipmentCondition.USADO,
    )
    equipment_name_snapshot = models.CharField(max_length=200, blank=True)
    equipment_brand_snapshot = models.CharField(max_length=100, blank=True)
    equipment_model_snapshot = models.CharField(max_length=100, blank=True)
    equipment_description_snapshot = models.TextField(blank=True)
    assigned_technician = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_service_orders',
        help_text='Técnico responsable del servicio',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='created_service_orders',
    )
    unit = models.ForeignKey(
        'inventory.Location',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='service_orders',
        help_text='Unidad o dependencia solicitante',
    )
    recipient_first_name = models.CharField(
        max_length=120,
        blank=True,
        help_text='Nombre de la persona para quien se realiza la orden (opcional).',
    )
    recipient_last_name = models.CharField(
        max_length=120,
        blank=True,
        help_text='Apellido de la persona para quien se realiza la orden (opcional).',
    )
    recipient_id_card = models.CharField(
        max_length=30,
        blank=True,
        help_text='Cédula/identificación de la persona para quien se realiza la orden (opcional).',
    )
    recipient_rank_position = models.CharField(
        max_length=120,
        blank=True,
        help_text='Rango o cargo de la persona para quien se realiza la orden (opcional).',
    )
    status = models.CharField(max_length=25, choices=Status.choices, default=Status.RECIBIDO)
    diagnosis = models.TextField(blank=True)
    work_performed = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    received_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    signed_receipt = models.FileField(
        upload_to='service_orders/signed_receipts/%Y/%m/%d/',
        null=True,
        blank=True,
        help_text='Comprobante de cierre firmado por el destinatario.',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'orden de servicio'
        verbose_name_plural = 'órdenes de servicio'
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['service_type', 'status']),
            models.Index(fields=['assigned_technician', 'status']),
        ]

    def __str__(self):
        return f"{self.service_number} - {self.get_service_type_display()}"

    def save(self, *args, **kwargs):
        if not self.service_number:
            self.service_number = self.generate_service_number()

        if self.equipment_id:
            self.equipment_name_snapshot = self.equipment.name or ''
            self.equipment_brand_snapshot = (
                (self.equipment.brand.name if self.equipment.brand else '') or self.equipment.marca or ''
            )
            self.equipment_model_snapshot = (
                (self.equipment.product_model.name if self.equipment.product_model else '') or self.equipment.modelo or ''
            )
            self.equipment_description_snapshot = self.equipment.description or ''
            self.equipment_serial_number = (self.equipment_serial_number or '').strip()

        super().save(*args, **kwargs)

    @classmethod
    @transaction.atomic
    def generate_service_number(cls):
        from django.utils import timezone as tz
        from django.db import connection

        year = tz.now().year
        prefix = f"SRV-{year}-"
        qs = cls.objects.filter(service_number__startswith=prefix).order_by('-service_number')
        if connection.vendor != 'sqlite':
            qs = qs.select_for_update()
        last = qs.first()

        next_sequence = 1
        if last:
            suffix = last.service_number[len(prefix):]
            try:
                next_sequence = int(suffix) + 1
            except (ValueError, TypeError):
                next_sequence = 1

        return f"{prefix}{next_sequence:05d}"


class ServiceOrderItem(models.Model):
    """Línea de producto asociada a una orden de servicio."""

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name='items',
    )
    item = models.ForeignKey(
        'inventory.Item',
        on_delete=models.PROTECT,
        related_name='service_order_items',
        help_text='Producto base registrado incluido en esta orden.',
    )
    serial_number = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    equipment_condition = models.CharField(
        max_length=10,
        choices=ServiceOrder.EquipmentCondition.choices,
        default=ServiceOrder.EquipmentCondition.USADO,
    )
    item_name_snapshot = models.CharField(max_length=200, blank=True)
    item_brand_snapshot = models.CharField(max_length=100, blank=True)
    item_model_snapshot = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'línea de orden de servicio'
        verbose_name_plural = 'líneas de orden de servicio'
        ordering = ['id']
        indexes = [
            models.Index(fields=['service_order', 'equipment_condition']),
            models.Index(fields=['serial_number']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['service_order', 'item', 'serial_number'],
                name='uniq_service_order_item_serial',
            ),
        ]

    def __str__(self):
        return f"{self.service_order.service_number} - {self.item_name_snapshot or self.item.name} ({self.serial_number})"

    def save(self, *args, **kwargs):
        self.serial_number = (self.serial_number or '').strip()
        if self.item_id:
            self.item_name_snapshot = self.item.name or ''
            self.item_brand_snapshot = (
                (self.item.brand.name if self.item.brand else '') or self.item.marca or ''
            )
            self.item_model_snapshot = (
                (self.item.product_model.name if self.item.product_model else '') or self.item.modelo or ''
            )
        super().save(*args, **kwargs)


class ServiceOrderLog(models.Model):
    """Bitácora de eventos y notas de una orden de servicio."""

    service_order = models.ForeignKey(
        ServiceOrder,
        on_delete=models.CASCADE,
        related_name='logs',
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='service_order_logs',
    )
    event = models.CharField(max_length=40, default='note')
    from_status = models.CharField(max_length=25, blank=True)
    to_status = models.CharField(max_length=25, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'bitácora de orden de servicio'
        verbose_name_plural = 'bitácoras de órdenes de servicio'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.service_order.service_number} - {self.event}"
