from django.db import models
from django.core.validators import MinValueValidator
from django.conf import settings
from django.utils import timezone
from dirtyfields import DirtyFieldsMixin


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True)
    abbreviation = models.CharField(max_length=4, default='CAT', help_text='Abreviatura de 3-4 letras (e.g., COM, CON, SOL, FER)')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'categoría'
        verbose_name_plural = 'categorías'
        ordering = ['name']

    def __str__(self):
        return self.name


class Brand(models.Model):
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'marca'
        verbose_name_plural = 'marcas'

    def __str__(self):
        return self.name


class ProductModel(models.Model):
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name='models')
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['brand__name', 'name']
        verbose_name = 'modelo'
        verbose_name_plural = 'modelos'
        constraints = [
            models.UniqueConstraint(fields=['brand', 'name'], name='unique_product_model_per_brand'),
        ]

    def __str__(self):
        return f"{self.brand.name} - {self.name}"


class ProductState(models.Model):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'estado de producto'
        verbose_name_plural = 'estados de producto'

    def __str__(self):
        return self.name


class UnitMeasure(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=80, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'unidad de medida'
        verbose_name_plural = 'unidades de medida'

    def __str__(self):
        return self.name


class LocationType(models.Model):
    """Tipo de ubicación (taller, base naval, unidad naval, etc.).

    Gestionable desde la UI. Mantiene el catálogo flexible sin migraciones de modelo.
    """

    code = models.CharField(
        max_length=30,
        unique=True,
        help_text='Código interno (e.g., "taller", "base_naval", "buque")',
    )
    name = models.CharField(
        max_length=100,
        help_text='Nombre visible (e.g., "Taller de Electrónica", "Buque")',
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'tipo de ubicación'
        verbose_name_plural = 'tipos de ubicación'
        ordering = ['name']

    def __str__(self):
        return self.name


class Location(models.Model):
    name = models.CharField(max_length=200)
    codigo = models.CharField(
        max_length=20,
        blank=True,
        help_text='Código interno de referencia (opcional)',
    )
    location_type = models.ForeignKey(
        LocationType,
        on_delete=models.PROTECT,
        related_name='locations',
        help_text='Tipo de ubicación (taller, base naval, etc.)',
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'ubicación'
        verbose_name_plural = 'ubicaciones'
        ordering = ['location_type__name', 'name']

    def __str__(self):
        type_name = self.location_type.name if self.location_type else 'Sin tipo'
        return f"{type_name} - {self.name}"

    def get_breadcrumb(self):
        parts = [self.name]
        parent = self.parent
        while parent:
            parts.insert(0, parent.name)
            parent = parent.parent
        return ' > '.join(parts)


class Item(DirtyFieldsMixin, models.Model):
    class DocumentType(models.TextChoices):
        OFICIO = 'oficio', 'Oficio'
        CONDUCE = 'conduce', 'Conduce'
        FACTURA = 'factura', 'Factura'
        DIRECTO = 'directo', 'Directo'
        LEGADO = 'legado', 'Legado'

    class Kind(models.TextChoices):
        CONSUMIBLE = 'consumible', 'Consumible / Repuesto'
        HERRAMIENTA = 'herramienta', 'Herramienta / Instrumento'

    name = models.CharField(max_length=200)
    code = models.CharField(
        max_length=20,
        unique=True,
        blank=True,
        null=True,
        help_text='Código auto-generado (e.g., COM-001)',
    )
    sku = models.CharField(
        max_length=100,
        unique=True,
        blank=True,
        null=True,
        help_text='SKU del sistema anterior (legado)',
    )
    part_number = models.CharField(max_length=100, blank=True)
    brand = models.ForeignKey(
        Brand,
        on_delete=models.SET_NULL,
        related_name='items',
        null=True,
        blank=True,
    )
    product_model = models.ForeignKey(
        ProductModel,
        on_delete=models.SET_NULL,
        related_name='items',
        null=True,
        blank=True,
    )
    state = models.ForeignKey(
        ProductState,
        on_delete=models.SET_NULL,
        related_name='items',
        null=True,
        blank=True,
    )
    marca = models.CharField(
        max_length=100,
        blank=True,
        help_text='Marca del fabricante (opcional, ej: Motorola, Harris)',
    )
    modelo = models.CharField(
        max_length=100,
        blank=True,
        help_text='Modelo del fabricante (opcional)',
    )
    numero_serie = models.CharField(
        max_length=100,
        blank=True,
        help_text='Número de serie del activo (opcional)',
    )
    category = models.ForeignKey(
        Category,
        on_delete=models.PROTECT,
        related_name='items',
    )
    description = models.TextField(blank=True)
    application = models.CharField(
        max_length=255,
        blank=True,
        help_text='Equipo o sistema donde se aplica (e.g., Radar AN/SPS-67)',
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.SET_NULL,
        related_name='items',
        null=True,
        blank=True,
    )
    quantity = models.PositiveIntegerField(default=0, validators=[MinValueValidator(0)])
    minimum_stock = models.PositiveIntegerField(default=0)
    unit = models.ForeignKey(
        UnitMeasure,
        on_delete=models.PROTECT,
        related_name='items',
        null=True,
        blank=True,
        help_text='Unidad de medida del producto',
    )
    kind = models.CharField(
        max_length=20,
        choices=Kind.choices,
        default=Kind.CONSUMIBLE,
        help_text='Consumible (se descuenta de quantity) o herramienta (se rastrea por ItemUnit con serial)',
    )
    track_by_serial = models.BooleanField(
        default=False,
        help_text='Si True, el stock se cuenta por unidades físicas con serial (ItemUnit). Solo aplica a kind=herramienta.',
    )
    image = models.ImageField(upload_to='items/%Y/%m/', blank=True, null=True)
    is_base_product = models.BooleanField(
        default=True,
        help_text='Indica si este artículo forma parte del catálogo base para recepción, instalación, reparación y servicios.',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'artículo'
        verbose_name_plural = 'artículos'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.code or self.sku or self.part_number or 'sin código'})"

    @property
    def is_critical(self):
        return self.minimum_stock > 0 and self.stock_available <= self.minimum_stock

    @property
    def stock_available(self):
        """Stock disponible: usa quantity para consumibles, count(units available) para herramientas serializadas."""
        if self.track_by_serial:
            return self.units.filter(status=ItemUnit.Status.AVAILABLE).count()
        return self.quantity

    @property
    def stock_asignado(self):
        if self.track_by_serial:
            return self.units.filter(status=ItemUnit.Status.ASIGNADO).count()
        return 0


class StockMovement(DirtyFieldsMixin, models.Model):
    class MovementType(models.TextChoices):
        ENTRY = 'entry', 'Entrada'
        EXIT = 'exit', 'Salida'

    class DocumentType(models.TextChoices):
        OFICIO = 'oficio', 'Oficio'
        CONDUCE = 'conduce', 'Conduce'
        FACTURA = 'factura', 'Factura'
        DIRECTO = 'directo', 'Directo'
        LEGADO = 'legado', 'Legado'

    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name='movements',
    )
    movement_type = models.CharField(max_length=10, choices=MovementType.choices)
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    document_type = models.CharField(
        max_length=20,
        choices=DocumentType.choices,
        blank=True,
        help_text='Tipo de documento que respalda el movimiento',
    )
    document_number = models.CharField(
        max_length=100,
        blank=True,
        help_text='Número de oficio, conduce o factura',
    )
    document_file = models.FileField(
        upload_to='movements/%Y/%m/',
        blank=True,
        null=True,
        help_text='Archivo digitalizado del documento',
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'movimiento de stock'
        verbose_name_plural = 'movimientos de stock'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_movement_type_display()} {self.quantity} x {self.item.name}"


class Transfer(DirtyFieldsMixin, models.Model):
    class Status(models.TextChoices):
        PENDIENTE = 'pendiente', 'Pendiente'
        EN_TRANSITO = 'en_transito', 'En tránsito'
        COMPLETADA = 'completada', 'Completada'
        RECHAZADA = 'rechazada', 'Rechazada'

    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name='transfers',
    )
    origin_location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='transfers_origin',
        null=True,
        blank=True,
        help_text='Ubicación de origen (nulo si es asignación inicial)',
    )
    destination_location = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='transfers_destination',
    )
    quantity = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(1)],
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='transfers_requested',
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='transfers_approved',
        null=True,
        blank=True,
        help_text='Almacenista que aprobó el traslado',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDIENTE,
    )
    document_type = models.CharField(
        max_length=20,
        blank=True,
        choices=StockMovement.DocumentType.choices,
    )
    document_number = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'traslado'
        verbose_name_plural = 'traslados'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['item', '-created_at']),
            models.Index(fields=['origin_location', '-created_at']),
            models.Index(fields=['destination_location', '-created_at']),
            models.Index(fields=['status', '-created_at']),
        ]

    def __str__(self):
        origin = self.origin_location.name if self.origin_location else 'Inicial'
        return f"{self.item.name}: {origin} → {self.destination_location.name}"


