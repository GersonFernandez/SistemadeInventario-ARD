import re

from django.core.exceptions import ValidationError


CEDULA_ERROR = 'Ingrese una cédula dominicana válida en formato 000-0000000-0.'
CEDULA_CHECKSUM_EXCEPTIONS = {
    '00000000018',
    '00100759932',
    '00105606543',
    '00114272370',
    '00114532330',
    '00200123640',
    '00200409772',
    '00800106971',
    '01200004166',
    '01400000282',
    '03103749672',
    '03121982479',
    '03800032522',
    '03900192284',
    '04900026260',
    '05900072869',
    '07700009346',
    '11111111123',
    '40200700675',
}


def build_dominican_cedula(prefix):
    digits = re.sub(r'\D', '', str(prefix or ''))
    if len(digits) != 10 or len(set(digits)) == 1:
        raise ValueError('La base de la cédula debe contener 10 dígitos no repetidos.')

    checksum_sum = 0
    for index, digit in enumerate(digits):
        product = int(digit) * (1 if index % 2 == 0 else 2)
        checksum_sum += product if product < 10 else product - 9

    check_digit = (10 - checksum_sum % 10) % 10
    return f'{digits[:3]}-{digits[3:]}-{check_digit}'


def normalize_dominican_cedula(value):
    raw_value = str(value or '').strip()
    if not re.fullmatch(r'(?:\d{11}|\d{3}-\d{7}-\d)', raw_value):
        raise ValidationError(CEDULA_ERROR, code='invalid_dominican_cedula')

    digits = raw_value.replace('-', '')
    if digits in CEDULA_CHECKSUM_EXCEPTIONS:
        return f'{digits[:3]}-{digits[3:10]}-{digits[10]}'

    if len(set(digits)) == 1:
        raise ValidationError(CEDULA_ERROR, code='invalid_dominican_cedula')

    if build_dominican_cedula(digits[:10]) != f'{digits[:3]}-{digits[3:10]}-{digits[10]}':
        raise ValidationError(CEDULA_ERROR, code='invalid_dominican_cedula')

    return f'{digits[:3]}-{digits[3:10]}-{digits[10]}'


def validate_dominican_cedula(value):
    normalize_dominican_cedula(value)