import type { LoanTenureYears, PurchaseMode, SolarFinancialEstimate } from '../utils/calculations'
import './components.css'

type Props = {
  estimate: SolarFinancialEstimate | null
  mode: PurchaseMode
  tenureYears: LoanTenureYears
  interestRatePct: number
  onModeChange: (mode: PurchaseMode) => void
  onTenureChange: (tenure: LoanTenureYears) => void
  onInterestRateChange: (rate: number) => void
  compact?: boolean
}

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}

export default function FinancialPlan({ estimate, mode, tenureYears, interestRatePct, onModeChange, onTenureChange, onInterestRateChange, compact = false }: Props) {
  return <section className={`financial-plan ${compact ? 'financial-plan-compact' : ''}`} aria-label="Solar purchase and loan estimates">
    <div className="financial-plan-heading"><div><p className="guide-eyebrow">FINANCING OPTIONS</p><h3>How would you like to pay?</h3></div></div>
    <div className="purchase-toggle" role="group" aria-label="Purchase method">
      <button type="button" aria-pressed={mode === 'cash'} className={mode === 'cash' ? 'selected' : ''} onClick={() => onModeChange('cash')}>Cash Purchase</button>
      <button type="button" aria-pressed={mode === 'loan'} className={mode === 'loan' ? 'selected' : ''} onClick={() => onModeChange('loan')}>Green Loan / EMI</button>
    </div>
    {mode === 'loan' && <div className="loan-controls">
      <label className="loan-slider-label">Loan tenure <strong>{tenureYears} years</strong>
        <input type="range" min="3" max="7" step="2" value={tenureYears} onChange={(event) => onTenureChange(Number(event.target.value) as LoanTenureYears)} aria-label="Loan tenure in years" />
        <span className="loan-range-values"><span>3 years</span><span>5 years</span><span>7 years</span></span>
      </label>
      <label className="interest-rate-label">Interest rate (p.a.)
        <span><input type="number" min="0" max="30" step="0.1" value={interestRatePct} onChange={(event) => onInterestRateChange(Math.max(0, Number(event.target.value)))} aria-label="Annual loan interest rate" />%</span>
      </label>
    </div>}
    {!estimate ? <p className="financial-prompt">Enter project details to compare cash purchase and loan options.</p> : <>
      <dl className="financial-values">
        <div><dt>Estimated system cost</dt><dd>{money(estimate.grossSystemCostInr)}</dd></div>
        <div><dt>PM Surya Ghar subsidy</dt><dd>−{money(estimate.subsidyInr)}</dd></div>
        <div className="financial-total"><dt>Net payable</dt><dd>{money(estimate.netPayableInr)}</dd></div>
        {mode === 'loan' ? <>
          <div><dt>Monthly electricity savings</dt><dd>{money(estimate.monthlyBillSavingsInr)}</dd></div>
          <div><dt>Estimated monthly EMI</dt><dd>{money(estimate.monthlyEmiInr)}</dd></div>
          <div className={`cashflow-indicator ${estimate.loanNetMonthlyCashflowInr >= 0 ? 'cashflow-positive' : 'cashflow-negative'}`}>
            <dt>Net monthly cashflow</dt><dd>{estimate.loanNetMonthlyCashflowInr >= 0 ? '+' : '−'}{money(Math.abs(estimate.loanNetMonthlyCashflowInr))}</dd>
            <small>{estimate.loanNetMonthlyCashflowInr >= 0 ? 'Estimated electricity savings cover the installment.' : 'The installment is higher than estimated bill savings.'}</small>
          </div>
          <div><dt>Simple payback period</dt><dd>{estimate.loanPaybackYears.toFixed(1)} years</dd></div>
        </> : <>
          <div><dt>Estimated annual bill savings</dt><dd>{money(estimate.annualBillSavingsInr)}</dd></div>
          <div><dt>Simple payback period</dt><dd>{estimate.cashPaybackYears.toFixed(1)} years</dd></div>
          <div className="cashflow-indicator cashflow-positive"><dt>Monthly installment</dt><dd>₹0</dd><small>Cash purchase has no loan installment.</small></div>
        </>}
      </dl>
      <p className="financial-assumptions">Planning estimate only. Uses tiered system-cost assumptions, your entered bill tariff, and indicative solar generation.</p>
    </>}
  </section>
}
