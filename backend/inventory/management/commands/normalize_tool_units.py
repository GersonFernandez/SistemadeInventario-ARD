from django.core.management.base import BaseCommand
from django.db import transaction

from inventory.models import Item, ItemUnit


class Command(BaseCommand):
    help = (
        "Convierte quantity en unidades fisicas para items track_by_serial=True. "
        "Crea ItemUnit disponibles y deja quantity=0."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra lo que se haria sin guardar cambios.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        items = Item.objects.filter(track_by_serial=True, quantity__gt=0).order_by("id")

        converted_items = 0
        created_units = 0

        for item in items:
            to_create = int(item.quantity or 0)
            if to_create <= 0:
                continue

            existing_serials = set(
                ItemUnit.objects.filter(item=item).values_list("serial_number", flat=True)
            )

            new_serials = []
            seq = 1
            while len(new_serials) < to_create:
                serial = f"MIG-{item.id}-{seq:05d}"
                seq += 1
                if serial in existing_serials:
                    continue
                existing_serials.add(serial)
                new_serials.append(serial)

            converted_items += 1
            created_units += len(new_serials)

            self.stdout.write(
                f"Item {item.id} ({item.code or item.name}): +{len(new_serials)} unidades, quantity {item.quantity} -> 0"
            )

            if dry_run:
                continue

            with transaction.atomic():
                ItemUnit.objects.bulk_create(
                    [
                        ItemUnit(
                            item=item,
                            serial_number=serial,
                            status=ItemUnit.Status.AVAILABLE,
                            notes="Migracion automatica desde quantity",
                        )
                        for serial in new_serials
                    ]
                )
                item.quantity = 0
                item.save(update_fields=["quantity", "updated_at"])

        summary = (
            f"Resumen: items_convertidos={converted_items}, "
            f"unidades_creadas={created_units}, dry_run={dry_run}"
        )
        if dry_run:
            self.stdout.write(self.style.WARNING(summary))
        else:
            self.stdout.write(self.style.SUCCESS(summary))