class ItemUnit(DirtyFieldsMixin, models.Model):
    """Unidad física individual de un item con serial (e.g., Multímetro SN-12345).

    Solo aplica a items con track_by_serial=True (típicamente herramientas).
    """

    class Status(models.TextChoices):
        AVAILABLE = 'available', 'Disponible'
        ASIGNADO = 'asignado', 'Asignado'
        MAINTENANCE = 'maintenance', 'En Reparación'
        DISPOSED = 'disposed', 'Descargado'

    item = models.ForeignKey(
        Item,
        on_delete=models.CASCADE,
        related_name='units',
    )
    serial_number = models.CharField(
        max_length=100,
        help_text='Número de serie físico de la unidad',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.AVAILABLE,
    )
    notes = models.TextField(blank=True)
    acquired_at = models.DateTimeField(auto_now_add=True)
    disposed_at = models.DateTimeField(null=True, blank=True)
    disposal_reason = models.TextField(blank=True)

    class Meta:
        verbose_name = 'unidad física'
        verbose_name_plural = 'unidades físicas'
        ordering = ['item', 'serial_number']
        constraints = [
            models.UniqueConstraint(
                fields=['item', 'serial_number'],
                name='unique_item_unit_serial',
            ),
        ]

    def __str__(self):
        return f"{self.item.name} [{self.serial_number}]"

    def dispose(self, reason=''):
        from django.utils import timezone
        if self.status == self.Status.DISPOSED:
            raise ValueError('Esta unidad ya está dada de baja.')
        if self.status == self.Status.ASIGNADO:
            raise ValueError('No se puede dar de baja una unidad actualmente asignada. Devuélvala primero.')
        self.status = self.Status.DISPOSED
        self.disposed_at = timezone.now()
        if reason:
            self.disposal_reason = reason
        self.save()

    def assign(self, user_session):
        if self.status != self.Status.AVAILABLE:
            raise ValueError(f'Solo se pueden asignar unidades disponibles (estado actual: {self.status}).')
        self.status = self.Status.ASIGNADO
        self.save()

    def return_to_stock(self):
        if self.status != self.Status.ASIGNADO:
            raise ValueError(f'Solo se pueden devolver unidades asignadas (estado actual: {self.status}).')
        self.status = self.Status.AVAILABLE
        self.save()


