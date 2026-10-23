export const consumerNumberPattern = /^[A-Za-z0-9]{8,15}$/
export const indianPincodePattern = /^[1-9][0-9]{5}$/
export const indianMobilePattern = /^[6-9]\d{9}$/

export function validateConsumerNumber(value: string): string | null {
  const normalized = value.trim()
  if (!normalized) return 'Enter your consumer / CA number.'
  if (!consumerNumberPattern.test(normalized)) return 'Use 8–15 letters or digits, with no spaces or symbols.'
  return null
}

export function validateSanctionedLoad(value: number | string): string | null {
  const load = Number(value)
  if (!Number.isFinite(load) || load < 0.5 || load > 50) return 'Enter a load from 0.5 to 50.0 kW.'
  return null
}

export function validatePositiveNumber(value: number | string, label: string): string | null {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return `${label} must be greater than 0.`
  return null
}

export function validatePincode(value: string): string | null {
  if (!indianPincodePattern.test(value.trim())) return 'Enter a valid 6-digit Indian PIN code.'
  return null
}

export function validateMobile(value: string): string | null {
  if (!indianMobilePattern.test(value.trim())) return 'Enter a valid 10-digit Indian mobile number.'
  return null
}
