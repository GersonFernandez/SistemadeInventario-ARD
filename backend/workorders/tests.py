"""Tests del módulo Despachos.

Cubren:
- Creación de despacho (consumibles)
- Creación de despacho con herramientas serializadas
- Validación de stock insuficiente
- Asignación de unidades (ItemUnit)
- Cancelación de despacho (reversión de movimientos)
"""
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from inventory.models import Item, ItemUnit, StockMovement, Category, Location, LocationType
from workorders.models import Despacho, LineaDespacho, Solicitante, ServiceOrder, ServiceOrderItem
from workorders.services import DispatchService


User = get_user_model()


def get_or_create_location_type(code='taller', name='Taller de Electrónica'):
    lt, _ = LocationType.objects.get_or_create(
        code=code,
        defaults={'name': name, 'is_active': True},
    )
    return lt


class DespachoServiceTest(TestCase):
    """Tests del servicio DispatchService."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='admin@armada.mil.do',
            password='Admin12345',
            name='Administrador',
            role='admin',
        )
        self.solicitante = Solicitante.objects.create(
            name='Capitán Pérez',
            rank='Capitán de Navío',
        )
        self.cat, _ = Category.objects.get_or_create(
            name='Componentes',
            defaults={'abbreviation': 'COM'},
        )
        self.taller, _ = Location.objects.get_or_create(
            codigo='TC',
            defaults={'name': 'Taller Central', 'location_type': get_or_create_location_type()},
        )
        self.item, _ = Item.objects.get_or_create(
            code='COM-001',
            defaults={
                'name': 'Resistencia 1kΩ',
                'category': self.cat,
                'location': self.taller,
                'quantity': 100,
                'minimum_stock': 20,
                'unit': 'unidad',
            },
        )

    def test_create_despacho_consumible_deducts_stock(self):
        """Despacho de consumible descuenta stock y crea StockMovement.EXIT."""
        initial_qty = self.item.quantity
        result = DispatchService.create(
            user=self.user,
            solicitante_id=self.solicitante.id,
            unit_id=None,
            equipment_reference='',
            notes='',
            items=[{'item_id': self.item.id, 'quantity': 5, 'item_unit_id': None, 'notes': ''}],
        )
        self.assertEqual(result.status, Despacho.Status.ISSUED)
        self.assertEqual(result.lineas.count(), 1)
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, initial_qty - 5)
        self.assertEqual(StockMovement.objects.filter(movement_type='exit', item=self.item).count(), 1)

    def test_create_despacho_insufficient_stock_fails(self):
        """Falla atómicamente si no hay stock suficiente."""
        from rest_framework.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            DispatchService.create(
                user=self.user,
                solicitante_id=self.solicitante.id,
                unit_id=None,
                equipment_reference='',
                notes='',
                items=[{'item_id': self.item.id, 'quantity': 999, 'item_unit_id': None, 'notes': ''}],
            )
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 100)

    def test_create_despacho_herramienta_assigns_unit(self):
        """Despacho de herramienta asigna ItemUnit (status='asignado'), no descuenta quantity."""
        from inventory.models import ItemLoan
        herramienta = Item.objects.create(
            name='Multímetro Fluke 87V',
            code='HERR-001',
            category=self.cat,
            location=self.taller,
            kind='herramienta',
            track_by_serial=True,
            quantity=0,
            unit='unidad',
        )
        unit = ItemUnit.objects.create(
            item=herramienta,
            serial_number='FL-001',
            status='available',
        )
        result = DispatchService.create(
            user=self.user,
            solicitante_id=self.solicitante.id,
            unit_id=None,
            equipment_reference='',
            notes='',
            items=[{'item_id': herramienta.id, 'quantity': 1, 'item_unit_id': unit.id, 'notes': ''}],
        )
        self.assertEqual(result.status, Despacho.Status.ISSUED)
        unit.refresh_from_db()
        self.assertEqual(unit.status, ItemUnit.Status.ASIGNADO)
        self.assertEqual(ItemLoan.objects.filter(item_unit=unit, returned_at__isnull=True).count(), 1)

    def test_cancel_despacho_restores_stock(self):
        """Cancelar un despacho revierte el stock y libera unidades asignadas."""
        result = DispatchService.create(
            user=self.user,
            solicitante_id=self.solicitante.id,
            unit_id=None,
            equipment_reference='',
            notes='',
            items=[{'item_id': self.item.id, 'quantity': 10, 'item_unit_id': None, 'notes': ''}],
        )
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 90)
        DispatchService.cancel(despacho=result, user=self.user, reason='Error en OT')
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 100)
        result.refresh_from_db()
        self.assertEqual(result.status, Despacho.Status.CANCELLED)

    def test_cancel_despacho_herramienta_releases_unit(self):
        herramienta = Item.objects.create(
            name='Multímetro',
            code='HERR-002',
            category=self.cat,
            location=self.taller,
            kind='herramienta',
            track_by_serial=True,
            quantity=0,
        )
        unit = ItemUnit.objects.create(
            item=herramienta,
            serial_number='FL-002',
            status='available',
        )
        result = DispatchService.create(
            user=self.user,
            solicitante_id=self.solicitante.id,
            unit_id=None,
            equipment_reference='',
            notes='',
            items=[{'item_id': herramienta.id, 'quantity': 1, 'item_unit_id': unit.id, 'notes': ''}],
        )
        unit.refresh_from_db()
        self.assertEqual(unit.status, ItemUnit.Status.ASIGNADO)
        DispatchService.cancel(despacho=result, user=self.user, reason='Cancelar')
        unit.refresh_from_db()
        self.assertEqual(unit.status, ItemUnit.Status.AVAILABLE)


class DespachoAPITest(TestCase):
    """Tests de los endpoints de Despacho."""

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
        self.client.force_authenticate(user=self.admin)
        self.solicitante = Solicitante.objects.create(name='Capitán Pérez')
        self.cat, _ = Category.objects.get_or_create(
            name='Componentes',
            defaults={'abbreviation': 'COM'},
        )
        self.taller, _ = Location.objects.get_or_create(
            codigo='TC',
            defaults={'name': 'Taller Central', 'location_type': get_or_create_location_type()},
        )
        self.item, _ = Item.objects.get_or_create(
            code='COM-001',
            defaults={
                'name': 'Resistencia 1kΩ',
                'category': self.cat,
                'location': self.taller,
                'quantity': 100,
                'minimum_stock': 20,
            },
        )

    def test_create_despacho_endpoint(self):
        response = self.client.post('/api/v1/work-orders/despachos/', {
            'solicitante_id': self.solicitante.id,
            'unit_id': None,
            'equipment_reference': '',
            'notes': '',
            'items': [{'item_id': self.item.id, 'quantity': 5, 'item_unit_id': None, 'notes': ''}],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.json())
        data = response.json()
        self.assertEqual(data['status'], 'issued')
        self.assertTrue(data['ot_number'].startswith('DV-'))
        self.assertEqual(data['lineas_count'], 1)

    def test_create_despacho_without_solicitante_fails(self):
        response = self.client.post('/api/v1/work-orders/despachos/', {
            'solicitante_id': None,
            'items': [{'item_id': self.item.id, 'quantity': 1, 'item_unit_id': None}],
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_create_despacho_with_empty_items_fails(self):
        response = self.client.post('/api/v1/work-orders/despachos/', {
            'solicitante_id': self.solicitante.id,
            'items': [],
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_cancel_despacho_endpoint(self):
        create_resp = self.client.post('/api/v1/work-orders/despachos/', {
            'solicitante_id': self.solicitante.id,
            'items': [{'item_id': self.item.id, 'quantity': 5, 'item_unit_id': None}],
        }, format='json')
        self.assertEqual(create_resp.status_code, 201)
        did = create_resp.json()['id']
        cancel_resp = self.client.post(
            f'/api/v1/work-orders/despachos/{did}/cancel/',
            {'reason': 'Error'},
            format='json',
        )
        self.assertEqual(cancel_resp.status_code, 200, cancel_resp.json())
        self.assertEqual(cancel_resp.json()['status'], 'cancelled')
        self.item.refresh_from_db()
        self.assertEqual(self.item.quantity, 100)

    def test_cancel_without_reason_fails(self):
        create_resp = self.client.post('/api/v1/work-orders/despachos/', {
            'solicitante_id': self.solicitante.id,
            'items': [{'item_id': self.item.id, 'quantity': 5, 'item_unit_id': None}],
        }, format='json')
        did = create_resp.json()['id']
        cancel_resp = self.client.post(
            f'/api/v1/work-orders/despachos/{did}/cancel/',
            {'reason': ''},
            format='json',
        )
        self.assertEqual(cancel_resp.status_code, 400)

    def test_list_despachos(self):
        self.client.post('/api/v1/work-orders/despachos/', {
            'solicitante_id': self.solicitante.id,
            'items': [{'item_id': self.item.id, 'quantity': 1, 'item_unit_id': None}],
        }, format='json')
        response = self.client.get('/api/v1/work-orders/despachos/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.json()), 1)


class SolicitanteAPITest(TestCase):
    """Tests de los endpoints de Solicitante."""

    def setUp(self):
        self.user = User.objects.create_user(
            email='admin@armada.mil.do',
            password='Admin12345',
            name='Admin',
            role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_list_solicitantes(self):
        Solicitante.objects.create(name='Capitán Pérez')
        response = self.client.get('/api/v1/work-orders/solicitantes/')
        self.assertEqual(response.status_code, 200)

    def test_create_solicitante_rejects_invalid_dominican_cedula(self):
        response = self.client.post('/api/v1/work-orders/solicitantes/', {
            'name': 'Solicitante con cédula inválida',
            'agent_id': '001-1391825-0',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('agent_id', response.json())

    def test_search_solicitante(self):
        Solicitante.objects.create(name='Capitán Pérez', rank='Capitán')
        Solicitante.objects.create(name='Teniente Gómez', rank='Teniente')
        response = self.client.get('/api/v1/work-orders/solicitantes/?search=Capitán')
        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Capitán Pérez')

    def test_create_solicitante(self):
        response = self.client.post('/api/v1/work-orders/solicitantes/', {
            'name': 'Teniente López',
            'rank': 'Teniente de Navío',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Solicitante.objects.count(), 1)


class ServiceOrderCreateAPITest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='create.srv@armada.mil.do',
            password='Admin12345',
            name='Admin SRV Create',
            role='admin',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.cat, _ = Category.objects.get_or_create(
            name='Equipos',
            defaults={'abbreviation': 'EQP'},
        )
        self.location, _ = Location.objects.get_or_create(
            codigo='SRV-CRT',
            defaults={'name': 'Taller Servicio Create', 'location_type': get_or_create_location_type()},
        )
        self.item, _ = Item.objects.get_or_create(
            code='EQP-101',
            defaults={
                'name': 'Radio VHF Marino',
                'category': self.cat,
                'location': self.location,
                'quantity': 5,
                'minimum_stock': 1,
                'is_base_product': True,
                'is_active': True,
            },
        )

    def test_create_service_order_from_write_items_payload(self):
        response = self.client.post('/api/v1/work-orders/service-orders/', {
            'service_type': 'reparacion',
            'assigned_technician': None,
            'unit': None,
            'recipient_first_name': '',
            'recipient_last_name': '',
            'recipient_id_card': '',
            'recipient_rank_position': '',
            'notes': 'Prueba de creación',
            'write_items': [{
                'item': self.item.id,
                'serial_number': 'SRV-ABC-123',
                'description': 'Equipo principal',
                'equipment_condition': 'usado',
            }],
        }, format='json')

        self.assertEqual(response.status_code, 201, response.json())
        data = response.json()
        self.assertEqual(data['service_type'], 'reparacion')
        self.assertEqual(ServiceOrder.objects.count(), 1)
        self.assertEqual(ServiceOrderItem.objects.count(), 1)
        self.assertEqual(ServiceOrder.objects.get(pk=data['id']).equipment_id, self.item.id)

    def test_create_service_order_rejects_invalid_dominican_cedula(self):
        response = self.client.post('/api/v1/work-orders/service-orders/', {
            'service_type': 'reparacion',
            'recipient_id_card': '001-1391825-0',
            'write_items': [{
                'item': self.item.id,
                'serial_number': 'SRV-CED-001',
                'description': 'Equipo de prueba',
                'equipment_condition': 'usado',
            }],
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('recipient_id_card', response.json())


class ServiceOrderReceiptAPITest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin.srv@armada.mil.do',
            password='Admin12345',
            name='Admin SRV',
            role='admin',
        )
        self.tech = User.objects.create_user(
            email='tech.srv@armada.mil.do',
            password='Tech12345',
            name='Tecnico SRV',
            role='tecnico',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.cat, _ = Category.objects.get_or_create(
            name='Equipos',
            defaults={'abbreviation': 'EQP'},
        )
        self.location, _ = Location.objects.get_or_create(
            codigo='SRV',
            defaults={'name': 'Taller Servicio', 'location_type': get_or_create_location_type()},
        )
        self.item, _ = Item.objects.get_or_create(
            code='EQP-001',
            defaults={
                'name': 'Radio VHF Marino',
                'category': self.cat,
                'location': self.location,
                'quantity': 5,
                'minimum_stock': 1,
                'is_base_product': True,
                'is_active': True,
            },
        )

        self.service_order = ServiceOrder.objects.create(
            service_type=ServiceOrder.ServiceType.REPARACION,
            equipment=self.item,
            equipment_serial_number='SRV-ABC-123',
            equipment_condition=ServiceOrder.EquipmentCondition.USADO,
            assigned_technician=self.tech,
            created_by=self.admin,
            unit=self.location,
            status=ServiceOrder.Status.COMPLETADO,
            diagnosis='Falla en etapa de potencia RF.',
            work_performed='Reemplazo de transistores y calibracion final.',
            recipient_first_name='Juan',
            recipient_last_name='Perez',
            recipient_id_card='001-1234567-8',
            recipient_rank_position='Teniente de Fragata',
        )
        ServiceOrderItem.objects.create(
            service_order=self.service_order,
            item=self.item,
            serial_number='SRV-ABC-123',
            description='Equipo principal de comunicacion',
            equipment_condition=ServiceOrder.EquipmentCondition.USADO,
        )

    def test_download_completion_receipt_pdf(self):
        response = self.client.get(
            f'/api/v1/work-orders/service-orders/{self.service_order.id}/completion_receipt/?type=pdf'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('cierre_', response['Content-Disposition'])
        body = b''.join(response.streaming_content)
        self.assertGreater(len(body), 1000)

    def test_download_completion_receipt_invalid_format(self):
        response = self.client.get(
            f'/api/v1/work-orders/service-orders/{self.service_order.id}/completion_receipt/?type=doc'
        )
        self.assertEqual(response.status_code, 400)

    def test_download_completion_receipt_requires_completed_order(self):
        self.service_order.status = ServiceOrder.Status.EN_PROCESO
        self.service_order.save(update_fields=['status', 'updated_at'])
        response = self.client.get(
            f'/api/v1/work-orders/service-orders/{self.service_order.id}/completion_receipt/?type=pdf'
        )
        self.assertEqual(response.status_code, 400)
