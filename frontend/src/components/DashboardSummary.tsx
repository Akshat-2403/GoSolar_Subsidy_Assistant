import type { LoanTenureYears, PurchaseMode } from '../utils/calculations'
import { applySolarPriceOverrides, calculateSolarFinancials } from '../utils/calculations'
import FinancialPlan from './FinancialPlan'
import './components.css'

type Props = {
  monthlyUnits: number | ''
  tariffInrPerKwh: number | ''
  sanctionedLoadKw: number | ''
  roofAreaSqft: number | ''
  proposedCapacityKw: number | ''
  vendorPricePerKw: number
  subsidyInr: number
  mode: PurchaseMode
  tenureYears: LoanTenureYears
  interestRatePct: number
  onModeChange: (mode: PurchaseMode) => void
  onTenureChange: (tenure: LoanTenureYears) => void
  onInterestRateChange: (rate: number) => void
}

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export default function DashboardSummary({ monthlyUnits, tariffInrPerKwh, sanctionedLoadKw, roofAreaSqft, proposedCapacityKw, vendorPricePerKw, subsidyInr, mode, tenureYears, interestRatePct, onModeChange, onTenureChange, onInterestRateChange }: Props) {
  const ready = Number(monthlyUnits) > 0 && Number(sanctionedLoadKw) > 0 && Number(tariffInrPerKwh) > 0
  const baseEstimate = ready ? calculateSolarFinancials({
    monthlyUnits: Number(monthlyUnits), sanctionedLoadKw: Number(sanctionedLoadKw),
    roofAreaSqft: Number(roofAreaSqft), proposedCapacityKw: Number(proposedCapacityKw),
    tariffInrPerKwh: Number(tariffInrPerKwh),
  }, interestRatePct, tenureYears) : null
  const estimate = applySolarPriceOverrides(baseEstimate, vendorPricePerKw, subsidyInr, interestRatePct, tenureYears)
  const metrics = [
    { label: 'Recommended system size', value: estimate ? `${estimate.systemCapacityKw.toFixed(1)} kW` : '-- kW' },
    { label: 'Estimated subsidy', value: estimate ? money(estimate.subsidyInr) : '₹ --' },
    { label: 'Estimated annual bill savings', value: estimate ? money(estimate.annualBillSavingsInr) : '₹ --' },
    { label: 'Estimated CO₂ offset', value: estimate ? `${estimate.annualCo2OffsetKg.toLocaleString('en-IN')} kg/yr` : '-- kg/yr' },
  ]

  return <aside className="dashboard-summary" aria-label="Live rooftop solar estimates" aria-live="polite">
    <div className="dashboard-summary-heading"><p className="guide-eyebrow">LIVE ESTIMATE</p><h2>Your solar snapshot</h2><p>{estimate ? 'Updates as you enter your details.' : 'Enter your monthly consumption, sanctioned load, and tariff to see live estimates.'}</p></div>
    <dl className="dashboard-summary-metrics">
      {metrics.map((metric) => <div className="dashboard-summary-metric" key={metric.label}>
        <dt>{metric.label}</dt><dd>{metric.value}</dd>
      </div>)}
    </dl>
    <FinancialPlan estimate={estimate} mode={mode} tenureYears={tenureYears} interestRatePct={interestRatePct} onModeChange={onModeChange} onTenureChange={onTenureChange} onInterestRateChange={onInterestRateChange} compact />
  </aside>
}
