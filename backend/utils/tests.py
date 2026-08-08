from django.core.exceptions import ValidationError
from django.test import SimpleTestCase

from .validators import build_dominican_cedula, normalize_dominican_cedula


class DominicanCedulaValidatorTests(SimpleTestCase):
    def test_builds_valid_cedula_from_ten_digit_prefix(self):
        generated = build_dominican_cedula('4020000001')
        self.assertEqual(normalize_dominican_cedula(generated), generated)

    def test_accepts_and_formats_valid_cedula(self):
        self.assertEqual(normalize_dominican_cedula('00113918254'), '001-1391825-4')
        self.assertEqual(normalize_dominican_cedula('001-1391825-4'), '001-1391825-4')

    def test_accepts_known_jce_checksum_exception(self):
        self.assertEqual(normalize_dominican_cedula('40200700675'), '402-0070067-5')

    def test_rejects_invalid_check_digit(self):
        with self.assertRaises(ValidationError):
            normalize_dominican_cedula('001-1391825-0')

    def test_rejects_repeated_digits_and_invalid_format(self):
        for value in ('00000000000', '001 1391825 4', 'ABC-1234567-8'):
            with self.subTest(value=value), self.assertRaises(ValidationError):
                normalize_dominican_cedula(value)


class DominicanCedulaSerializerIntegrationTests(SimpleTestCase):
    def test_cedula_fields_normalize_valid_values(self):
        from inventory.serializers import EntradaProductoBatchCreateSerializer
        from workorders.serializers import ServiceOrderSerializer, SolicitanteSerializer

        cases = (
            (EntradaProductoBatchCreateSerializer, 'entregado_por_cedula'),
            (ServiceOrderSerializer, 'recipient_id_card'),
            (SolicitanteSerializer, 'agent_id'),
        )
        for serializer_class, field_name in cases:
            with self.subTest(serializer=serializer_class.__name__):
                serializer = serializer_class(data={field_name: '00113918254'}, partial=True)
                self.assertTrue(serializer.is_valid(), serializer.errors)
                self.assertEqual(serializer.validated_data[field_name], '001-1391825-4')

    def test_cedula_fields_reject_invalid_values(self):
        from inventory.serializers import EntradaProductoBatchCreateSerializer
        from workorders.serializers import ServiceOrderSerializer, SolicitanteSerializer

        cases = (
            (EntradaProductoBatchCreateSerializer, 'entregado_por_cedula'),
            (ServiceOrderSerializer, 'recipient_id_card'),
            (SolicitanteSerializer, 'agent_id'),
        )
        for serializer_class, field_name in cases:
            with self.subTest(serializer=serializer_class.__name__):
                serializer = serializer_class(data={field_name: '001-1391825-0'}, partial=True)
                self.assertFalse(serializer.is_valid())
                self.assertIn(field_name, serializer.errors)