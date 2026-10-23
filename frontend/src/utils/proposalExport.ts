import type { LoanTenureYears, PurchaseMode, SolarFinancialEstimate } from './calculations'

export interface ProposalDetails {
  applicantName: string
  consumerNumber: string
  state: string
  discom: string
  roofAreaSqft: number
  estimate: SolarFinancialEstimate
  purchaseMode: PurchaseMode
  loanTenureYears: LoanTenureYears
  interestRatePct: number
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}

function money(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`
}

export function openFeasibilityProposal(details: ProposalDetails): boolean {
  const reportWindow = window.open('', '_blank')
  if (!reportWindow) return false
  const estimate = details.estimate
  const financeRows = details.purchaseMode === 'loan'
    ? `<tr><th>Loan tenure and interest</th><td>${details.loanTenureYears} years at ${details.interestRatePct}% p.a.</td></tr><tr><th>Estimated monthly EMI</th><td>${money(estimate.monthlyEmiInr)}</td></tr><tr><th>Net monthly cashflow after EMI</th><td>${money(estimate.loanNetMonthlyCashflowInr)}</td></tr>`
    : '<tr><th>Payment method</th><td>Cash purchase</td></tr>'
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>GoSolar Assessment Summary</title><style>
    :root{font-family:Arial,sans-serif;color:#26372c;background:#f1f5f0}body{margin:0;padding:32px}.report{max-width:850px;margin:0 auto;padding:44px;background:white;border:1px solid #dfe8de;border-radius:14px}.brand{color:#24844d;font-weight:800;letter-spacing:.08em;font-size:12px}.hero{padding-bottom:22px;border-bottom:2px solid #e5eee4}.hero h1{margin:10px 0 8px;font-size:30px}.hero p{margin:0;color:#6d7c70;line-height:1.5}.meta{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:25px 0}.meta div{padding:12px;background:#f7faf6;border-radius:7px}.meta small{display:block;color:#738176;font-size:11px;margin-bottom:5px}.meta strong{font-size:14px;overflow-wrap:anywhere}.report h2{font-size:16px;margin:25px 0 10px}.report table{width:100%;border-collapse:collapse}.report th,.report td{text-align:left;padding:11px 10px;border-bottom:1px solid #e8eee7;font-size:13px}.report td{text-align:right;font-weight:700}.report .total{background:#eff8f0;color:#247747}.fine{margin-top:26px;padding-top:14px;border-top:1px solid #e5ebe4;color:#7b887e;font-size:10px;line-height:1.6}.actions{display:flex;justify-content:flex-end;margin-top:22px}.actions button{border:0;border-radius:7px;background:#237b49;color:white;padding:11px 18px;font-weight:700;cursor:pointer}@media print{body{background:#fff;padding:0}.report{max-width:none;border:0;border-radius:0;padding:24px}.actions{display:none}}@media(max-width:600px){body{padding:10px}.report{padding:22px}.meta{grid-template-columns:1fr}.hero h1{font-size:25px}}
    </style></head><body><main class="report"><header class="hero"><div class="brand">GoSolar · ROOFTOP SOLAR</div><h1>GoSolar Assessment Summary</h1><p>Indicative feasibility and financing estimate · Prepared ${new Date().toLocaleDateString('en-IN')}</p></header>
      <section class="meta"><div><small>Applicant</small><strong>${escapeHtml(details.applicantName || 'Not provided')}</strong></div><div><small>Consumer number</small><strong>${escapeHtml(details.consumerNumber || 'Not provided')}</strong></div><div><small>State</small><strong>${escapeHtml(details.state || 'Not provided')}</strong></div><div><small>DISCOM</small><strong>${escapeHtml(details.discom || 'Not provided')}</strong></div><div><small>Recommended system capacity</small><strong>${estimate.systemCapacityKw.toFixed(1)} kW</strong></div><div><small>Roof area utilized (approx.)</small><strong>${Math.min(details.roofAreaSqft, estimate.systemCapacityKw * 80).toLocaleString('en-IN')} sq. ft.</strong></div></section>
      <h2>Financial breakdown</h2><table><tbody><tr><th>Estimated gross system cost</th><td>${money(estimate.grossSystemCostInr)}</td></tr><tr><th>PM Surya Ghar subsidy estimate</th><td>−${money(estimate.subsidyInr)}</td></tr><tr class="total"><th>Net payable after subsidy</th><td>${money(estimate.netPayableInr)}</td></tr><tr><th>Estimated annual bill savings</th><td>${money(estimate.annualBillSavingsInr)}</td></tr><tr><th>25-year cumulative net savings</th><td>${money(estimate.twentyFiveYearNetSavingsInr)}</td></tr>${financeRows}</tbody></table>
      <h2>Environmental impact</h2><table><tbody><tr><th>Estimated annual CO₂ offset</th><td>${estimate.annualCo2OffsetKg.toLocaleString('en-IN')} kg / year</td></tr><tr><th>Simple payback estimate</th><td>${estimate.cashPaybackYears.toFixed(1)} years</td></tr></tbody></table>
      <p class="fine">This report is an estimate for planning only. System cost, subsidy eligibility, export credits, generation, tariff slabs, loan approval and actual savings depend on site conditions, the current scheme rules, your DISCOM, lender terms and installer quotes. Savings use your entered effective bill tariff and indicative generation; this is not a government approval or financial offer.</p><div class="actions"><button onclick="window.print()">Print / Save as PDF</button></div></main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250))</script></body></html>`
  reportWindow.document.open()
  reportWindow.document.write(html)
  reportWindow.document.close()
  return true
}
