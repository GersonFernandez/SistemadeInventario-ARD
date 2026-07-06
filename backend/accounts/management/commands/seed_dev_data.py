import os
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from inventory.models import (
    Category,
    Item,
    ItemLoan,
    ItemUnit,
    Location,
    LocationType,
    StockMovement,
)
from workorders.models import Despacho, LineaDespacho, Solicitante

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
            if options.get("reset"):
                self._reset_seed_data()
            admin_user = self._ensure_users()
            categories = self._ensure_categories()
            locations = self._ensure_locations()
            items = self._ensure_items(count, categories, locations)
            tool_units = self._ensure_tool_units(count, items)
            solicitantes = self._ensure_solicitantes(count)
            self._ensure_despachos(count, admin_user, solicitantes, items, locations)
            self._ensure_loans(count, admin_user, solicitantes, tool_units)

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

        deleted_units = ItemUnit.objects.filter(serial_number__startswith="DEV-UNIT-").count()
        ItemUnit.objects.filter(serial_number__startswith="DEV-UNIT-").delete()

        deleted_items = Item.objects.filter(name__startswith="DEV-ITEM-").count()
        Item.objects.filter(name__startswith="DEV-ITEM-").delete()

        deleted_solicitantes = Solicitante.objects.filter(name__startswith="DEV-SOL-").count()
        Solicitante.objects.filter(name__startswith="DEV-SOL-").delete()

        self.stdout.write(
            "  [OK] Reset seed DEV: "
            f"loans={deleted_loans}, lineas={deleted_lineas}, despachos={deleted_despachos}, "
            f"movements={deleted_movements}, units={deleted_units}, items={deleted_items}, "
            f"solicitantes={deleted_solicitantes}"
        )

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

        self.stdout.write("  [OK] Usuarios dev listos")
        return admin_user

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
                    unit="unidad",
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
                        "agent_id": f"DEV-CED-{i:06d}",
                        "notes": "Solicitante seed dev",
                        "is_active": True,
                    },
                )

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
