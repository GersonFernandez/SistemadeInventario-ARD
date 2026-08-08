import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from utils.validators import build_dominican_cedula

from inventory.models import (
    Category,
    Item,
    ItemLoan,
    ItemUnit,
    Location,
    LocationType,
    StockMovement,
)
from workorders.models import (
    Despacho,
    LineaDespacho,
    Solicitante,
    ServiceOrder,
    ServiceOrderItem,
    ServiceOrderLog,
)

User = get_user_model()


def env_bool(name, default=False):
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


class Command(BaseCommand):
    help = (
        "Genera datos de prueba para desarrollo (usuarios, inventario, "
        "solicitantes, despachos, unidades y prestamos)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--count",
            type=int,
            default=int(os.environ.get("SEED_DEV_COUNT", "100")),
            help="Cantidad base de registros a generar (default: 100)",
        )
        parser.add_argument(
            "--wipe-all",
            action="store_true",
            help="Borra toda la data de desarrollo antes de regenerarla.",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Ejecuta aunque SEED_DEV_DATA_100 no este activo.",
        )
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Limpia datos seed DEV previos antes de regenerar.",
        )

    def handle(self, *args, **options):
        count = max(1, int(options["count"]))
        enabled = env_bool("SEED_DEV_DATA_100", False) or options["force"]

        if not settings.DEBUG:
            self.stderr.write(
                self.style.ERROR("ABORTADO: seed_dev_data solo se permite con DEBUG=True.")
            )
            return

        if not enabled:
            self.stdout.write(
                "SEED_DEV_DATA_100 no esta activo. Nada que hacer. "
                "Use SEED_DEV_DATA_100=true para habilitarlo."
            )
            return

        self.stdout.write(self.style.MIGRATE_HEADING("=== Seed de desarrollo (100) ==="))
        self.stdout.write(f"Generando datos base: {count}")

        with transaction.atomic():
            if options.get("wipe_all"):
                self._wipe_all_data()
            elif options.get("reset"):
                self._reset_seed_data()
            users = self._ensure_users()
            categories = self._ensure_categories()
            locations = self._ensure_locations()
            items = self._ensure_items(count, categories, locations)
            tool_units = self._ensure_tool_units(count, items)
            solicitantes = self._ensure_solicitantes(count)
            self._ensure_despachos(count, users['admin'], solicitantes, items, locations)
            self._ensure_loans(count, users['admin'], solicitantes, tool_units)
            self._ensure_service_orders(count, users, items, locations)

        self.stdout.write(self.style.SUCCESS("Seed de desarrollo completado."))

    def _reset_seed_data(self):
        loan_qs = ItemLoan.objects.filter(notes__icontains="seed-dev-100")
        for loan in loan_qs.select_related("item_unit"):
            if loan.returned_at is None:
                loan.item_unit.status = ItemUnit.Status.AVAILABLE
                loan.item_unit.save(update_fields=["status"])
        deleted_loans = loan_qs.count()
        loan_qs.delete()

        deleted_lineas = LineaDespacho.objects.filter(notes="Linea seed dev").count()
        LineaDespacho.objects.filter(notes="Linea seed dev").delete()

        deleted_despachos = Despacho.objects.filter(notes__icontains="seed-dev-100").count()
        Despacho.objects.filter(notes__icontains="seed-dev-100").delete()

        deleted_movements = StockMovement.objects.filter(
            document_number__startswith="DEV-ENTRY-"
        ).count()
        StockMovement.objects.filter(document_number__startswith="DEV-ENTRY-").delete()

        retained_units = ItemUnit.objects.filter(serial_number__startswith="DEV-UNIT-").count()
        retained_items = Item.objects.filter(name__startswith="DEV-ITEM-").count()
        retained_solicitantes = Solicitante.objects.filter(name__startswith="DEV-SOL-").count()

        service_order_qs = ServiceOrder.objects.filter(notes__icontains="seed-dev-service-order")
        deleted_service_logs = ServiceOrderLog.objects.filter(
            service_order__in=service_order_qs
        ).count()
        deleted_service_lines = ServiceOrderItem.objects.filter(
            service_order__in=service_order_qs
        ).count()
        deleted_service_orders = service_order_qs.count()
        service_order_qs.delete()

        self.stdout.write(
            "  [OK] Reset seed DEV: "
            f"loans={deleted_loans}, lineas={deleted_lineas}, despachos={deleted_despachos}, "
            f"movements={deleted_movements}, units_retained={retained_units}, items_retained={retained_items}, "
            f"solicitantes_retained={retained_solicitantes}, service_orders={deleted_service_orders}, "
            f"service_lines={deleted_service_lines}, service_logs={deleted_service_logs}"
        )

    def _wipe_all_data(self):
        from inventory.models import (
            Brand,
            Category,
            InstallationRecord,
            Item,
            ItemLoan,
            ItemUnit,
            Location,
            LocationType,
            ProductModel,
            ProductState,
            RepairRecord,
            StockMovement,
            Transfer,
            EntradaProducto,
            EntradaProductoAttachment,
        )

        from workorders.models import Despacho, LineaDespacho, ServiceOrder, ServiceOrderItem, ServiceOrderLog, Solicitante

        self.stdout.write("  [WARN] Borrando toda la data de desarrollo existente...")

        ServiceOrderLog.objects.all().delete()
        ServiceOrderItem.objects.all().delete()
        LineaDespacho.objects.all().delete()
        ItemLoan.objects.all().delete()
        Despacho.objects.all().delete()
        ServiceOrder.objects.all().delete()
        Solicitante.objects.all().delete()

        EntradaProductoAttachment.objects.all().delete()
        EntradaProducto.objects.all().delete()
        RepairRecord.objects.all().delete()
        InstallationRecord.objects.all().delete()
        Transfer.objects.all().delete()
        StockMovement.objects.all().delete()
        ItemUnit.objects.all().delete()
        Item.objects.all().delete()
        Location.objects.all().delete()
        LocationType.objects.all().delete()
        ProductModel.objects.all().delete()
        ProductState.objects.all().delete()
        Brand.objects.all().delete()
        Category.objects.all().delete()

        User.objects.all().delete()

        self.stdout.write("  [OK] Data de aplicación limpiada por completo")

    def _ensure_users(self):
        users = [
            {
                "email": "admin.dev@armada.mil.do",
                "name": "Administrador Dev",
                "role": User.Role.ADMIN,
                "password": "Admin12345",
                "is_staff": True,
                "is_superuser": True,
            },
            {
                "email": "almacen.dev@armada.mil.do",
                "name": "Almacenista Dev",
                "role": User.Role.ALMACENISTA,
                "password": "Almacen123",
                "is_staff": False,
                "is_superuser": False,
            },
            {
                "email": "tecnico.dev@armada.mil.do",
                "name": "Tecnico Dev",
                "role": User.Role.TECNICO,
                "password": "Tecnico123",
                "is_staff": False,
                "is_superuser": False,
            },
        ]

        admin_user = None
        almacenista_user = None
        tecnico_user = None
        for cfg in users:
            user, _ = User.objects.get_or_create(
                email=cfg["email"],
                defaults={
                    "name": cfg["name"],
                    "role": cfg["role"],
                    "is_staff": cfg["is_staff"],
                    "is_superuser": cfg["is_superuser"],
                    "is_active": True,
                },
            )
            user.name = cfg["name"]
            user.role = cfg["role"]
            user.is_staff = cfg["is_staff"]
            user.is_superuser = cfg["is_superuser"]
            user.is_active = True
            user.set_password(cfg["password"])
            user.save()

            if user.role == User.Role.ADMIN:
                admin_user = user
            elif user.role == User.Role.ALMACENISTA:
                almacenista_user = user
            elif user.role == User.Role.TECNICO:
                tecnico_user = user

        self.stdout.write("  [OK] Usuarios dev listos")
        return {
            "admin": admin_user,
            "almacenista": almacenista_user,
            "tecnico": tecnico_user,
        }

    def _ensure_categories(self):
        categories_seed = [
            ("Componentes", "COM"),
            ("Conectores", "CON"),
            ("Herramientas", "HER"),
            ("Baterias", "BAT"),
            ("Cables", "CAB"),
        ]

        categories = []
        for name, abbr in categories_seed:
            cat, _ = Category.objects.get_or_create(
                name=name,
                defaults={"abbreviation": abbr, "description": "Seed dev"},
            )
            if cat.abbreviation != abbr:
                cat.abbreviation = abbr
                cat.save(update_fields=["abbreviation"])
            categories.append(cat)

        self.stdout.write("  [OK] Categorias base listas")
        return categories

    def _ensure_locations(self):
        location_types_seed = [
            ("almacen", "Almacen"),
            ("taller", "Taller"),
            ("cliente", "Cliente"),
        ]

        location_types = {}
        for code, name in location_types_seed:
            lt, _ = LocationType.objects.get_or_create(
                code=code,
                defaults={"name": name, "description": "Seed dev", "is_active": True},
            )
            if not lt.is_active:
                lt.is_active = True
                lt.save(update_fields=["is_active"])
            location_types[code] = lt

        locations = []
        for idx, code in enumerate(("almacen", "taller", "cliente"), start=1):
            loc, _ = Location.objects.get_or_create(
                name=f"{location_types[code].name} Principal {idx}",
                location_type=location_types[code],
                defaults={"codigo": f"{code[:3].upper()}-{idx:02d}"},
            )
            locations.append(loc)

        self.stdout.write("  [OK] Ubicaciones base listas")
        return locations

    def _ensure_items(self, count, categories, locations):
        from inventory.models import UnitMeasure
        # Ensure a default unit measure exists for seed items
        unit_obj, _ = UnitMeasure.objects.get_or_create(
            code="und",
            defaults={"name": "Unidad", "description": "Unidad de medida por defecto", "is_active": True},
        )

        existing = Item.objects.filter(name__startswith="DEV-ITEM-").count()
        to_create = max(0, count - existing)

        if to_create > 0:
            for i in range(existing + 1, existing + to_create + 1):
                category = categories[i % len(categories)]
                location = locations[i % len(locations)]

                is_tool = i % 5 == 0
                kind = Item.Kind.HERRAMIENTA if is_tool else Item.Kind.CONSUMIBLE
                track = is_tool

                item = Item.objects.create(
                    name=f"DEV-ITEM-{i:04d}",
                    part_number=f"DEV-PN-{i:05d}",
                    marca=f"Marca {((i - 1) % 10) + 1}",
                    modelo=f"Modelo {((i - 1) % 15) + 1}",
                    numero_serie=f"SER-{i:06d}" if is_tool else "",
                    category=category,
                    description="Item de prueba generado automaticamente",
                    application="Ambiente DEV",
                    location=location,
                    quantity=200 if not is_tool else 0,
                    minimum_stock=10,
                    unit=unit_obj,
                    kind=kind,
                    track_by_serial=track,
                    is_active=True,
                )

                StockMovement.objects.create(
                    item=item,
                    movement_type=StockMovement.MovementType.ENTRY,
                    quantity=200 if not is_tool else 1,
                    document_type=StockMovement.DocumentType.DIRECTO,
                    document_number=f"DEV-ENTRY-{i:05d}",
                    notes="Entrada seed dev",
                )

        items = list(Item.objects.filter(name__startswith="DEV-ITEM-").order_by("id")[:count])
        self.stdout.write(f"  [OK] Items dev disponibles: {len(items)}")
        return items

    def _ensure_tool_units(self, count, items):
        tool_items = [i for i in items if i.track_by_serial]
        if not tool_items:
            self.stdout.write("  [WARN] No hay items de herramienta para unidades")
            return []

        target_units = min(count, len(tool_items) * 2)
        existing_units = ItemUnit.objects.filter(serial_number__startswith="DEV-UNIT-").count()
        to_create = max(0, target_units - existing_units)

        if to_create > 0:
            for i in range(existing_units + 1, existing_units + to_create + 1):
                item = tool_items[i % len(tool_items)]
                ItemUnit.objects.get_or_create(
                    item=item,
                    serial_number=f"DEV-UNIT-{i:05d}",
                    defaults={"status": ItemUnit.Status.AVAILABLE, "notes": "Seed dev"},
                )

        units = list(
            ItemUnit.objects.filter(serial_number__startswith="DEV-UNIT-")
            .order_by("id")[:target_units]
        )
        self.stdout.write(f"  [OK] Unidades dev disponibles: {len(units)}")
        return units

    def _ensure_solicitantes(self, count):
        existing = Solicitante.objects.filter(name__startswith="DEV-SOL-").count()
        to_create = max(0, count - existing)

        if to_create > 0:
            for i in range(existing + 1, existing + to_create + 1):
                Solicitante.objects.get_or_create(
                    name=f"DEV-SOL-{i:04d}",
                    defaults={
                        "rank": "Tecnico Naval",
                        "agent_id": build_dominican_cedula(f"402{i:07d}"),
                        "notes": "Solicitante seed dev",
                        "is_active": True,
                    },
                )

        for i, solicitante in enumerate(
            Solicitante.objects.filter(name__startswith="DEV-SOL-").order_by("id")[:count],
            start=1,
        ):
            expected_cedula = build_dominican_cedula(f"402{i:07d}")
            if solicitante.agent_id != expected_cedula:
                solicitante.agent_id = expected_cedula
                solicitante.save(update_fields=["agent_id"])

        solicitantes = list(
            Solicitante.objects.filter(name__startswith="DEV-SOL-").order_by("id")[:count]
        )
        self.stdout.write(f"  [OK] Solicitantes dev disponibles: {len(solicitantes)}")
        return solicitantes

    def _ensure_despachos(self, count, admin_user, solicitantes, items, locations):
        existing = Despacho.objects.filter(notes__icontains="seed-dev-100").count()
        to_create = max(0, count - existing)

        if to_create > 0:
            for i in range(existing + 1, existing + to_create + 1):
                solicitante = solicitantes[i % len(solicitantes)]
                location = locations[i % len(locations)]
                item = items[i % len(items)]

                despacho = Despacho.objects.create(
                    solicitante=solicitante,
                    unit=location,
                    delivered_by=admin_user,
                    equipment_reference=f"DEV-EQ-{i:05d}",
                    notes="seed-dev-100",
                    status=Despacho.Status.ISSUED,
                )

                LineaDespacho.objects.create(
                    despacho=despacho,
                    item=item,
                    quantity=1,
                    notes="Linea seed dev",
                )

        total = Despacho.objects.filter(notes__icontains="seed-dev-100").count()
        self.stdout.write(f"  [OK] Despachos seed dev: {total}")

    def _ensure_loans(self, count, admin_user, solicitantes, tool_units):
        if not tool_units:
            return

        target = min(max(10, count // 3), len(tool_units))
        existing = ItemLoan.objects.filter(notes__icontains="seed-dev-100").count()
        to_create = max(0, target - existing)

        available_units = list(
            ItemUnit.objects.filter(
                serial_number__startswith="DEV-UNIT-",
                status=ItemUnit.Status.AVAILABLE,
            ).order_by("id")[:to_create]
        )

        for idx, unit in enumerate(available_units, start=1):
            solicitante = solicitantes[idx % len(solicitantes)]
            ItemLoan.objects.create(
                item_unit=unit,
                loaned_to=solicitante,
                loaned_by=admin_user,
                expected_return_at=timezone.now() + timedelta(days=7 + (idx % 5)),
                notes="seed-dev-100",
            )

        total = ItemLoan.objects.filter(notes__icontains="seed-dev-100").count()
        self.stdout.write(f"  [OK] Prestamos seed dev: {total}")

    def _ensure_service_orders(self, count, users, items, locations):
        base_products = [item for item in items if item.is_base_product and item.is_active]
        if not base_products:
            base_products = list(
                Item.objects.filter(is_base_product=True, is_active=True).order_by('id')[:count]
            )

        if not base_products:
            self.stdout.write("  [WARN] No hay productos base para generar ordenes de servicio")
            return

        admin_user = users['admin']
        technician_user = users['tecnico']
        almacenista_user = users['almacenista'] or admin_user

        existing = ServiceOrder.objects.filter(notes__icontains="seed-dev-service-order").count()
        to_create = max(0, count - existing)
        now = timezone.now()

        service_types = [
            ServiceOrder.ServiceType.REPARACION,
            ServiceOrder.ServiceType.INSTALACION,
            ServiceOrder.ServiceType.MANTENIMIENTO,
        ]
        statuses = [
            ServiceOrder.Status.RECIBIDO,
            ServiceOrder.Status.EN_DIAGNOSTICO,
            ServiceOrder.Status.EN_PROCESO,
            ServiceOrder.Status.PENDIENTE_REPUESTO,
            ServiceOrder.Status.COMPLETADO,
            ServiceOrder.Status.ENTREGADO,
        ]

        for i in range(existing + 1, existing + to_create + 1):
            service_type = service_types[(i - 1) % len(service_types)]
            status = statuses[(i - 1) % len(statuses)]
            location = locations[(i - 1) % len(locations)] if locations else None
            primary_item = base_products[(i - 1) % len(base_products)]
            created_by = admin_user if i % 2 else almacenista_user
            received_at = now - timedelta(days=(i % 45), hours=(i % 6))

            diagnosis = ''
            work_performed = ''
            if status in (ServiceOrder.Status.EN_PROCESO, ServiceOrder.Status.PENDIENTE_REPUESTO):
                diagnosis = f"Diagnostico preliminar DEV para orden {i:04d}."
            if status in (ServiceOrder.Status.COMPLETADO, ServiceOrder.Status.ENTREGADO):
                diagnosis = f"Diagnostico final DEV para orden {i:04d}."
                work_performed = f"Trabajo realizado DEV en equipo y verificacion operativa de la orden {i:04d}."

            service_order = ServiceOrder.objects.create(
                service_type=service_type,
                equipment=primary_item,
                equipment_serial_number=f"DEV-SRV-{i:05d}-01",
                equipment_condition=(
                    ServiceOrder.EquipmentCondition.NUEVO if i % 4 == 0 else ServiceOrder.EquipmentCondition.USADO
                ),
                assigned_technician=technician_user,
                created_by=created_by,
                unit=location,
                recipient_first_name=f"Nombre{i:03d}",
                recipient_last_name=f"Apellido{i:03d}",
                recipient_id_card=build_dominican_cedula(f"402{i:07d}"),
                recipient_rank_position=(
                    "Teniente de Navio" if i % 2 else "Encargado de Comunicaciones"
                ),
                status=status,
                diagnosis=diagnosis,
                work_performed=work_performed,
                notes="seed-dev-service-order",
            )

            line_count = 1 + (i % 3)
            for line_index in range(line_count):
                line_item = base_products[(i - 1 + line_index) % len(base_products)]
                ServiceOrderItem.objects.create(
                    service_order=service_order,
                    item=line_item,
                    serial_number=f"DEV-SRV-{i:05d}-{line_index + 1:02d}",
                    description=(
                        f"Linea DEV {line_index + 1} para {service_order.get_service_type_display().lower()}"
                    ),
                    equipment_condition=(
                        ServiceOrder.EquipmentCondition.NUEVO
                        if (i + line_index) % 4 == 0
                        else ServiceOrder.EquipmentCondition.USADO
                    ),
                )

            update_fields = ['received_at', 'updated_at']
            service_order.received_at = received_at
            service_order.updated_at = received_at

            if status in (ServiceOrder.Status.COMPLETADO, ServiceOrder.Status.ENTREGADO):
                service_order.completed_at = received_at + timedelta(days=1, hours=2)
                update_fields.append('completed_at')
            if status == ServiceOrder.Status.ENTREGADO:
                service_order.delivered_at = service_order.completed_at + timedelta(hours=6)
                update_fields.append('delivered_at')

            service_order.save(update_fields=update_fields)

            ServiceOrderLog.objects.create(
                service_order=service_order,
                actor=created_by,
                event='created',
                to_status=ServiceOrder.Status.RECIBIDO,
                note='Orden seed dev creada.',
            )

            if status != ServiceOrder.Status.RECIBIDO:
                ServiceOrderLog.objects.create(
                    service_order=service_order,
                    actor=technician_user,
                    event='status_transition',
                    from_status=ServiceOrder.Status.RECIBIDO,
                    to_status=status,
                    note=f'Cambio de estado DEV hacia {service_order.get_status_display()}.',
                )

            if diagnosis:
                ServiceOrderLog.objects.create(
                    service_order=service_order,
                    actor=technician_user,
                    event='note',
                    from_status=status,
                    to_status=status,
                    note=diagnosis,
                )

        for i, service_order in enumerate(
            ServiceOrder.objects.filter(notes__icontains="seed-dev-service-order").order_by("id")[:count],
            start=1,
        ):
            expected_cedula = build_dominican_cedula(f"402{i:07d}")
            if service_order.recipient_id_card != expected_cedula:
                service_order.recipient_id_card = expected_cedula
                service_order.save(update_fields=["recipient_id_card"])

        total = ServiceOrder.objects.filter(notes__icontains="seed-dev-service-order").count()
        self.stdout.write(f"  [OK] Ordenes de servicio seed dev: {total}")
