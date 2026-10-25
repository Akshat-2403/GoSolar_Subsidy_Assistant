export type LoanTenureYears = 3 | 5 | 7
export type PurchaseMode = 'cash' | 'loan'

export interface SolarFinancialInputs {
  monthlyUnits: number
  sanctionedLoadKw: number
  roofAreaSqft: number
  proposedCapacityKw: number
  tariffInrPerKwh: number
}

export interface SolarFinancialEstimate {
  systemCapacityKw: number
  grossSystemCostInr: number
  subsidyInr: number
  netPayableInr: number
  annualGenerationKwh: number
  annualBillSavingsInr: number
  monthlyBillSavingsInr: number
  annualCo2OffsetKg: number
  cashPaybackYears: number
  twentyFiveYearNetSavingsInr: number
  loanPrincipalInr: number
  monthlyEmiInr: number
  loanNetMonthlyCashflowInr: number
  loanPaybackYears: number
}

const SYSTEM_COST_SLABS = [
  { upToKw: 1, rateInrPerKw: 75_000 },
  { upToKw: 2, rateInrPerKw: 70_000 },
  { upToKw: 3, rateInrPerKw: 65_000 },
  { upToKw: Number.POSITIVE_INFINITY, rateInrPerKw: 60_000 },
]

export function estimateSystemCost(capacityKw: number): number {
  let remaining = Math.max(0, capacityKw)
  let lowerBound = 0
  let total = 0
  for (const slab of SYSTEM_COST_SLABS) {
    const slabCapacity = Math.min(remaining, slab.upToKw - lowerBound)
    if (slabCapacity > 0) total += slabCapacity * slab.rateInrPerKw
    remaining -= slabCapacity
    lowerBound = slab.upToKw
    if (remaining <= 0) break
  }
  return Math.round(total)
}

export function calculateSubsidy(capacityKw: number): number {
  const capacity = Math.max(0, capacityKw)
  const firstTwoKw = Math.min(2, capacity) * 30_000
  const thirdKw = Math.max(0, Math.min(1, capacity - 2)) * 18_000
  return Math.round(Math.min(78_000, firstTwoKw + thirdKw))
}

export function calculateMonthlyEmi(principalInr: number, annualInterestRatePct = 7, tenureYears: LoanTenureYears = 5): number {
  const principal = Math.max(0, principalInr)
  const months = tenureYears * 12
  const monthlyRate = Math.max(0, annualInterestRatePct) / 1200
  if (principal === 0) return 0
  if (monthlyRate === 0) return Math.round(principal / months)
  const factor = (1 + monthlyRate) ** months
  return Math.round(principal * monthlyRate * factor / (factor - 1))
}

export function calculateSolarFinancials(inputs: SolarFinancialInputs, annualInterestRatePct = 7, tenureYears: LoanTenureYears = 5): SolarFinancialEstimate {
  const monthlyUnits = Math.max(0, inputs.monthlyUnits)
  const sanctionedLoad = Math.max(0, inputs.sanctionedLoadKw)

  const roofCapacity = Math.max(0, Math.floor(inputs.roofAreaSqft / 100))
  const consumptionCapacity = Math.max(0, Math.ceil(monthlyUnits / 120))
  const recommendedCapacity = Math.min(roofCapacity, consumptionCapacity)
  const requestedCapacity = inputs.proposedCapacityKw > 0 ? inputs.proposedCapacityKw : recommendedCapacity
  const systemCapacityKw = Math.max(0, Math.min(sanctionedLoad, recommendedCapacity, requestedCapacity))

  const grossSystemCostInr = estimateSystemCost(systemCapacityKw)
  const subsidyInr = calculateSubsidy(systemCapacityKw)
  const netPayableInr = Math.max(0, grossSystemCostInr - subsidyInr)
  const annualGenerationKwh = Math.round(systemCapacityKw * 1_400)
  const annualBillSavingsInr = Math.round(systemCapacityKw * 1_400 * Math.max(0, inputs.tariffInrPerKwh))
  const monthlyBillSavingsInr = Math.round(annualBillSavingsInr / 12)
  const annualCo2OffsetKg = Math.round(systemCapacityKw * 1_050)
  const degradationFactor25Years = (1 - 0.995 ** 25) / (1 - 0.995)
  const twentyFiveYearNetSavingsInr = Math.round(annualBillSavingsInr * degradationFactor25Years - netPayableInr)
  const cashPaybackYears = annualBillSavingsInr > 0 ? Math.round(netPayableInr / annualBillSavingsInr * 10) / 10 : 0
  const monthlyEmiInr = calculateMonthlyEmi(netPayableInr, annualInterestRatePct, tenureYears)
  const loanNetMonthlyCashflowInr = monthlyBillSavingsInr - monthlyEmiInr

  return {
    systemCapacityKw, grossSystemCostInr, subsidyInr, netPayableInr,
    annualGenerationKwh, annualBillSavingsInr, monthlyBillSavingsInr, annualCo2OffsetKg,
    cashPaybackYears,
    twentyFiveYearNetSavingsInr,
    loanPrincipalInr: netPayableInr,
    monthlyEmiInr,
    loanNetMonthlyCashflowInr,
    loanPaybackYears: cashPaybackYears,
  }
}

export function applySolarPriceOverrides(estimate: SolarFinancialEstimate | null, pricePerKw: number, selectedSubsidyInr: number, annualInterestRatePct: number, tenureYears: LoanTenureYears): SolarFinancialEstimate | null {
  if (!estimate) return null
  const grossSystemCostInr = Math.round(estimate.systemCapacityKw * Math.max(0, pricePerKw))
  const subsidyInr = Math.max(0, selectedSubsidyInr)
  const netPayableInr = Math.max(0, grossSystemCostInr - subsidyInr)
  const monthlyEmiInr = calculateMonthlyEmi(netPayableInr, annualInterestRatePct, tenureYears)
  const cashPaybackYears = estimate.annualBillSavingsInr > 0 ? Math.round(netPayableInr / estimate.annualBillSavingsInr * 10) / 10 : 0
  const degradationFactor25Years = (1 - 0.995 ** 25) / (1 - 0.995)
  return {
    ...estimate, grossSystemCostInr, subsidyInr, netPayableInr,
    loanPrincipalInr: netPayableInr, monthlyEmiInr,
    loanNetMonthlyCashflowInr: estimate.monthlyBillSavingsInr - monthlyEmiInr,
    cashPaybackYears, loanPaybackYears: cashPaybackYears,
    twentyFiveYearNetSavingsInr: Math.round(estimate.annualBillSavingsInr * degradationFactor25Years - netPayableInr),
  }
}
