"""
Management command: seed_realistic_data
=========================================
Elimina toda la data existente y carga un conjunto de datos realistas
para el Taller de Electrónica de la Armada de República Dominicana.

Uso:
    py manage.py seed_realistic_data            # requiere DEBUG=True
    py manage.py seed_realistic_data --force    # fuerza en cualquier entorno
"""

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from datetime import timedelta
import random

User = get_user_model()


class Command(BaseCommand):
    help = "Limpia y recrea datos realistas para el Taller de Electrónica ARD."

    def add_arguments(self, parser):
        parser.add_argument("--force", action="store_true", help="Ejecuta aunque DEBUG=False.")

    def handle(self, *args, **options):
        from django.conf import settings
        if not settings.DEBUG and not options["force"]:
            self.stderr.write(self.style.ERROR("Solo se permite en DEBUG=True. Use --force para saltar."))
            return

        self.stdout.write(self.style.MIGRATE_HEADING("═══ Seed realista ARD — Taller de Electrónica ═══"))
        self._wipe()
        users        = self._users()
        cats         = self._categories()
        brands       = self._brands()
        models_map   = self._models(brands)
        states       = self._states()
        units_map    = self._unit_measures()
        loctypes     = self._location_types()
        locations    = self._locations(loctypes)
        items        = self._items(cats, brands, models_map, states, units_map, locations)
        tool_units   = self._tool_units(items)
        solicitantes = self._solicitantes(locations)
        self._service_orders(users, items, locations)
        self._despachos(users, solicitantes, items, locations)
        self._receptions(users, items, locations, brands, models_map, cats)
        self._tool_loans(users, solicitantes, tool_units)

        self.stdout.write(self.style.SUCCESS("✔  Seed realista completado correctamente."))

    # ──────────────────────────────────────────
    # WIPE
    # ──────────────────────────────────────────
    def _wipe(self):
        from django.db import connection
        from inventory.models import (
            Brand, Category, InstallationRecord, Item, ItemLoan, ItemUnit,
            Location, LocationType, ProductModel, ProductState,
            RepairRecord, StockMovement, Transfer, UnitMeasure,
        )
        from workorders.models import (
            Despacho, LineaDespacho, ServiceOrder, ServiceOrderItem,
            ServiceOrderLog, Solicitante,
        )
        try:
            from inventory.models import EntradaProducto, EntradaProductoAttachment
            EntradaProductoAttachment.objects.all().delete()
            EntradaProducto.objects.all().delete()
        except ImportError:
            pass

        # Disable FK constraints for SQLite so we can delete in bulk
        if connection.vendor == 'sqlite':
            connection.cursor().execute('PRAGMA foreign_keys = OFF')

        try:
            try:
                from audit.models import AuditLog
                AuditLog.objects.all().delete()
            except Exception:
                pass
            ServiceOrderLog.objects.all().delete()
            ServiceOrderItem.objects.all().delete()
            ServiceOrder.objects.all().delete()
            LineaDespacho.objects.all().delete()
            Despacho.objects.all().delete()
            # ItemLoan must go before Solicitante (PROTECT FK loaned_to)
            ItemLoan.objects.all().delete()
            Solicitante.objects.all().delete()
            Transfer.objects.all().delete()
            StockMovement.objects.all().delete()
            InstallationRecord.objects.all().delete()
            RepairRecord.objects.all().delete()
            ItemUnit.objects.all().delete()
            Item.objects.all().delete()
            Location.objects.all().delete()
            LocationType.objects.all().delete()
            UnitMeasure.objects.all().delete()
            ProductState.objects.all().delete()
            ProductModel.objects.all().delete()
            Brand.objects.all().delete()
            Category.objects.all().delete()
            User.objects.all().delete()
        finally:
            if connection.vendor == 'sqlite':
                connection.cursor().execute('PRAGMA foreign_keys = ON')

        self.stdout.write("  ✔ Base de datos limpiada")

    # ──────────────────────────────────────────
    # USUARIOS
    # ──────────────────────────────────────────
    def _users(self):
        data = [
            dict(email="admin@armada.mil.do",      name="Ramón Féliz Matos",       role="admin",      password="Admin12345!", is_staff=True,  is_superuser=True,  agent_id="C-0001"),
            dict(email="almacen@armada.mil.do",     name="Carlos Martínez Reyes",   role="almacenista",password="Almacen123!", is_staff=False, is_superuser=False, agent_id="A-0021"),
            dict(email="tecnico1@armada.mil.do",    name="José Polanco Jiménez",    role="tecnico",    password="Tecnico123!", is_staff=False, is_superuser=False, agent_id="T-0031"),
            dict(email="tecnico2@armada.mil.do",    name="Luis Rodríguez Peña",     role="tecnico",    password="Tecnico123!", is_staff=False, is_superuser=False, agent_id="T-0032"),
            dict(email="tecnico3@armada.mil.do",    name="Miguel Santana Ortiz",    role="tecnico",    password="Tecnico123!", is_staff=False, is_superuser=False, agent_id="T-0033"),
        ]
        result = {}
        for d in data:
            u, _ = User.objects.get_or_create(email=d["email"], defaults={"name": d["name"], "role": d["role"], "is_staff": d["is_staff"], "is_superuser": d["is_superuser"], "is_active": True})
            u.name = d["name"]; u.role = d["role"]; u.is_staff = d["is_staff"]
            u.is_superuser = d["is_superuser"]; u.is_active = True
            if d.get("agent_id"):
                u.agent_id = d["agent_id"]
            u.set_password(d["password"])
            u.save()
            result[d["role"]] = u
        self.stdout.write("  ✔ Usuarios listos  (admin / almacenista / tecnico1,2,3)")
        return result

    # ──────────────────────────────────────────
    # CATEGORÍAS
    # ──────────────────────────────────────────
    def _categories(self):
        from inventory.models import Category
        seed = [
            ("Comunicaciones",      "COM",  "Equipos y componentes de comunicaciones de radio"),
            ("Navegación",          "NAV",  "Instrumentos y componentes de navegación"),
            ("Electrónica General", "ELG",  "Componentes electrónicos de uso general"),
            ("Herramientas",        "HER",  "Instrumentos de medición y herramientas de taller"),
            ("Cables y Conectores", "CAB",  "Cables coaxiales, conectores RF y señal"),
            ("Fuentes de Poder",    "FUE",  "Fuentes de alimentación, baterías y reguladores"),
            ("Audio y Video",       "AUD",  "Equipos y componentes de audio y video"),
            ("Radar",               "RAD",  "Componentes de sistemas de radar"),
            ("Sonar",               "SON",  "Componentes de sistemas de sonar"),
            ("Repuestos Varios",    "REP",  "Repuestos y componentes de reposición general"),
        ]
        cats = {}
        for name, abbr, desc in seed:
            c, _ = Category.objects.get_or_create(name=name, defaults={"abbreviation": abbr, "description": desc})
            c.abbreviation = abbr; c.description = desc; c.save()
            cats[name] = c
        self.stdout.write("  ✔ Categorías listas")
        return cats

    # ──────────────────────────────────────────
    # MARCAS
    # ──────────────────────────────────────────
    def _brands(self):
        from inventory.models import Brand
        seed = [
            ("Motorola Solutions", "Equipos de radiocomunicaciones profesionales y tácticos"),
            ("Kenwood",            "Radios VHF/UHF y equipos de comunicaciones navales"),
            ("ICOM",               "Equipos de radio marino y transceptores profesionales"),
            ("Furuno",             "Sistemas de navegación, radar y sonar marino"),
            ("Garmin",             "Sistemas GPS, cartas náuticas y navegación"),
            ("Simrad",             "Electrónica marina de navegación avanzada"),
            ("Standard Horizon",   "Radios VHF marina de comunicaciones de emergencia"),
            ("Vertex Standard",    "Radios portátiles de seguridad y comunicaciones"),
            ("Fluke",              "Instrumentos de medición y diagnóstico electrónico"),
            ("Anritsu",            "Analizadores de espectro y equipos de RF"),
            ("Rohde & Schwarz",    "Equipos de comunicaciones y medición de RF de alta precisión"),
            ("Harris Corporation", "Sistemas de comunicaciones tácticas militares"),
            ("Raytheon",           "Sistemas electrónicos de defensa y radar"),
            ("Coax Electronics",   "Conectores y cables RF especializados"),
            ("Amphenol",           "Conectores de alta confiabilidad para aplicaciones militares"),
        ]
        brands = {}
        for name, desc in seed:
            b, _ = Brand.objects.get_or_create(name=name, defaults={"description": desc, "is_active": True})
            b.description = desc; b.is_active = True; b.save()
            brands[name] = b
        self.stdout.write("  ✔ Marcas listas")
        return brands

    # ──────────────────────────────────────────
    # MODELOS
    # ──────────────────────────────────────────
    def _models(self, brands):
        from inventory.models import ProductModel
        seed = {
            "Motorola Solutions": [
                ("APX 8000",        "Radio portátil multibanda P25"),
                ("XTS 2500",        "Radio digital trunking 700/800 MHz"),
                ("SL300",           "Radio portátil delgado 403-470 MHz"),
                ("CM300d",          "Radio móvil analógico 136-174 MHz"),
            ],
            "Kenwood": [
                ("TK-2360",         "Radio portátil VHF 136-174 MHz"),
                ("TK-3360",         "Radio portátil UHF 400-470 MHz"),
                ("NX-1300",         "Radio digital NEXEDGE VHF"),
                ("TM-V71A",         "Transceptor base/móvil doble banda VHF/UHF"),
            ],
            "ICOM": [
                ("IC-M506",         "Radio VHF marina clase D con DSC integrado"),
                ("IC-M605",         "Radio VHF marina de alta potencia para embarcaciones"),
                ("IC-A220",         "Radio de aviación aire-tierra"),
                ("IC-F5061D",       "Radio P25 digital de alta potencia"),
            ],
            "Furuno":  [
                ("GP-33",           "Receptor GPS/WAAS de navegación"),
                ("FAR-2117",        "Radar marino banda X 72 nm"),
                ("FE-700",          "Ecosonda de pesca profesional"),
                ("VR-3000",         "Grabador de viaje marino (VDR)"),
            ],
            "Garmin":  [
                ("GPSMAP 8416xsv",  "Plotter/sonar multifunción 16 pulgadas"),
                ("VHF 215i",        "Radio VHF marina con DSC incorporado"),
                ("GSD 26",          "Módulo de sonar de alta definición"),
            ],
            "Fluke":   [
                ("87V",             "Multímetro digital industrial TRMS"),
                ("179",             "Multímetro TRMS compacto"),
                ("435-II",          "Analizador de calidad de energía trifásico"),
                ("1507",            "Megóhmetro 1000 V de aislamiento"),
            ],
            "Anritsu":  [
                ("MS2034B",         "Analizador VNA/espectro compacto 30 kHz–4 GHz"),
                ("Site Master S331L","Analizador de antenas y cables campo"),
            ],
            "Rohde & Schwarz": [
                ("ESCI7",           "Receptor de mediciones EMC 9 kHz–7 GHz"),
                ("FSH8",            "Analizador de espectro portátil 100 kHz–8 GHz"),
            ],
            "Amphenol": [
                ("PL-259",          "Conector coaxial UHF macho estándar"),
                ("N-Type Male",     "Conector N macho para cable LMR-400"),
                ("BNC Male RG-58",  "Conector BNC macho para coaxial RG-58"),
            ],
        }
        models_map = {}
        for brand_name, model_list in seed.items():
            if brand_name not in brands:
                continue
            b = brands[brand_name]
            for mname, mdesc in model_list:
                m, _ = ProductModel.objects.get_or_create(brand=b, name=mname, defaults={"description": mdesc, "is_active": True})
                m.description = mdesc; m.is_active = True; m.save()
                models_map[f"{brand_name}|{mname}"] = m
        self.stdout.write("  ✔ Modelos listos")
        return models_map

    # ──────────────────────────────────────────
    # ESTADOS DE PRODUCTO
    # ──────────────────────────────────────────
    def _states(self):
        from inventory.models import ProductState
        seed = [
            ("bueno",           "Buen Estado",          "Equipo o componente operativo sin defectos"),
            ("en_reparacion",   "En Reparación",        "En proceso de reparación en el taller"),
            ("pendiente",       "Pendiente de Prueba",  "Reparado, pendiente de prueba final"),
            ("fuera_servicio",  "Fuera de Servicio",    "Equipo no operativo, requiere evaluación técnica"),
            ("descartado",      "Descartado",           "Irreparable o dado de baja definitiva"),
            ("instalado",       "Instalado",            "Equipo instalado en embarcación o unidad"),
            ("nuevo",           "Nuevo",                "Equipo o componente nuevo sin uso"),
            ("recondicionado",  "Recondicionado",       "Equipo restaurado a condición operativa"),
        ]
        states = {}
        for code, name, desc in seed:
            s, _ = ProductState.objects.get_or_create(code=code, defaults={"name": name, "description": desc, "is_active": True})
            s.name = name; s.description = desc; s.is_active = True; s.save()
            states[code] = s
        self.stdout.write("  ✔ Estados de producto listos")
        return states

    # ──────────────────────────────────────────
    # UNIDADES DE MEDIDA
    # ──────────────────────────────────────────
    def _unit_measures(self):
        from inventory.models import UnitMeasure
        seed = [
            ("und",  "Unidad",       "Unidad individual de un producto"),
            ("kit",  "Kit",          "Conjunto o juego de piezas"),
            ("par",  "Par",          "Dos unidades del mismo artículo"),
            ("jgo",  "Juego",        "Juego o set completo"),
            ("m",    "Metro",        "Metro lineal (cables)"),
            ("rollo","Rollo",        "Rollo de cable o material"),
            ("paq",  "Paquete",      "Paquete de varios artículos"),
            ("caja", "Caja",         "Caja de suministros"),
        ]
        units = {}
        for code, name, desc in seed:
            u, _ = UnitMeasure.objects.get_or_create(code=code, defaults={"name": name, "description": desc, "is_active": True})
            u.name = name; u.description = desc; u.is_active = True; u.save()
            units[code] = u
        self.stdout.write("  ✔ Unidades de medida listas")
        return units

    # ──────────────────────────────────────────
    # TIPOS DE UBICACIÓN
    # ──────────────────────────────────────────
    def _location_types(self):
        from inventory.models import LocationType
        seed = [
            ("taller",      "Taller de Electrónica",  "Área de reparación y mantenimiento del taller"),
            ("almacen",     "Almacén",                "Depósito de materiales y repuestos"),
            ("buque",       "Buque / Embarcación",    "Embarcaciones de la flota naval"),
            ("base_naval",  "Base Naval",             "Instalaciones de bases navales"),
            ("deposito",    "Depósito Temporal",      "Área de almacenamiento temporal"),
        ]
        types = {}
        for code, name, desc in seed:
            t, _ = LocationType.objects.get_or_create(code=code, defaults={"name": name, "description": desc, "is_active": True})
            t.name = name; t.description = desc; t.is_active = True; t.save()
            types[code] = t
        self.stdout.write("  ✔ Tipos de ubicación listos")
        return types

    # ──────────────────────────────────────────
    # UBICACIONES
    # ──────────────────────────────────────────
    def _locations(self, loctypes):
        from inventory.models import Location
        seed = [
            # (nombre, código_tipo, código_ubicación, padre=None)
            ("Taller Principal — Área de Comunicaciones",       "taller",     "T-COM",    None),
            ("Taller Principal — Banco de Pruebas",             "taller",     "T-BNK",    None),
            ("Taller Principal — Área de Instrumentación",      "taller",     "T-INS",    None),
            ("Almacén A — Estante 1 (Componentes RF)",          "almacen",    "ALM-A1",   None),
            ("Almacén A — Estante 2 (Cables y Conectores)",     "almacen",    "ALM-A2",   None),
            ("Almacén A — Estante 3 (Herramientas)",            "almacen",    "ALM-A3",   None),
            ("Almacén B — Equipos Mayores",                     "almacen",    "ALM-B",    None),
            ("Depósito Temporal — Entrada",                     "deposito",   "DEP-ENT",  None),
            ("ARD Mella — Fragata F-101",                       "buque",      "F-101",    None),
            ("ARD Separación — Corbeta BM-454",                 "buque",      "BM-454",   None),
            ("ARD Capotillo — Patrullera P-204",                "buque",      "P-204",    None),
            ("ARD Independencia — Buque escuela BE-301",        "buque",      "BE-301",   None),
            ("Base Naval Las Calderas",                         "base_naval", "BNC",      None),
            ("Base Naval 27 de Febrero",                        "base_naval", "BN27",     None),
        ]
        locs = {}
        for name, type_code, code, parent_code in seed:
            lt = loctypes.get(type_code)
            parent = locs.get(parent_code)
            loc, _ = Location.objects.get_or_create(
                name=name,
                defaults={"location_type": lt},
            )
            loc.location_type = lt
            if parent:
                loc.parent = parent
            loc.save()
            locs[code] = loc
        self.stdout.write("  ✔ Ubicaciones listas")
        return locs

    # ──────────────────────────────────────────
    # ARTÍCULOS DE INVENTARIO
    # ──────────────────────────────────────────
    def _generate_item_code(self, category):
        from inventory.models import Item
        last = Item.objects.filter(category=category).exclude(code__isnull=True).exclude(code='').order_by('code').last()
        if last and last.code:
            try:
                new_num = int(last.code.split('-')[-1]) + 1
            except ValueError:
                new_num = 1
        else:
            new_num = 1
        return f"{category.abbreviation.upper()}-{new_num:03d}"

    def _items(self, cats, brands, models_map, states, units_map, locations):
        from inventory.models import Item, StockMovement

        def mk(name, cat_name, brand_name, model_name, state_code, unit_code, qty, min_qty,
               kind="consumible", track_serial=False, part_number="", application="", description=""):
            cat   = cats.get(cat_name)
            brand = brands.get(brand_name)
            model = models_map.get(f"{brand_name}|{model_name}") if model_name else None
            state = states.get(state_code)
            unit  = units_map.get(unit_code)
            loc   = locations.get("ALM-A1") if "componente" in (description or "").lower() or kind == "consumible" else locations.get("ALM-A3")
            if not cat:
                return None
            item, created = Item.objects.get_or_create(
                name=name,
                defaults={
                    "code": self._generate_item_code(cat),
                    "category": cat,
                    "brand": brand,
                    "product_model": model,
                    "state": state,
                    "unit": unit,
                    "quantity": qty,
                    "minimum_stock": min_qty,
                    "kind": kind,
                    "track_by_serial": track_serial,
                    "part_number": part_number,
                    "description": description or name,
                    "application": application,
                    "location": loc,
                    "is_active": True,
                    "is_base_product": True,
                },
            )
            if not created:
                item.quantity = qty
                item.minimum_stock = min_qty
                item.state = state
                if not item.code:
                    item.code = self._generate_item_code(cat)
                item.save()
            return item

        items = []
        # ── Radios y comunicaciones (consumibles/repuestos) ──
        items.append(mk("Radio VHF Marina ICOM IC-M506", "Comunicaciones", "ICOM", "IC-M506", "bueno", "und", 8, 3, description="Radio VHF marina con DSC para coordinación de flota", application="Comunicaciones de flota"))
        items.append(mk("Radio Portátil Kenwood TK-2360", "Comunicaciones", "Kenwood", "TK-2360", "bueno", "und", 15, 5, description="Radio portátil VHF para personal de a bordo", application="Comunicaciones internas embarcación"))
        items.append(mk("Transceptor Motorola APX 8000", "Comunicaciones", "Motorola Solutions", "APX 8000", "bueno", "und", 6, 2, description="Radio P25 multibanda para operaciones tácticas", application="Operaciones especiales y coordinación táctica"))
        items.append(mk("Radio VHF Marina Standard Horizon GX2400", "Comunicaciones", "Standard Horizon", None, "bueno", "und", 5, 2, description="Radio VHF marina de cabina para embarcaciones de patrulla"))
        # ── GPS y navegación ──
        items.append(mk("GPS Furuno GP-33", "Navegación", "Furuno", "GP-33", "bueno", "und", 4, 1, description="Receptor GPS WAAS de alta precisión para navegación"))
        items.append(mk("Plotter Garmin GPSMAP 8416", "Navegación", "Garmin", "GPSMAP 8416xsv", "bueno", "und", 3, 1, description="Plotter multifunción con sonar integrado"))
        items.append(mk("Antena GPS Externa", "Cables y Conectores", "Garmin", None, "bueno", "und", 12, 4, part_number="010-10702-00", description="Antena activa GPS externa para instalación en cubierta"))
        # ── Componentes electrónicos ──
        items.append(mk("Condensador Electrolítico 100µF 25V", "Electrónica General", "Motorola Solutions", None, "nuevo", "und", 500, 100, part_number="CAP-100UF-25V", description="Condensador de baja impedancia para fuentes de poder", application="Reparación de tarjetas de alimentación"))
        items.append(mk("Resistencia 1kΩ 1/4W", "Electrónica General", "Motorola Solutions", None, "nuevo", "und", 1000, 200, part_number="RES-1K-025W", description="Resistencia de película de carbón 5% tolerancia"))
        items.append(mk("Transistor NPN 2N2222A", "Electrónica General", "Motorola Solutions", None, "nuevo", "und", 300, 50, part_number="2N2222A", description="Transistor BJT NPN de propósito general 40V 600mA"))
        items.append(mk("Circuito Integrado LM7805", "Electrónica General", "Motorola Solutions", None, "nuevo", "und", 150, 30, part_number="LM7805CT", description="Regulador de voltaje positivo 5V 1.5A", application="Regulación de voltaje en equipos de comunicaciones"))
        items.append(mk("MOSFET IRF3205 N-Channel", "Electrónica General", "Motorola Solutions", None, "nuevo", "und", 80, 20, part_number="IRF3205PBF", description="MOSFET de potencia N-channel 55V 110A", application="Amplificadores RF y fuentes de poder"))
        items.append(mk("Diodo Zener 5.1V 1W", "Electrónica General", "Motorola Solutions", None, "nuevo", "und", 200, 50, part_number="1N4733A", description="Diodo regulador de voltaje 5.1V para referencia"))
        items.append(mk("Cristal Oscilador 10 MHz", "Electrónica General", "Kenwood", None, "nuevo", "und", 60, 15, part_number="XTAL-10M-HC49", description="Cristal de cuarzo HC-49/S 10.000 MHz ±30ppm"))
        # ── Cables y conectores ──
        items.append(mk("Cable Coaxial RG-58 A/U", "Cables y Conectores", "Coax Electronics", None, "nuevo", "rollo", 8, 2, part_number="RG58AU-100M", description="Cable coaxial RG-58/AU 50 ohm — rollo 100m"))
        items.append(mk("Cable Coaxial RG-213/U", "Cables y Conectores", "Coax Electronics", None, "nuevo", "m", 250, 50, part_number="RG213U", description="Cable coaxial de baja pérdida RG-213/U para antenas HF/VHF"))
        items.append(mk("Conector PL-259 Amphenol", "Cables y Conectores", "Amphenol", "PL-259", "nuevo", "und", 200, 50, description="Conector macho tipo UHF para RG-8 y RG-213"))
        items.append(mk("Conector N-Type Macho Amphenol", "Cables y Conectores", "Amphenol", "N-Type Male", "nuevo", "und", 100, 30, description="Conector tipo N macho para cable LMR-400 y RG-213"))
        items.append(mk("Conector BNC Macho RG-58", "Cables y Conectores", "Amphenol", "BNC Male RG-58", "nuevo", "und", 150, 40, description="Conector BNC macho para RG-58, crimp"))
        items.append(mk("Adaptador BNC a PL-259", "Cables y Conectores", "Coax Electronics", None, "nuevo", "und", 25, 8, part_number="BNC-PL259-ADP", description="Adaptador RF hembra BNC a macho PL-259"))
        # ── Fuentes de poder y baterías ──
        items.append(mk("Batería Li-Ion 7.4V 2000mAh para radio portátil", "Fuentes de Poder", "Kenwood", None, "nuevo", "und", 24, 6, part_number="KNB-57L", description="Batería de litio-ion para radio portátil Kenwood TK-2360"))
        items.append(mk("Fuente de Poder Regulada 13.8V 30A", "Fuentes de Poder", "Motorola Solutions", None, "bueno", "und", 4, 1, part_number="PS-23I", description="Fuente de poder DC para radio base/móvil, protección contra cortocircuito"))
        items.append(mk("Batería de Gel 12V 18Ah", "Fuentes de Poder", "ICOM", None, "nuevo", "und", 10, 3, part_number="BP-12V18AH", description="Batería sellada de gel para UPS y sistemas de emergencia"))
        # ── Radar ──
        items.append(mk("Antena de Radar Furuno FAR-2117 (de repuesto)", "Radar", "Furuno", "FAR-2117", "bueno", "und", 2, 1, description="Antena de repuesto para radar FAR-2117, banda X"))
        items.append(mk("Magnetrón M1456 para Radar FAR-2117", "Radar", "Furuno", None, "nuevo", "und", 3, 1, part_number="MAG-M1456", description="Magnetrón de reemplazo para radar marino Furuno banda X"))
        # ── Audio ──
        items.append(mk("Altavoz Marino 4Ω 10W", "Audio y Video", "ICOM", None, "nuevo", "und", 15, 4, part_number="SP-35", description="Altavoz externo para radio marina, resistente a la intemperie"))
        items.append(mk("Auricular con Micrófono PTT", "Audio y Video", "Kenwood", None, "bueno", "und", 20, 5, part_number="KHS-10", description="Auricular con micrófono de solapa y PTT para radio portátil"))

        # ── HERRAMIENTAS (track_by_serial=True) ──
        items.append(mk("Multímetro Digital Fluke 87V", "Herramientas", "Fluke", "87V", "bueno", "und", 0, 0, kind="herramienta", track_serial=True, description="Multímetro TRMS industrial, CAT III 1000V"))
        items.append(mk("Multímetro Digital Fluke 179", "Herramientas", "Fluke", "179", "bueno", "und", 0, 0, kind="herramienta", track_serial=True, description="Multímetro compacto TRMS, CAT III 600V"))
        items.append(mk("Analizador de Espectro Anritsu MS2034B", "Herramientas", "Anritsu", "MS2034B", "bueno", "und", 0, 0, kind="herramienta", track_serial=True, description="Analizador VNA/espectro portátil 30 kHz–4 GHz para diagnóstico RF"))
        items.append(mk("Site Master Anritsu S331L", "Herramientas", "Anritsu", "Site Master S331L", "bueno", "und", 0, 0, kind="herramienta", track_serial=True, description="Analizador de antenas y cables para verificación de líneas RF en embarcaciones"))
        items.append(mk("Analizador de Energía Fluke 435-II", "Herramientas", "Fluke", "435-II", "bueno", "und", 0, 0, kind="herramienta", track_serial=True, description="Analizador de calidad de energía trifásico para diagnosis eléctrica"))
        items.append(mk("Megóhmetro Fluke 1507", "Herramientas", "Fluke", "1507", "bueno", "und", 0, 0, kind="herramienta", track_serial=True, description="Megóhmetro 1000V para medición de aislamiento en cableado marino"))
        items.append(mk("Estación de Soldadura Hakko FX-888D", "Herramientas", "Fluke", None, "bueno", "und", 0, 0, kind="herramienta", track_serial=True, part_number="FX888D-23BY", description="Estación de soldadura digital de precisión 70W temperatura estable"))
        items.append(mk("Osciloscopio Digital Rigol DS1054Z", "Herramientas", "Rohde & Schwarz", None, "bueno", "und", 0, 0, kind="herramienta", track_serial=True, description="Osciloscopio 4 canales 50MHz con decodificación de protocolos"))

        valid = [i for i in items if i is not None]
        self.stdout.write(f"  ✔ {len(valid)} artículos de inventario creados")
        return valid

    # ──────────────────────────────────────────
    # UNIDADES SERIALIZADAS (herramientas)
    # ──────────────────────────────────────────
    def _tool_units(self, items):
        from inventory.models import Item, ItemUnit
        units_created = []
        tool_serials = {
            "Multímetro Digital Fluke 87V":              [("ARD-87V-001", "available"), ("ARD-87V-002", "available"), ("ARD-87V-003", "maintenance")],
            "Multímetro Digital Fluke 179":              [("ARD-179-001", "available"), ("ARD-179-002", "available")],
            "Analizador de Espectro Anritsu MS2034B":    [("ARD-ANR-001", "available")],
            "Site Master Anritsu S331L":                 [("ARD-SM-001",  "available")],
            "Analizador de Energía Fluke 435-II":        [("ARD-435-001", "available")],
            "Megóhmetro Fluke 1507":                     [("ARD-MEG-001", "available"), ("ARD-MEG-002", "available")],
            "Estación de Soldadura Hakko FX-888D":       [("ARD-SOL-001", "available"), ("ARD-SOL-002", "available"), ("ARD-SOL-003", "available")],
            "Osciloscopio Digital Rigol DS1054Z":        [("ARD-OSC-001", "available"), ("ARD-OSC-002", "maintenance")],
        }
        for item in items:
            if not item.track_by_serial:
                continue
            serials = tool_serials.get(item.name, [])
            for serial, status in serials:
                u, _ = ItemUnit.objects.get_or_create(
                    item=item,
                    serial_number=serial,
                    defaults={"status": status, "notes": f"Taller Electrónica ARD — {item.name}"},
                )
                u.status = status
                u.save()
                units_created.append(u)
        self.stdout.write(f"  ✔ {len(units_created)} unidades serializadas de herramientas creadas")
        return units_created

    # ──────────────────────────────────────────
    # SOLICITANTES
    # ──────────────────────────────────────────
    def _solicitantes(self, locations):
        from workorders.models import Solicitante
        seed = [
            ("Teniente de Navío Rafael Guzmán Feliz",        "TN",   "F-101",   "1234567"),
            ("Alférez de Navío Carmen Soto Beltré",          "AN",   "BM-454",  "2345678"),
            ("Suboficial 1ro. Pedro Almonte Reyes",          "S/O1", "P-204",   "3456789"),
            ("Sargento 1ro. Ramona Tejada Cruz",             "S/M1", "BE-301",  "4567890"),
            ("Sargento 2do. Antonio Herrera Peña",           "S/M2", "BNC",     "5678901"),
            ("Marinero Orlando Marte Féliz",                 "MRO",  "BN27",    "6789012"),
            ("Departamento de Comunicaciones ARD",           "",     "BNC",     ""),
            ("Sección de Operaciones — Flota Naval",         "",     "BNC",     ""),
            ("Base Naval Las Calderas — Jefatura",           "",     "BNC",     ""),
            ("Brigada de Buceo y Salvamento",                "TN",   "BN27",    "7890123"),
        ]
        result = []
        for name, rank, loc_code, agent_id in seed:
            loc = locations.get(loc_code)
            s, _ = Solicitante.objects.get_or_create(
                name=name,
                defaults={"rank": rank, "unit": loc, "agent_id": agent_id, "is_active": True},
            )
            s.rank = rank; s.unit = loc; s.is_active = True
            if agent_id:
                s.agent_id = agent_id
            s.save()
            result.append(s)
        self.stdout.write(f"  ✔ {len(result)} solicitantes creados")
        return result

    # ──────────────────────────────────────────
    # ÓRDENES DE SERVICIO
    # ──────────────────────────────────────────
    def _service_orders(self, users, items, locations):
        from workorders.models import ServiceOrder, ServiceOrderItem, ServiceOrderLog

        admin   = users["admin"]
        tecnico = users.get("tecnico")

        consumibles = [i for i in items if not i.track_by_serial]
        if not consumibles:
            return

        orders = [
            dict(
                service_type="reparacion",
                status="completado",
                equipment_name="Radio VHF ICOM IC-M506",
                equipment_serial="ICM506-2024-001",
                equipment_brand="ICOM",
                equipment_model="IC-M506",
                condition="usado",
                recipient_first_name="Rafael",
                recipient_last_name="Guzmán Feliz",
                recipient_id_card="001-0234567-8",
                recipient_rank_position="TN",
                diagnosis="Módulo de recepción dañado por cortocircuito. Reemplazo de etapa de RF.",
                work_performed="Se cambió el módulo de recepción RF y se calibró la frecuencia. Radio en condición operativa.",
                unit=locations.get("F-101"),
            ),
            dict(
                service_type="reparacion",
                status="en_proceso",
                equipment_name="Radar Furuno FAR-2117",
                equipment_serial="FUR-2117-003",
                equipment_brand="Furuno",
                equipment_model="FAR-2117",
                condition="usado",
                recipient_first_name="Carmen",
                recipient_last_name="Soto Beltré",
                recipient_id_card="002-3456789-0",
                recipient_rank_position="AN",
                diagnosis="Pérdida de imagen en pantalla, posible fallo del magnetrón o procesador de señal.",
                work_performed="",
                unit=locations.get("BM-454"),
            ),
            dict(
                service_type="mantenimiento",
                status="completado",
                equipment_name="Transceptor Motorola APX 8000",
                equipment_serial="MOT-APX-2024-007",
                equipment_brand="Motorola Solutions",
                equipment_model="APX 8000",
                condition="usado",
                recipient_first_name="Pedro",
                recipient_last_name="Almonte Reyes",
                recipient_id_card="003-4567890-1",
                recipient_rank_position="S/O1",
                diagnosis="Mantenimiento preventivo de rutina. Limpieza y verificación de operación.",
                work_performed="Se realizó limpieza interna, verificación de juntas y prueba de frecuencias. Equipo OK.",
                unit=locations.get("P-204"),
            ),
            dict(
                service_type="instalacion",
                status="entregado",
                equipment_name="GPS Garmin GPSMAP 8416",
                equipment_serial="GAR-8416-2024-002",
                equipment_brand="Garmin",
                equipment_model="GPSMAP 8416xsv",
                condition="nuevo",
                recipient_first_name="Ramona",
                recipient_last_name="Tejada Cruz",
                recipient_id_card="004-5678901-2",
                recipient_rank_position="S/M1",
                diagnosis="Instalación de nuevo equipo de navegación GPS/plotter.",
                work_performed="Equipo instalado en sala de cartas, cableo de alimentación y antena GPS externa. Probado y funcional.",
                unit=locations.get("BE-301"),
            ),
            dict(
                service_type="reparacion",
                status="pendiente_repuesto",
                equipment_name="Radio Kenwood TK-2360",
                equipment_serial="KEN-TK-2360-012",
                equipment_brand="Kenwood",
                equipment_model="TK-2360",
                condition="usado",
                recipient_first_name="Antonio",
                recipient_last_name="Herrera Peña",
                recipient_id_card="005-6789012-3",
                recipient_rank_position="S/M2",
                diagnosis="Batería dañada y conector de antena roto. En espera de batería de repuesto.",
                work_performed="",
                unit=locations.get("BNC"),
            ),
            dict(
                service_type="reparacion",
                status="recibido",
                equipment_name="Estación de Radio HF Harris",
                equipment_serial="HAR-HF-2024-001",
                equipment_brand="Harris Corporation",
                equipment_model=None,
                condition="usado",
                recipient_first_name="Orlando",
                recipient_last_name="Marte Féliz",
                recipient_id_card="006-7890123-4",
                recipient_rank_position="MRO",
                diagnosis="",
                work_performed="",
                unit=locations.get("BN27"),
            ),
        ]

        created = 0
        for i, o in enumerate(orders):
            item_for_order = consumibles[i % len(consumibles)]
            received_at = timezone.now() - timedelta(days=20 - i * 3)

            so = ServiceOrder(
                service_type=o["service_type"],
                status=o["status"],
                equipment=item_for_order,
                equipment_name_snapshot=o["equipment_name"],
                equipment_serial_number=o["equipment_serial"],
                equipment_brand_snapshot=o.get("equipment_brand", ""),
                equipment_model_snapshot=o.get("equipment_model") or "",
                equipment_condition=o["condition"],
                recipient_first_name=o["recipient_first_name"],
                recipient_last_name=o["recipient_last_name"],
                recipient_id_card=o["recipient_id_card"],
                recipient_rank_position=o["recipient_rank_position"],
                diagnosis=o.get("diagnosis", ""),
                work_performed=o.get("work_performed", ""),
                created_by=admin,
                assigned_technician=tecnico,
                unit=o.get("unit"),
                notes="Orden generada por seed realista ARD",
            )
            so.received_at = received_at
            if o["status"] in ("completado", "entregado"):
                so.completed_at = received_at + timedelta(days=3)
            if o["status"] == "entregado":
                so.delivered_at = received_at + timedelta(days=5)
            so.save()

            ServiceOrderItem.objects.get_or_create(
                service_order=so,
                serial_number=o["equipment_serial"],
                defaults={
                    "item": item_for_order,
                    "item_name_snapshot": o["equipment_name"],
                    "equipment_condition": o["condition"],
                    "description": o.get("diagnosis") or "Equipo ingresado a taller",
                },
            )
            ServiceOrderLog.objects.create(
                service_order=so,
                actor=admin,
                event="created",
                to_status="recibido",
                note="Orden registrada en sistema",
            )
            created += 1

        self.stdout.write(f"  ✔ {created} órdenes de servicio creadas")

    # ──────────────────────────────────────────
    # DESPACHOS
    # ──────────────────────────────────────────
    def _despachos(self, users, solicitantes, items, locations):
        from workorders.models import Despacho, LineaDespacho
        from inventory.models import StockMovement

        almacenista = users.get("almacenista") or users["admin"]
        consumibles = [i for i in items if not i.track_by_serial and i.quantity > 0]
        if not consumibles or not solicitantes:
            return

        despacho_seed = [
            dict(sol_idx=0, unit_code="F-101",  items=[(0, 5), (2, 2)],  equip="Sistema de comunicaciones fragata", notes="Reposición de radios VHF para fragata"),
            dict(sol_idx=1, unit_code="BM-454", items=[(3, 100), (4, 200)], equip="Reparación tarjetas de radio", notes="Componentes para reparación de equipo embarcado"),
            dict(sol_idx=2, unit_code="P-204",  items=[(6, 50), (7, 10)],  equip="Mantenimiento patrullera", notes="Suministros de mantenimiento preventivo"),
            dict(sol_idx=3, unit_code="BE-301", items=[(8, 3), (9, 5)],   equip="Instalación GPS", notes="Insumos para instalación de GPS en buque escuela"),
            dict(sol_idx=4, unit_code="BNC",    items=[(1, 4), (5, 2)],   equip="Comunicaciones base naval", notes="Reposición de radios para base naval"),
        ]

        created = 0
        for d in despacho_seed:
            sol = solicitantes[d["sol_idx"]] if d["sol_idx"] < len(solicitantes) else solicitantes[0]
            unit = locations.get(d["unit_code"])
            desp = Despacho.objects.create(
                solicitante=sol,
                unit=unit,
                delivered_by=almacenista,
                equipment_reference=d["equip"],
                notes=d["notes"],
                status=Despacho.Status.ISSUED,
            )
            for item_idx, qty in d["items"]:
                if item_idx >= len(consumibles):
                    continue
                item = consumibles[item_idx]
                actual_qty = min(qty, item.quantity)
                if actual_qty <= 0:
                    continue
                LineaDespacho.objects.create(
                    despacho=desp,
                    item=item,
                    quantity=actual_qty,
                    notes="Despacho seed ARD",
                )
                item.quantity = max(0, item.quantity - actual_qty)
                item.save(update_fields=["quantity"])
                StockMovement.objects.create(
                    item=item,
                    movement_type="exit",
                    quantity=actual_qty,
                    document_type="directo",
                    document_number=desp.ot_number,
                    notes=f"Despacho {desp.ot_number} — {sol.name}",
                )
            created += 1

        self.stdout.write(f"  ✔ {created} despachos creados")

    # ──────────────────────────────────────────
    # RECEPCIONES (EntradaProducto)
    # ──────────────────────────────────────────
    def _receptions(self, users, items, locations, brands, models_map, cats):
        from inventory.models import EntradaProducto, StockMovement

        almacenista = users.get("almacenista") or users["admin"]
        consumibles = [i for i in items if not i.track_by_serial]
        alm_a1 = locations.get("ALM-A1")
        alm_b  = locations.get("ALM-B")
        dep    = locations.get("DEP-ENT")

        seed = [
            dict(
                reception_id="REC-2026-00001",
                item=consumibles[0],   # Radio VHF ICOM IC-M506
                tipo="nuevo",
                cantidad=5,
                seriales=[],
                ubicacion=alm_b,
                entregado_por_nombre="Carlos",
                entregado_por_apellido="Pimentel Marte",
                entregado_por_cedula="031-0123456-7",
                entregado_por_rango_cargo="Proveedor Técnico",
                observaciones="Recepción inicial de radios VHF para fragata",
                dias_atras=30,
            ),
            dict(
                reception_id="REC-2026-00002",
                item=consumibles[2],   # Transceptor Motorola APX 8000
                tipo="nuevo",
                cantidad=4,
                seriales=[],
                ubicacion=alm_b,
                entregado_por_nombre="Miguel",
                entregado_por_apellido="Torres Rodríguez",
                entregado_por_cedula="001-0234567-8",
                entregado_por_rango_cargo="TN — Oficial de Abastecimiento",
                observaciones="Adquisición de radios tácticas para operaciones especiales",
                dias_atras=20,
            ),
            dict(
                reception_id="REC-2026-00003",
                item=consumibles[7],   # Condensador Electrolítico
                tipo="nuevo",
                cantidad=500,
                seriales=[],
                ubicacion=alm_a1,
                entregado_por_nombre="Ana",
                entregado_por_apellido="Guzmán Féliz",
                entregado_por_cedula="002-0345678-9",
                entregado_por_rango_cargo="Distribuidora ElectroTech SRL",
                observaciones="Lote de componentes electrónicos para el taller — Factura #2026-450",
                dias_atras=15,
            ),
            dict(
                reception_id="REC-2026-00004",
                item=consumibles[14],  # Cable Coaxial RG-58
                tipo="nuevo",
                cantidad=5,
                seriales=[],
                ubicacion=alm_a1,
                entregado_por_nombre="Roberto",
                entregado_por_apellido="Almonte Sosa",
                entregado_por_cedula="003-0456789-0",
                entregado_por_rango_cargo="Proveedor Cable & RF SRL",
                observaciones="Rollos de cable coaxial RG-58 para instalaciones de antena",
                dias_atras=10,
            ),
            dict(
                reception_id="REC-2026-00005",
                item=consumibles[4],   # GPS Furuno GP-33
                tipo="nuevo",
                cantidad=3,
                seriales=["FUR-GP33-2026-A01", "FUR-GP33-2026-A02", "FUR-GP33-2026-A03"],
                ubicacion=alm_b,
                entregado_por_nombre="Josefina",
                entregado_por_apellido="Reyes Matos",
                entregado_por_cedula="004-0567890-1",
                entregado_por_rango_cargo="AN — Sección Navegación",
                observaciones="Equipos GPS nuevos para dotación de la flota — Oficio 2026-089",
                dias_atras=5,
            ),
        ]

        created = 0
        for s in seed:
            item = s["item"]
            brand = item.brand
            model = item.product_model
            cat   = item.category
            if not brand or not model or not cat:
                continue
            fecha = timezone.now() - timedelta(days=s["dias_atras"])
            ep, c = EntradaProducto.objects.get_or_create(
                reception_id=s["reception_id"],
                marca=brand,
                defaults={
                    "modelo": model,
                    "categoria": cat,
                    "base_product": item,
                    "tipo": s["tipo"],
                    "cantidad": s["cantidad"],
                    "seriales": s["seriales"],
                    "ubicacion": s["ubicacion"],
                    "observaciones": s["observaciones"],
                    "entregado_por_nombre": s["entregado_por_nombre"],
                    "entregado_por_apellido": s["entregado_por_apellido"],
                    "entregado_por_cedula": s["entregado_por_cedula"],
                    "entregado_por_rango_cargo": s["entregado_por_rango_cargo"],
                    "fecha_recepcion": fecha,
                    "registrado_por": almacenista,
                },
            )
            if c:
                StockMovement.objects.create(
                    item=item,
                    movement_type="entry",
                    quantity=s["cantidad"],
                    document_type="conduce",
                    document_number=s["reception_id"],
                    notes=f"Recepción {s['reception_id']} — {s['entregado_por_nombre']} {s['entregado_por_apellido']}",
                )
                item.quantity = (item.quantity or 0) + s["cantidad"]
                item.save(update_fields=["quantity"])
                created += 1

        self.stdout.write(f"  ✔ {created} recepciones creadas")

    # ──────────────────────────────────────────
    # PRÉSTAMOS DE HERRAMIENTAS (ItemLoan)
    # ──────────────────────────────────────────
    def _tool_loans(self, users, solicitantes, tool_units):
        from inventory.models import ItemLoan, ItemUnit

        almacenista = users.get("almacenista") or users["admin"]
        tecnico1    = users.get("tecnico")
        tecnico2    = None

        # collect all users to get tecnico2
        from django.contrib.auth import get_user_model
        User = get_user_model()
        tecnicos = list(User.objects.filter(role="tecnico", is_active=True))
        if len(tecnicos) >= 2:
            tecnico1 = tecnicos[0]
            tecnico2 = tecnicos[1]
        elif len(tecnicos) == 1:
            tecnico1 = tecnicos[0]

        available_units = [u for u in tool_units if u.status == ItemUnit.Status.AVAILABLE]
        if not available_units:
            self.stdout.write("  ! Sin unidades disponibles para préstamos")
            return

        loans_seed = [
            dict(
                unit_idx=0,  # Multímetro Fluke 87V ARD-87V-001
                loaned_to_user=tecnico1,
                loaned_to=None,
                notes="Asignado para diagnóstico de radio fragata F-101",
                days_loan=7,
                returned=False,
            ),
            dict(
                unit_idx=1,  # Multímetro Fluke 87V ARD-87V-002
                loaned_to_user=tecnico2 if tecnico2 else tecnico1,
                loaned_to=None,
                notes="Diagnóstico de sistemas de comunicaciones corbeta BM-454",
                days_loan=5,
                returned=True,
            ),
            dict(
                unit_idx=2 if len(available_units) > 2 else 0,  # Anritsu MS2034B
                loaned_to=solicitantes[0] if solicitantes else None,
                loaned_to_user=None,
                notes="Verificación de línea de antena radar — Fragata F-101",
                days_loan=3,
                returned=False,
            ),
        ]

        created = 0
        for s in loans_seed:
            unit_idx = s["unit_idx"]
            if unit_idx >= len(available_units):
                unit_idx = 0
            unit = available_units[unit_idx]

            # Skip if unit already has an active loan
            if ItemLoan.objects.filter(item_unit=unit, returned_at__isnull=True).exists():
                continue

            loaned_at = timezone.now() - timedelta(days=s["days_loan"])
            expected_return = loaned_at + timedelta(days=s["days_loan"] + 2)

            loan = ItemLoan(
                item_unit=unit,
                loaned_to=s.get("loaned_to"),
                loaned_to_user=s.get("loaned_to_user"),
                loaned_by=almacenista,
                expected_return_at=expected_return,
                notes=s["notes"],
            )
            loan.loaned_at = loaned_at
            loan.save()

            if s["returned"]:
                loan.returned_at = loaned_at + timedelta(days=s["days_loan"] - 1)
                loan.returned_to = almacenista
                loan.save()
                unit.status = ItemUnit.Status.AVAILABLE
            else:
                unit.status = ItemUnit.Status.ASIGNADO
            unit.save()
            created += 1

        self.stdout.write(f"  ✔ {created} préstamos de herramientas creados")
