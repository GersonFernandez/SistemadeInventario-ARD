from rest_framework import exceptions
from rest_framework_simplejwt.authentication import JWTAuthentication
from drf_spectacular.extensions import OpenApiAuthenticationExtension


class PasswordChangeRequiredJWTAuthentication(JWTAuthentication):
    allowed_url_names = {'change-password', 'logout', 'me'}

    def authenticate(self, request):
        authentication = super().authenticate(request)
        if authentication is None:
            return None

        user, token = authentication
        url_name = request.resolver_match.url_name if request.resolver_match else None
        if user.must_change_password and url_name not in self.allowed_url_names:
            raise exceptions.PermissionDenied(
                'Debe cambiar su contraseña temporal antes de continuar.',
                code='password_change_required',
            )
        return user, token


class PasswordChangeRequiredJWTScheme(OpenApiAuthenticationExtension):
    target_class = PasswordChangeRequiredJWTAuthentication
    name = 'jwtAuth'

    def get_security_definition(self, auto_schema):
        return {
            'type': 'http',
            'scheme': 'bearer',
            'bearerFormat': 'JWT',
        }