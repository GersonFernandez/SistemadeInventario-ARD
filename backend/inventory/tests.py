from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from .models import Category, Item, StockMovement, Location, LocationType, Transfer, ItemUnit, ItemLoan, UnitMeasure
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


def get_or_create_location_type(code='taller', name='Taller de Electrónica'):
    """Helper: obtiene o crea un LocationType por código."""
    lt, _ = LocationType.objects.get_or_create(
        code=code,
        defaults={'name': name, 'is_active': True},
    )
    return lt


class CategoryModelTest(TestCase):
    def test_create_category(self):
        category = Category.objects.create(name='Electronicos', description='Componentes electronicos')
        self.assertEqual(str(category), 'Electronicos')


class ItemModelTest(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Resistencias')
        self.item = Item.objects.create(
            name='Resistencia 10kOhm',
            sku='R-10K',
            category=self.category,
            quantity=5,
            minimum_stock=10,
        )

    def test_item_is_critical(self):
        self.assertTrue(self.item.is_critical)

    def test_item_not_critical(self):
        self.item.quantity = 20
        self.item.save()
        self.assertFalse(self.item.is_critical)

    def test_item_marca_modelo_serial(self):
        item = Item.objects.create(
            name='Radio Harris',
            sku='HARRIS-001',
            marca='Harris',
            modelo='RF-7800V',
            numero_serie='SN-12345',
            category=self.category,
        )
        self.assertEqual(item.marca, 'Harris')
        self.assertEqual(item.modelo, 'RF-7800V')
        self.assertEqual(item.numero_serie, 'SN-12345')


class LocationModelTest(TestCase):
    def test_create_taller_root(self):
        taller = Location.objects.create(
            name='Taller de Electrónica',
            location_type=get_or_create_location_type(),
        )
        self.assertEqual(taller.location_type.code, 'taller')
        self.assertIsNone(taller.parent)
        self.assertIn('Taller', str(taller))

    def test_location_hierarchy(self):
        taller = Location.objects.create(name='Taller', location_type=get_or_create_location_type())
        base = Location.objects.create(
            name='Base Naval 27F',
            location_type=get_or_create_location_type('base_naval', 'Base Naval'),
            parent=taller,
        )
        unidad = Location.objects.create(
            name='GC-101',
            location_type=get_or_create_location_type('unidad_naval', 'Unidad Naval'),
            parent=base,
        )
        breadcrumb = unidad.get_breadcrumb()
        self.assertIn('Taller', breadcrumb)
        self.assertIn('Base Naval 27F', breadcrumb)
        self.assertIn('GC-101', breadcrumb)

    def test_location_creation(self):
        taller = Location.objects.create(name='Taller Central', location_type=get_or_create_location_type())
        base = Location.objects.create(
            name='Base Naval 27F',
            location_type=get_or_create_location_type('base_naval', 'Base Naval'),
        )
        self.assertEqual(taller.location_type.code, 'taller')
        self.assertIsNone(taller.parent)
        self.assertIsNone(base.parent)
        self.assertEqual(str(taller), 'Taller de Electrónica - Taller Central')


class TransferModelTest(TestCase):
    def setUp(self):
        self.category = Category.objects.create(name='Equipos')
        self.item = Item.objects.create(name='Radio Test', category=self.category, quantity=1)
        self.taller = Location.objects.create(name='Taller', location_type=get_or_create_location_type())
        self.base = Location.objects.create(
            name='Base Naval',
            location_type=get_or_create_location_type('base_naval', 'Base Naval'),
            parent=self.taller,
        )
        self.admin = User.objects.create_user(
            email='admin@test.com',
            password='Test12345',
            name='Admin',
            role=User.Role.ADMIN,
        )

    def test_create_transfer(self):
        transfer = Transfer.objects.create(
            item=self.item,
            origin_location=self.taller,
            destination_location=self.base,
            requested_by=self.admin,
            quantity=1,
        )
        self.assertEqual(transfer.status, Transfer.Status.PENDIENTE)
        self.assertEqual(transfer.requested_by, self.admin)
        self.assertIn('→', str(transfer))


class InventoryAPITest(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@armada.mil.do',
            password='Admin12345',
            name='Admin',
            role=User.Role.ADMIN,
        )
        self.almacenista = User.objects.create_user(
            email='almacenista@armada.mil.do',
            password='Almacen123',
            name='Almacenista',
            role=User.Role.ALMACENISTA,
        )
        self.tecnico = User.objects.create_user(
            email='tecnico@armada.mil.do',
            password='Tecnico123',
            name='Tecnico',
            role=User.Role.TECNICO,
        )
        self.category = Category.objects.create(name='Capacitores')
        self.item = Item.objects.create(
            name='Capacitor 100uF',
            sku='C-100UF',
            category=self.category,
            quantity=20,
            minimum_stock=5,
        )

    def test_list_items_authenticated(self):
        self.client.force_authenticate(user=self.tecnico)
        response = self.client.get('/api/v1/inventory/items/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_list_products_endpoint_returns_items(self):
        self.client.force_authenticate(user=self.almacenista)
        response = self.client.get('/api/v1/products/items/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_create_item_requires_almacenista(self):
        self.client.force_authenticate(user=self.tecnico)
        response = self.client.post('/api/v1/inventory/items/', {
            'name': 'Diodo',
            'sku': 'D-001',
            'category': self.category.id,
            'minimum_stock': 0,
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_item_as_almacenista(self):
        self.client.force_authenticate(user=self.almacenista)
        response = self.client.post('/api/v1/inventory/items/', {
            'name': 'Diodo',
            'sku': 'D-001',
            'category': self.category.id,
            'minimum_stock': 0,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_list_unit_measures(self):
        UnitMeasure.objects.create(code='und', name='Unidad')
        self.client.force_authenticate(user=self.tecnico)
        response = self.client.get('/api/v1/inventory/unit-measures/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_list_products_unit_measures_includes_inactive_records(self):
        self.client.force_authenticate(user=self.almacenista)
        unit = UnitMeasure.objects.create(code='jgo', name='Juego', is_active=False)

        response = self.client.get('/api/v1/products/unit-measures/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in response.data.get('results', response.data)]
        self.assertIn(unit.id, ids)

    def test_delete_unit_measure_soft_deletes_and_keeps_in_list(self):
        self.client.force_authenticate(user=self.almacenista)
        unit = UnitMeasure.objects.create(code='del', name='Delete', is_active=True)

        response = self.client.delete(f'/api/v1/products/unit-measures/{unit.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        unit.refresh_from_db()
        self.assertFalse(unit.is_active)

        list_response = self.client.get('/api/v1/products/unit-measures/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in list_response.data.get('results', list_response.data)]
        self.assertIn(unit.id, ids)

    def test_delete_item_soft_deletes_and_keeps_in_list(self):
        self.client.force_authenticate(user=self.almacenista)

        response = self.client.delete(f'/api/v1/inventory/items/{self.item.id}/')

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.item.refresh_from_db()
        self.assertFalse(self.item.is_active)

        list_response = self.client.get('/api/v1/inventory/items/')
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        ids = [item['id'] for item in list_response.data.get('results', list_response.data)]
        self.assertIn(self.item.id, ids)

    def test_stock_entry_increases_quantity(self):
        self.client.force_authenticate(user=self.almacenista)
        response = self.client.post('/api/v1/inventory/stock-movements/', {
            'item': self.item.id,
            'movement_type': StockMovement.MovementType.ENTRY,
            'quantity': 10,
            'document_type': StockMovement.DocumentType.FACTURA,
            'document_number': 'FAC-001',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 30)

    def test_stock_exit_decreases_quantity(self):
        self.client.force_authenticate(user=self.almacenista)
        response = self.client.post('/api/v1/inventory/stock-movements/', {
            'item': self.item.id,
            'movement_type': StockMovement.MovementType.EXIT,
            'quantity': 5,
            'document_type': StockMovement.DocumentType.CONDUCE,
            'document_number': 'CON-001',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 15)

    def test_stock_exit_with_insufficient_stock_fails(self):
        self.client.force_authenticate(user=self.almacenista)
        response = self.client.post('/api/v1/inventory/stock-movements/', {
            'item': self.item.id,
            'movement_type': StockMovement.MovementType.EXIT,
            'quantity': 100,
            'document_type': StockMovement.DocumentType.CONDUCE,
            'document_number': 'CON-002',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_transfer_and_approve(self):
        self.client.force_authenticate(user=self.almacenista)
        taller = Location.objects.create(name='Taller', location_type=get_or_create_location_type())
        base = Location.objects.create(
            name='Base Naval',
            location_type=get_or_create_location_type('base_naval', 'Base Naval'),
            parent=taller,
        )
        self.item.location = taller
        self.item.save()
        response = self.client.post('/api/v1/inventory/transfers/', {
            'item': self.item.id,
            'origin_location': taller.id,
            'destination_location': base.id,
            'quantity': 1,
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        transfer_id = response.data['id']

        response = self.client.post(f'/api/v1/inventory/transfers/{transfer_id}/approve/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['status'], 'completada')

        self.item.refresh_from_db()
        self.assertEqual(self.item.location, base)

    def test_locations_list_flat(self):
        self.client.force_authenticate(user=self.tecnico)
        Location.objects.create(name='Taller Central', location_type=get_or_create_location_type())
        Location.objects.create(
            name='Base Naval 27F',
            location_type=get_or_create_location_type('base_naval', 'Base Naval'),
        )
        Location.objects.create(
            name='GC-101',
            location_type=get_or_create_location_type('unidad_naval', 'Unidad Naval'),
        )

        response = self.client.get('/api/v1/inventory/locations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 3)


class LocationTypeAPITest(TestCase):
    """Tests del CRUD de tipos de ubicación."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@armada.mil.do',
            password='Admin12345',
            name='Admin',
            role='admin',
        )
        self.alm = User.objects.create_user(
            email='alm@armada.mil.do',
            password='Almacen123',
            name='Almacenista',
            role='almacenista',
        )
        self.client = APIClient()

    def test_list_location_types(self):
        self.client.force_authenticate(user=self.admin)
        LocationType.objects.create(code='buque', name='Buque', is_active=True)
        response = self.client.get('/api/v1/inventory/location-types/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        codes = [lt['code'] for lt in response.json()]
        self.assertIn('buque', codes)

    def test_search_location_types(self):
        self.client.force_authenticate(user=self.admin)
        LocationType.objects.create(code='fragata', name='Fragata', is_active=True)
        LocationType.objects.create(code='destructor', name='Destructor', is_active=True)
        response = self.client.get('/api/v1/inventory/location-types/?search=Frag')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.json()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['code'], 'fragata')

    def test_create_location_type(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post('/api/v1/inventory/location-types/', {
            'code': 'patrullera',
            'name': 'Patrullera',
            'description': 'Embarcación menor',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.json())
        self.assertTrue(LocationType.objects.filter(code='patrullera').exists())

    def test_create_location_type_as_tecnico_fails(self):
        tecnico = User.objects.create_user(
            email='tec@armada.mil.do',
            password='Tecnico123',
            name='Técnico',
            role='tecnico',
        )
        self.client.force_authenticate(user=tecnico)
        response = self.client.post('/api/v1/inventory/location-types/', {
            'code': 'xxx',
            'name': 'X',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_delete_location_type_with_locations_fails(self):
        self.client.force_authenticate(user=self.admin)
        lt = get_or_create_location_type('taller', 'Taller de Electrónica')
        Location.objects.create(name='Taller 1', location_type=lt)
        response = self.client.delete(f'/api/v1/inventory/location-types/{lt.id}/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ItemUnitSetStatusTest(TestCase):
    """Tests del endpoint set_status para ItemUnit."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@armada.mil.do',
            password='Admin12345',
            name='Admin',
            role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.cat, _ = Category.objects.get_or_create(
            name='Componentes',
            defaults={'abbreviation': 'COM'},
        )
        self.item, _ = Item.objects.get_or_create(
            code='HERR-TEST-001',
            defaults={
                'name': 'Multímetro',
                'category': self.cat,
                'kind': 'herramienta',
                'track_by_serial': True,
                'quantity': 0,
            },
        )
        self.unit, _ = ItemUnit.objects.get_or_create(
            item=self.item,
            serial_number='TEST-001',
            defaults={'status': 'available'},
        )

    def test_set_status_to_maintenance(self):
        response = self.client.post(f'/api/v1/inventory/item-units/{self.unit.id}/set_status/', {
            'status': 'maintenance',
            'reason': 'Calibración anual',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        self.unit.refresh_from_db()
        self.assertEqual(self.unit.status, 'maintenance')

    def test_set_status_to_disposed(self):
        response = self.client.post(f'/api/v1/inventory/item-units/{self.unit.id}/set_status/', {
            'status': 'disposed',
            'reason': 'Daño irreparable',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.json())
        self.unit.refresh_from_db()
        self.assertEqual(self.unit.status, 'disposed')
        self.assertEqual(self.unit.disposal_reason, 'Daño irreparable')
        self.assertIsNotNone(self.unit.disposed_at)

    def test_set_status_to_available(self):
        self.unit.status = 'maintenance'
        self.unit.save()
        response = self.client.post(f'/api/v1/inventory/item-units/{self.unit.id}/set_status/', {
            'status': 'available',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.unit.refresh_from_db()
        self.assertEqual(self.unit.status, 'available')

    def test_set_status_invalid_value_fails(self):
        response = self.client.post(f'/api/v1/inventory/item-units/{self.unit.id}/set_status/', {
            'status': 'inventado',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_set_status_on_assigned_unit_fails(self):
        self.unit.status = 'asignado'
        self.unit.save()
        response = self.client.post(f'/api/v1/inventory/item-units/{self.unit.id}/set_status/', {
            'status': 'maintenance',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ItemUnitReceiveTest(TestCase):
    """Tests del endpoint receive para ItemUnit (recepción de devolución)."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@armada.mil.do',
            password='Admin12345',
            name='Admin',
            role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.cat, _ = Category.objects.get_or_create(
            name='Componentes',
            defaults={'abbreviation': 'COM'},
        )
        self.solicitante_cat, _ = Category.objects.get_or_create(
            name='Solicitantes',
            defaults={'abbreviation': 'SOL'},
        )
        self.item, _ = Item.objects.get_or_create(
            code='HERR-RX-001',
            defaults={
                'name': 'Multímetro RX',
                'category': self.solicitante_cat,
                'kind': 'herramienta',
                'track_by_serial': True,
                'quantity': 0,
            },
        )
        # Crear unit como 'available'; el ItemLoan.save() lo cambiará a 'asignado'
        self.unit, _ = ItemUnit.objects.get_or_create(
            item=self.item,
            serial_number='RX-001',
            defaults={'status': 'available'},
        )
        from django.utils import timezone
        from datetime import timedelta
        self.loan = ItemLoan.objects.create(
            item_unit=self.unit,
            loaned_by=self.admin,
            expected_return_at=timezone.now() + timedelta(days=7),
        )
        self.assertEqual(self.unit.status, 'asignado')

    def test_receive_unit_basic(self):
        """Devolución básica: la unidad queda 'available' y el loan se cierra."""
        self.assertEqual(self.unit.status, 'asignado')
        self.assertIsNone(self.loan.returned_at)
        response = self.client.post(
            f'/api/v1/inventory/item-units/{self.unit.id}/receive/',
            {'final_status': 'available'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.unit.refresh_from_db()
        self.loan.refresh_from_db()
        self.assertEqual(self.unit.status, 'available')
        self.assertIsNotNone(self.loan.returned_at)
        self.assertEqual(self.loan.returned_to, self.admin)

    def test_receive_unit_with_maintenance(self):
        """Estado final 'maintenance': la unidad queda en reparación."""
        response = self.client.post(
            f'/api/v1/inventory/item-units/{self.unit.id}/receive/',
            {'final_status': 'maintenance', 'notes': 'Necesita calibración'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.unit.refresh_from_db()
        self.loan.refresh_from_db()
        self.assertEqual(self.unit.status, 'maintenance')
        self.assertIn('calibración', self.loan.notes)

    def test_receive_unit_with_disposed(self):
        """Estado final 'disposed': la unidad queda descargada con motivo."""
        response = self.client.post(
            f'/api/v1/inventory/item-units/{self.unit.id}/receive/',
            {'final_status': 'disposed', 'notes': 'Daño irreparable'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.unit.refresh_from_db()
        self.loan.refresh_from_db()
        self.assertEqual(self.unit.status, 'disposed')
        self.assertEqual(self.unit.disposal_reason, 'Daño irreparable')
        self.assertIsNotNone(self.unit.disposed_at)

    def test_receive_already_available_fails(self):
        """No se puede recibir una unidad que no está asignada."""
        self.unit.status = 'available'
        self.unit.save()
        response = self.client.post(
            f'/api/v1/inventory/item-units/{self.unit.id}/receive/',
            {'final_status': 'available'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_receive_invalid_final_status_fails(self):
        response = self.client.post(
            f'/api/v1/inventory/item-units/{self.unit.id}/receive/',
            {'final_status': 'inventado'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)


class ItemLoanExtendTest(TestCase):
    """Tests del endpoint extend para ItemLoan."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@armada.mil.do',
            password='Admin12345',
            name='Admin',
            role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.cat, _ = Category.objects.get_or_create(
            name='Componentes',
            defaults={'abbreviation': 'COM'},
        )
        self.item, _ = Item.objects.get_or_create(
            code='HERR-EXT-001',
            defaults={
                'name': 'Multímetro',
                'category': self.cat,
                'kind': 'herramienta',
                'track_by_serial': True,
            },
        )
        self.unit, _ = ItemUnit.objects.get_or_create(
            item=self.item,
            serial_number='EXT-001',
            defaults={'status': 'available'},
        )
        from django.utils import timezone
        from datetime import timedelta
        self.loan = ItemLoan.objects.create(
            item_unit=self.unit,
            loaned_by=self.admin,
            expected_return_at=timezone.now() + timedelta(days=7),
        )

    def test_extend_loan(self):
        original = self.loan.expected_return_at
        response = self.client.post(
            f'/api/v1/inventory/item-loans/{self.loan.id}/extend/',
            {'days': 14},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.loan.refresh_from_db()
        from django.utils import timezone
        expected = original + timezone.timedelta(days=14)
        self.assertAlmostEqual(
            self.loan.expected_return_at.timestamp(),
            expected.timestamp(),
            delta=1,
        )

    def test_extend_returned_loan_fails(self):
        from django.utils import timezone
        self.loan.returned_at = timezone.now()
        self.loan.save()
        response = self.client.post(
            f'/api/v1/inventory/item-loans/{self.loan.id}/extend/',
            {'days': 14},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_extend_with_zero_days_fails(self):
        response = self.client.post(
            f'/api/v1/inventory/item-loans/{self.loan.id}/extend/',
            {'days': 0},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_extend_with_excessive_days_fails(self):
        response = self.client.post(
            f'/api/v1/inventory/item-loans/{self.loan.id}/extend/',
            {'days': 999},
            format='json',
        )
        self.assertEqual(response.status_code, 400)


class ReportEndpointsTest(TestCase):
    """Tests de los nuevos endpoints de reporte (asignaciones e inventario crítico)."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@armada.mil.do',
            password='Admin12345',
            name='Admin',
            role='admin',
        )
        self.tecnico = User.objects.create_user(
            email='tec@armada.mil.do',
            password='Tecnico123',
            name='Técnico',
            role='tecnico',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)
        self.cat, _ = Category.objects.get_or_create(
            name='Componentes',
            defaults={'abbreviation': 'COM'},
        )
        self.item_normal, _ = Item.objects.get_or_create(
            code='RPT-NORM',
            defaults={'name': 'Capacitor', 'category': self.cat, 'quantity': 100, 'minimum_stock': 10, 'unit': 'und'},
        )
        self.item_critico, _ = Item.objects.get_or_create(
            code='RPT-CRIT',
            defaults={'name': 'Resistencia crítica', 'category': self.cat, 'quantity': 2, 'minimum_stock': 50, 'unit': 'und'},
        )
        self.item_herramienta, _ = Item.objects.get_or_create(
            code='RPT-HERR',
            defaults={'name': 'Multímetro', 'category': self.cat, 'kind': 'herramienta', 'track_by_serial': True, 'quantity': 0, 'unit': 'und'},
        )
        # Crear unit como 'available'; el ItemLoan.save() lo cambiará a 'asignado'
        self.unit = ItemUnit.objects.create(
            item=self.item_herramienta,
            serial_number='RPT-001',
            status='available',
        )
        self.loan_vigente = ItemLoan.objects.create(
            item_unit=self.unit,
            loaned_by=self.admin,
            expected_return_at=timezone.now() + timedelta(days=7),
        )
        # Para el préstamo vencido/devuelto, crear otra unidad
        self.unit2 = ItemUnit.objects.create(
            item=self.item_herramienta,
            serial_number='RPT-002',
            status='available',
        )
        self.loan_vencido = ItemLoan.objects.create(
            item_unit=self.unit2,
            loaned_by=self.admin,
            expected_return_at=timezone.now() - timedelta(days=3),
            returned_at=timezone.now() - timedelta(days=1),
        )

    def test_inventory_report_pdf_basic(self):
        response = self.client.get('/api/v1/inventory/items/report/?type=pdf')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('attachment', response['Content-Disposition'])

    def test_inventory_report_excel(self):
        response = self.client.get('/api/v1/inventory/items/report/?type=excel')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )

    def test_inventory_report_invalid_format(self):
        response = self.client.get('/api/v1/inventory/items/report/?type=csv')
        self.assertEqual(response.status_code, 400)

    def test_inventory_report_critical_filter(self):
        response = self.client.get('/api/v1/inventory/items/report/?type=pdf&critical=true')
        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment', response['Content-Disposition'])
        self.assertIn('critico', response['Content-Disposition'])

    def test_inventory_report_herramienta_filter(self):
        response = self.client.get('/api/v1/inventory/items/report/?type=excel&kind=herramienta')
        self.assertEqual(response.status_code, 200)
        self.assertIn('herramientas', response['Content-Disposition'])

    def test_loans_report_active_default(self):
        response = self.client.get('/api/v1/inventory/item-loans/report/?type=pdf')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        # FileResponse usa streaming_content en lugar de content
        body = b''.join(response.streaming_content)
        self.assertGreater(len(body), 1000)
        self.assertIn('asignaciones_', response['Content-Disposition'])

    def test_loans_report_overdue(self):
        # Crear un préstamo vencido (no devuelto) usando una nueva unidad
        unit3 = ItemUnit.objects.create(
            item=self.item_herramienta, serial_number='RPT-VENC', status='available',
        )
        ItemLoan.objects.create(
            item_unit=unit3,
            loaned_by=self.admin,
            expected_return_at=timezone.now() - timedelta(days=5),
        )
        response = self.client.get('/api/v1/inventory/item-loans/report/?type=pdf&overdue=true')
        self.assertEqual(response.status_code, 200)
        body = b''.join(response.streaming_content)
        self.assertGreater(len(body), 1000)

    def test_loans_report_historico(self):
        response = self.client.get('/api/v1/inventory/item-loans/report/?type=excel&status=all')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response['Content-Type'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        self.assertIn('asignaciones_', response['Content-Disposition'])

    def test_loans_report_invalid_format(self):
        response = self.client.get('/api/v1/inventory/item-loans/report/?type=pdfx')
        self.assertEqual(response.status_code, 400)

    def test_tecnico_cannot_access_reports(self):
        self.client.force_authenticate(user=self.tecnico)
        response = self.client.get('/api/v1/inventory/items/report/?type=pdf')
        self.assertEqual(response.status_code, 403)
        response = self.client.get('/api/v1/inventory/item-loans/report/?type=pdf')
        self.assertEqual(response.status_code, 403)