class ItemLoan(DirtyFieldsMixin, models.Model):
    """Préstamo de una unidad física (ItemUnit) a un solicitante.

    El stock NO se descuenta de Item.quantity (las herramientas se prestan, no se consumen).
    Al prestarse, ItemUnit.status pasa a ASIGNADO. Al devolverse, vuelve a AVAILABLE.
    """

    item_unit = models.ForeignKey(
        ItemUnit,
        on_delete=models.PROTECT,
        related_name='loans',
    )
    loaned_to = models.ForeignKey(
        'workorders.Solicitante',
        on_delete=models.PROTECT,
        related_name='tool_loans',
        null=True,
        blank=True,
        help_text='Persona/unidad que recibe la herramienta',
    )
    loaned_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='item_loans',
        null=True,
        blank=True,
        help_text='Usuario del sistema que recibe (técnico del taller)',
    )
    loaned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='item_loans_approved',
    )
    loaned_at = models.DateTimeField(auto_now_add=True)
    expected_return_at = models.DateTimeField()
    returned_at = models.DateTimeField(null=True, blank=True)
    returned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='item_loans_received',
        null=True,
        blank=True,
    )
    notes = models.TextField(blank=True)

    class Meta:
        verbose_name = 'préstamo de unidad'
        verbose_name_plural = 'préstamos de unidades'
        ordering = ['-loaned_at']
        constraints = [
            models.UniqueConstraint(
                fields=['item_unit'],
                condition=models.Q(returned_at__isnull=True),
                name='unique_active_loan_per_unit',
            ),
        ]

    def __str__(self):
        recipient = self.loaned_to.name if self.loaned_to else (self.loaned_to_user.name if self.loaned_to_user else '?')
        return f"{self.item_unit} → {recipient}"

    def is_overdue(self):
        from django.utils import timezone
        if self.returned_at:
            return False
        return timezone.now() > self.expected_return_at

    def return_unit(self, user):
        from django.utils import timezone
        if self.returned_at:
            raise ValueError('Esta unidad ya fue devuelta.')
        self.returned_at = timezone.now()
        self.returned_to = user
        self.save()
        self.item_unit.return_to_stock()

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        if is_new:
            self.item_unit.assign(user_session=self.loaned_by)


