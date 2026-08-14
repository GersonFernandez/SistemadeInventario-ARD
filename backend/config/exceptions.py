from django.db import IntegrityError
from django.db.models import ProtectedError, RestrictedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


def _friendly_integrity_message(raw_message: str) -> str:
    message = (raw_message or '').lower()

    if 'inventory_item_code_key' in message:
        return 'No se pudo generar un codigo unico para el articulo. Intente nuevamente.'
    if 'workorders_despacho_ot_number' in message:
        return 'No se pudo generar un numero unico de despacho. Intente nuevamente.'
    if 'workorders_serviceorder_service_number' in message:
        return 'No se pudo generar un numero unico de orden de servicio. Intente nuevamente.'
    if 'unique_product_model_per_brand' in message:
        return 'Ya existe un modelo con ese nombre para la marca seleccionada.'
    if 'unique_item_unit_serial' in message:
        return 'Ya existe una unidad con ese serial para el articulo seleccionado.'
    if 'unique_active_loan_per_unit' in message:
        return 'La unidad ya tiene un prestamo activo.'
    if 'uniq_service_order_item_serial' in message:
        return 'Ese producto y serial ya existen dentro de la orden de servicio.'
    if 'accounts_user_email_key' in message:
        return 'Ya existe un usuario con ese correo.'
    if 'accounts_user_agent_id_key' in message:
        return 'Ya existe un usuario con esa cedula o identificacion.'
    if 'inventory_category_name_key' in message:
        return 'Ya existe una categoria con ese nombre.'
    if 'inventory_brand_name_key' in message:
        return 'Ya existe una marca con ese nombre.'
    if 'inventory_productstate_code_key' in message:
        return 'Ya existe un estado de producto con ese codigo.'
    if 'inventory_productstate_name_key' in message:
        return 'Ya existe un estado de producto con ese nombre.'
    if 'inventory_unitmeasure_code_key' in message:
        return 'Ya existe una unidad de medida con ese codigo.'
    if 'inventory_unitmeasure_name_key' in message:
        return 'Ya existe una unidad de medida con ese nombre.'
    if 'inventory_locationtype_code_key' in message:
        return 'Ya existe un tipo de ubicacion con ese codigo.'
    if 'duplicate key value violates unique constraint' in message or 'unique constraint' in message:
        return 'Ya existe un registro con esos datos unicos. Verifique la informacion e intente nuevamente.'

    return 'No se pudo completar la operacion por una restriccion de datos. Verifique la informacion e intente nuevamente.'


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        return response

    if isinstance(exc, IntegrityError):
        return Response(
            {'detail': _friendly_integrity_message(str(exc))},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if isinstance(exc, (ProtectedError, RestrictedError)):
        return Response(
            {
                'detail': 'No se puede completar la operacion porque el registro tiene dependencias asociadas.'
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return None