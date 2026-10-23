import './components.css'

type Props = {
  monthlyUnits: number | ''
  tariffInrPerKwh: number | ''
  sanctionedLoadKw: number | ''
  roofAreaSqft?: number | ''
}

function formatInr(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export default function DashboardSummary({ monthlyUnits, tariffInrPerKwh, sanctionedLoadKw, roofAreaSqft }: Props) {
  const units = Number(monthlyUnits) > 0 ? Number(monthlyUnits) : 0
  const tariff = Number(tariffInrPerKwh) > 0 ? Number(tariffInrPerKwh) : 0
  const load = Number(sanctionedLoadKw) > 0 ? Number(sanctionedLoadKw) : 0
  const roof = Number(roofAreaSqft) > 0 ? Number(roofAreaSqft) : 0
  const hasSizingInputs = units > 0 && load > 0
  // Approximate one kW of rooftop solar for every 120 monthly units, limited by sanctioned load.
  const systemSizeKw = hasSizingInputs ? Math.min(load, units / 120, roof ? roof / 80 : Number.POSITIVE_INFINITY) : 0
  const subsidyInr = Math.min(78000, Math.min(systemSizeKw, 2) * 30000 + Math.max(0, Math.min(systemSizeKw - 2, 1)) * 18000)
  // Assumes solar offsets roughly 75% of annual consumption; local generation and tariffs vary.
  const annualSavingsInr = units * 12 * tariff * 0.75
  // Approximate grid emissions factor: 0.716 kg CO₂ per kWh of solar generation.
  const annualCo2OffsetKg = systemSizeKw * 1400 * 0.716

  const metrics = [
    { label: 'Recommended system size', value: hasSizingInputs ? `${systemSizeKw.toFixed(1)} kW` : '-- kW', note: 'Indicative sizing from usage and load' },
    { label: 'Estimated subsidy', value: hasSizingInputs ? formatInr(subsidyInr) : '₹ --', note: 'Subject to scheme eligibility' },
    { label: 'Estimated annual bill savings', value: hasSizingInputs && tariff > 0 ? formatInr(annualSavingsInr) : '₹ --', note: 'Indicative; depends on tariff and usage' },
    { label: 'Estimated CO₂ offset', value: hasSizingInputs ? `${Math.round(annualCo2OffsetKg).toLocaleString('en-IN')} kg/yr` : '-- kg/yr', note: 'Approximate avoided grid emissions' },
  ]

  return <aside className="dashboard-summary" aria-label="Live rooftop solar estimates" aria-live="polite">
    <div className="dashboard-summary-heading"><p className="guide-eyebrow">LIVE ESTIMATE</p><h2>Your solar snapshot</h2><p>{hasSizingInputs ? 'Updates as you enter your details.' : 'Enter your monthly consumption and sanctioned load to see live estimates.'}</p></div>
    <dl className="dashboard-summary-metrics">
      {metrics.map((metric) => <div className="dashboard-summary-metric" key={metric.label}>
        <dt>{metric.label}</dt><dd>{metric.value}</dd><small>{metric.note}</small>
      </div>)}
    </dl>
  </aside>
}