class RepairRecord(DirtyFieldsMixin, models.Model):
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='repair_records')
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='repairs')
    details = models.TextField()
    repaired_at = models.DateTimeField(default=timezone.now)
    attachment = models.FileField(upload_to='repairs/%Y/%m/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-repaired_at']
        verbose_name = 'reparación'
        verbose_name_plural = 'reparaciones'

    def __str__(self):
        return f"Reparación {self.item.name} por {self.technician.name}"


class InstallationRecord(DirtyFieldsMixin, models.Model):
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='installation_records')
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='installations')
    location = models.ForeignKey(Location, on_delete=models.PROTECT, related_name='installations')
    serial_number = models.CharField(max_length=100, blank=True)
    state_snapshot = models.CharField(max_length=100, blank=True)
    installed_at = models.DateTimeField(default=timezone.now)
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-installed_at']
        verbose_name = 'instalación'
        verbose_name_plural = 'instalaciones'

    def __str__(self):
        return f"Instalación {self.item.name} en {self.location.name}"


class EntradaProducto(DirtyFieldsMixin, models.Model):
    class Tipo(models.TextChoices):
        NUEVO = 'nuevo', 'Nuevo'
        USADO = 'usado', 'Usado/Reparación'

    reception_id = models.CharField(max_length=40, db_index=True)
    marca = models.ForeignKey(Brand, on_delete=models.PROTECT, related_name='entradas_producto')
    modelo = models.ForeignKey(ProductModel, on_delete=models.PROTECT, related_name='entradas_producto')
    categoria = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='entradas_producto')
    base_product = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name='entradas_producto',
        null=True,
        blank=True,
        help_text='Producto base registrado al que corresponde esta recepción.',
    )
    tipo = models.CharField(max_length=20, choices=Tipo.choices)
    cantidad = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    seriales = models.JSONField(default=list, blank=True)
    ubicacion = models.ForeignKey(
        Location,
        on_delete=models.PROTECT,
        related_name='entradas_producto',
        null=True,
        blank=True,
    )
    observaciones = models.TextField(blank=True)
    entregado_por_nombre = models.CharField(max_length=120)
    entregado_por_apellido = models.CharField(max_length=120)
    entregado_por_cedula = models.CharField(max_length=30)
    entregado_por_rango_cargo = models.CharField(max_length=120)
    fecha_recepcion = models.DateTimeField(default=timezone.now)
    fecha_entrada = models.DateTimeField(auto_now_add=True)
    registrado_por = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='entradas_producto')

    class Meta:
        verbose_name = 'entrada de producto'
        verbose_name_plural = 'entradas de producto'
        ordering = ['-fecha_recepcion', '-id']
        indexes = [
            models.Index(fields=['reception_id', '-fecha_recepcion']),
            models.Index(fields=['tipo', '-fecha_recepcion']),
            models.Index(fields=['marca', 'modelo', '-fecha_recepcion']),
        ]

    def __str__(self):
        return f"{self.reception_id} - {self.marca.name} {self.modelo.name} x{self.cantidad}"


class EntradaProductoAttachment(models.Model):
    class AttachmentType(models.TextChoices):
        FOTO = 'foto', 'Foto evidencia'
        DOCUMENTO = 'documento', 'Documento'
        COMPROBANTE_FIRMADO = 'comprobante_firmado', 'Comprobante firmado'

    reception_id = models.CharField(max_length=40, db_index=True)
    file = models.FileField(upload_to='recepciones/%Y/%m/')
    attachment_type = models.CharField(max_length=30, choices=AttachmentType.choices, default=AttachmentType.DOCUMENTO)
    description = models.CharField(max_length=120, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='entrada_producto_adjuntos')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'adjunto de entrada'
        verbose_name_plural = 'adjuntos de entrada'
        ordering = ['-created_at']

    def __str__(self):
        return f"Adjunto {self.reception_id}"
