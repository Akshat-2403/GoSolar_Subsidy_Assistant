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
  if (value === '' || !Number.isFinite(number) || number <= 0) return `${label} is required and must be greater than 0.`
  return null
}

export function validateRoofCapacity(capacity: number | string, roofArea: number | string): string | null {
  const proposedKw = Number(capacity)
  const areaSqft = Number(roofArea)
  if (capacity === '' || !Number.isFinite(proposedKw) || proposedKw <= 0) return 'Proposed capacity is required.'
  if (roofArea === '' || !Number.isFinite(areaSqft) || areaSqft <= 0) return 'Usable roof area is required.'
  if (proposedKw * 100 > areaSqft) return `⚠️ Insufficient roof area. Your roof can only support up to ${(areaSqft / 100).toFixed(2)} kW.`
  return null
}

export function validateCapacityAgainstLoad(capacity: number | string, sanctionedLoad: number | string): string | null {
  const proposedKw = Number(capacity)
  const loadKw = Number(sanctionedLoad)
  if (capacity === '' || !Number.isFinite(proposedKw) || proposedKw <= 0) return 'Proposed capacity is required.'
  if (sanctionedLoad === '' || !Number.isFinite(loadKw) || loadKw <= 0) return 'Sanctioned load is required.'
  if (proposedKw > loadKw) return '⚠️ Proposed capacity cannot exceed your sanctioned grid load. Please reduce capacity or apply for load enhancement first.'
  return null
}

export function validateUsageFeasibility(monthlyUsage: number | string, capacity: number | string): string | null {
  if (monthlyUsage === '' || capacity === '') return null
  const usage = Number(monthlyUsage)
  const proposedKw = Number(capacity)
  if (!Number.isFinite(usage) || !Number.isFinite(proposedKw)) return null
  if (usage < 50 && proposedKw >= 5) return '⚠️ Anomaly detected: Your requested system size is vastly oversized for your monthly consumption. Proceed with caution.'
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
