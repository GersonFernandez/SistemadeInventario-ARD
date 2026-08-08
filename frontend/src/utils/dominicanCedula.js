export const DOMINICAN_CEDULA_ERROR = 'Ingrese una cédula dominicana válida en formato 000-0000000-0.'

const CHECKSUM_EXCEPTIONS = new Set([
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
])

export function formatDominicanCedula(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`
}

export function isValidDominicanCedula(value) {
  const rawValue = String(value || '').trim()
  if (!/^(?:\d{11}|\d{3}-\d{7}-\d)$/.test(rawValue)) return false

  const digits = rawValue.replace(/-/g, '')
  if (CHECKSUM_EXCEPTIONS.has(digits)) return true
  if (new Set(digits).size === 1) return false

  const checksumSum = digits.slice(0, 10).split('').reduce((total, digit, index) => {
    const product = Number(digit) * (index % 2 === 0 ? 1 : 2)
    return total + (product < 10 ? product : product - 9)
  }, 0)

  return (10 - (checksumSum % 10)) % 10 === Number(digits[10])
}