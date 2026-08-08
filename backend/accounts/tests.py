from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()


class UserModelTests(TestCase):
    def test_create_user_with_email(self):
        user = User.objects.create_user(email='tecnico@armada.mil', password='testpass123', name='Técnico Uno')
        self.assertEqual(user.email, 'tecnico@armada.mil')
        self.assertEqual(user.role, User.Role.TECNICO)
        self.assertTrue(user.check_password('testpass123'))

    def test_create_superuser(self):
        admin = User.objects.create_superuser(email='admin@armada.mil', password='adminpass123', name='Admin')
        self.assertTrue(admin.is_superuser)
        self.assertTrue(admin.is_staff)
        self.assertEqual(admin.role, User.Role.ADMIN)

    def test_email_normalized(self):
        user = User.objects.create_user(email='Test@ARMADA.MIL', password='testpass123', name='Test')
        self.assertEqual(user.email, 'Test@armada.mil')


class AuthAPITests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='tecnico@armada.mil',
            password='testpass123',
            name='Técnico Uno',
            role=User.Role.TECNICO
        )

    def test_login_returns_tokens(self):
        response = self.client.post('/api/v1/auth/login/', {
            'email': 'tecnico@armada.mil',
            'password': 'testpass123',
        }, content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.json())
        self.assertIn('refresh', response.json())

    def test_me_requires_authentication(self):
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, 401)

    def test_me_returns_user_data(self):
        login = self.client.post('/api/v1/auth/login/', {
            'email': 'tecnico@armada.mil',
            'password': 'testpass123',
        }, content_type='application/json')
        token = login.json()['access']
        response = self.client.get('/api/v1/auth/me/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['email'], 'tecnico@armada.mil')


class UserPasswordSecurityTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@armada.mil',
            password='AdminSecure!2026',
            name='Administrador',
            role=User.Role.ADMIN,
        )
        login = self.client.post('/api/v1/auth/login/', {
            'email': self.admin.email,
            'password': 'AdminSecure!2026',
        }, content_type='application/json')
        self.authorization = f"Bearer {login.json()['access']}"

    def test_admin_created_password_is_hashed_temporary_and_never_returned(self):
        temporary_password = 'TemporalSecure!2026'
        response = self.client.post('/api/v1/users/', {
            'email': 'nuevo@armada.mil',
            'name': 'Usuario Nuevo',
            'role': User.Role.TECNICO,
            'password': temporary_password,
        }, content_type='application/json', HTTP_AUTHORIZATION=self.authorization)

        self.assertEqual(response.status_code, 201)
        self.assertNotIn('password', response.json())
        user = User.objects.get(email='nuevo@armada.mil')
        self.assertNotEqual(user.password, temporary_password)
        self.assertTrue(user.check_password(temporary_password))
        self.assertTrue(user.must_change_password)

    def test_admin_can_create_multiple_users_without_agent_id(self):
        for index in range(2):
            response = self.client.post('/api/v1/users/', {
                'email': f'sin-matricula-{index}@armada.mil',
                'name': f'Usuario Sin Matrícula {index}',
                'role': User.Role.TECNICO,
                'agent_id': '',
                'password': 'TemporalSecure!2026',
            }, content_type='application/json', HTTP_AUTHORIZATION=self.authorization)

            self.assertEqual(response.status_code, 201)

        self.assertEqual(
            User.objects.filter(email__startswith='sin-matricula-', agent_id__isnull=True).count(),
            2,
        )

    def test_user_update_cannot_assign_a_password(self):
        user = User.objects.create_user(
            email='editable@armada.mil',
            password='OriginalSecure!2026',
            name='Usuario Editable',
        )
        response = self.client.patch(
            f'/api/v1/users/{user.id}/',
            {'name': 'Nombre Actualizado', 'password': 'InjectedSecure!2026'},
            content_type='application/json',
            HTTP_AUTHORIZATION=self.authorization,
        )

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('password', response.json())
        user.refresh_from_db()
        self.assertEqual(user.name, 'Nombre Actualizado')
        self.assertTrue(user.check_password('OriginalSecure!2026'))
        self.assertFalse(user.check_password('InjectedSecure!2026'))

    def test_non_admin_cannot_manage_users(self):
        almacenista = User.objects.create_user(
            email='almacenista@armada.mil',
            password='AlmacenSecure!2026',
            name='Almacenista',
            role=User.Role.ALMACENISTA,
        )
        login = self.client.post('/api/v1/auth/login/', {
            'email': almacenista.email,
            'password': 'AlmacenSecure!2026',
        }, content_type='application/json')
        response = self.client.get(
            '/api/v1/users/',
            HTTP_AUTHORIZATION=f"Bearer {login.json()['access']}",
        )

        self.assertEqual(response.status_code, 403)

    def test_temporary_password_blocks_api_until_changed(self):
        user = User.objects.create_user(
            email='temporal@armada.mil',
            password='TemporarySecure!2026',
            name='Usuario Temporal',
            must_change_password=True,
        )
        login = self.client.post('/api/v1/auth/login/', {
            'email': user.email,
            'password': 'TemporarySecure!2026',
        }, content_type='application/json')
        token = login.json()['access']

        blocked = self.client.get('/api/v1/settings/session/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(blocked.status_code, 403)

        changed = self.client.post('/api/v1/auth/change-password/', {
            'current_password': 'TemporarySecure!2026',
            'new_password': 'PermanentSecure!2026',
            'confirm_new_password': 'PermanentSecure!2026',
        }, content_type='application/json', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(changed.status_code, 200)

        user.refresh_from_db()
        self.assertFalse(user.must_change_password)
        self.assertTrue(user.check_password('PermanentSecure!2026'))
        allowed = self.client.get('/api/v1/settings/session/', HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(allowed.status_code, 200)
