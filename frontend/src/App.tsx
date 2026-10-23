import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import DashboardSummary from './components/DashboardSummary'
import ProgressBar, { type WizardStep } from './components/ProgressBar'
import SubsidyGuideModal from './components/SubsidyGuideModal'
import discoms from './data/discoms.json'
import { validateConsumerNumber, validateMobile, validatePincode, validatePositiveNumber, validateSanctionedLoad } from './utils/validation'
import './App.css'

const API_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || '/api/mock-discom/portal'

type EventItem = { node: string; status: string; message: string; timestamp: string }
type Evidence = { evidence_id: string; rule_applied: string; source_title: string; verbatim_snippet: string; rule: string; outcome: string; excerpt: string; checked_at: string; source_url: string | null }
type Workflow = {
  workflow_id: string; state: string; can_proceed: boolean; human_approval_required: boolean
  issues: string[]; missing_documents: string[]; application_parameters: Record<string, unknown>
  evidence_log: Evidence[]; events: EventItem[]; financial_summary: null | {
    estimated_subsidy_inr: number; estimated_annual_generation_kwh: number; estimated_annual_savings_inr: number; estimated_payback_years: number
  }; application_id: string | null; policy_assessment: string | null
}
type Intake = {
  applicant_name: string; state: string; applicant_type: 'owner' | 'tenant'; consumer_number: string
  discom_code: string; sanctioned_load_kw: number | ''; proposed_capacity_kw: number | ''; owns_rooftop: boolean
  has_grid_connection: boolean; installer_id: string; installer_empanelled: boolean; landlord_noc_uploaded: boolean
  required_documents: string; uploaded_documents: string; tariff_inr_per_kwh: number | ''
  monthly_units: number | ''; roof_area_sqft: number | ''; pincode: string; mobile: string
}
const defaults: Intake = {
  applicant_name: '', state: '', applicant_type: 'owner', consumer_number: '', discom_code: '',
  sanctioned_load_kw: '', proposed_capacity_kw: '', owns_rooftop: true, has_grid_connection: true,
  installer_id: '', installer_empanelled: true, landlord_noc_uploaded: false,
  required_documents: 'Electricity bill, Aadhaar', uploaded_documents: '', tariff_inr_per_kwh: '',
  monthly_units: '', roof_area_sqft: '', pincode: '', mobile: '',
}
const demo: Intake = {
  ...defaults, applicant_name: 'Asha Sharma', state: 'Maharashtra', applicant_type: 'owner',
  consumer_number: 'MH12345678', discom_code: 'MSEDCL (Mahavitaran)', sanctioned_load_kw: 3.5,
  proposed_capacity_kw: 3, installer_id: 'DEMO-VENDOR-001', pincode: '411001', mobile: '9876543210',
  monthly_units: 400, roof_area_sqft: 350, tariff_inr_per_kwh: 8, uploaded_documents: 'Electricity bill, Aadhaar',
}
const workflowNodes = [
  ['validate_input', 'Validate intake schema', 'Required fields and numeric bounds'],
  ['policy_checks', 'Evaluate policy guardrails', 'Ownership, grid, vendor, capacity and documents'],
  ['policy_evidence', 'Retrieve policy evidence', 'Scheme and DISCOM guidance with cited excerpts'],
  ['financial_calculation', 'Calculate estimate', 'Subsidy slab, generation and payback'],
  ['human_review', 'Human approval gate', 'Review the payload before mock filing'],
  ['portal_submission', 'Submit to mock portal', 'Capture simulated application ID'],
]

function App() {
  const [form, setForm] = useState<Intake>(defaults)
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState(false)
  const [guide, setGuide] = useState(false)
  const [activeStep, setActiveStep] = useState<WizardStep>(1)
  const [offlinePreview, setOfflinePreview] = useState(false)
  const [offlineAvailable, setOfflineAvailable] = useState(false)
  const activeWorkflowId = workflow?.workflow_id
  const stateNames = Object.keys(discoms).sort()
  const discomOptions = form.state ? discoms[form.state as keyof typeof discoms] ?? [] : []

  useEffect(() => {
    if (!activeWorkflowId || offlinePreview) return
    const stream = new EventSource(`${API_URL}/api/workflows/${activeWorkflowId}/events`)
    stream.onmessage = (message) => {
      try {
        const item = JSON.parse(message.data) as EventItem
        setEvents((current) => current.some((event) => event.node === item.node && event.timestamp === item.timestamp) ? current : [...current, item])
      } catch { setError('Received an unreadable workflow event.') }
    }
    stream.addEventListener('complete', () => stream.close())
    stream.onerror = () => stream.close()
    return () => stream.close()
  }, [activeWorkflowId, offlinePreview])

  function update<K extends keyof Intake>(key: K, value: Intake[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (key === 'state') setForm((current) => ({ ...current, state: value as string, discom_code: '' }))
  }
  const validation = {
    name: form.applicant_name.trim().length >= 2 ? null : 'Enter the applicant name (at least 2 characters).',
    consumer: validateConsumerNumber(form.consumer_number),
    load: validateSanctionedLoad(form.sanctioned_load_kw),
    pin: validatePincode(form.pincode),
    mobile: validateMobile(form.mobile),
    monthly: validatePositiveNumber(form.monthly_units, 'Monthly units'),
    roof: validatePositiveNumber(form.roof_area_sqft, 'Roof area'),
    capacity: Number(form.proposed_capacity_kw) > Number(form.sanctioned_load_kw) ? 'Planned capacity cannot exceed the sanctioned load.' : validatePositiveNumber(form.proposed_capacity_kw, 'Planned capacity'),
    tariff: validatePositiveNumber(form.tariff_inr_per_kwh, 'Tariff'),
  }
  const stepOneValid = !validation.name && !validation.consumer && !validation.load && !validation.pin && !validation.mobile && !!form.state && !!form.discom_code
  const stepTwoValid = !validation.monthly && !validation.roof && !validation.capacity && !validation.tariff && !!form.installer_id.trim()
  const estimatedSize = Math.max(0, Math.min(Number(form.sanctioned_load_kw) || 0, (Number(form.monthly_units) || 0) / 120, (Number(form.roof_area_sqft) || 0) / 80))

  async function evaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stepOneValid || !stepTwoValid) { setError('Complete all required fields in Steps 1 and 2 before evaluating.'); return }
    setError(''); setBusy(true)
    if (offlinePreview) {
      const sizeKw = estimatedSize
      const subsidyInr = Math.round(Math.min(78000, Math.min(sizeKw, 2) * 30000 + Math.max(0, Math.min(sizeKw - 2, 1)) * 18000))
      const now = new Date().toISOString()
      const mockEvents: EventItem[] = [
        { node: 'validate_input', status: 'completed', message: 'Intake fields passed local preview checks.', timestamp: now },
        { node: 'policy_checks', status: 'completed', message: 'Preview only; policy services were not contacted.', timestamp: now },
        { node: 'financial_calculation', status: 'completed', message: 'Indicative estimate calculated locally.', timestamp: now },
        { node: 'human_review', status: 'waiting', message: 'Review the preview before simulated submission.', timestamp: now },
      ]
      setWorkflow({
        workflow_id: `LOCAL-${Date.now()}`, state: 'human_review_required', can_proceed: true,
        human_approval_required: true, issues: [], missing_documents: [], application_parameters: { ...form },
        evidence_log: [], events: mockEvents,
        financial_summary: {
          estimated_subsidy_inr: subsidyInr,
          estimated_annual_generation_kwh: Math.round(sizeKw * 1400),
          estimated_annual_savings_inr: Math.round(Number(form.monthly_units) * 12 * Number(form.tariff_inr_per_kwh) * 0.75),
          estimated_payback_years: 0,
        },
        application_id: null, policy_assessment: 'Offline preview estimate only. No backend, policy source, or portal was contacted.',
      })
      setEvents(mockEvents); setBusy(false); setOfflineAvailable(false)
      return
    }
    const payload = {
      applicant_name: form.applicant_name.trim(), state: form.state, applicant_type: form.applicant_type,
      consumer_number: form.consumer_number.trim().toUpperCase(), discom_code: form.discom_code,
      sanctioned_load_kw: Number(form.sanctioned_load_kw), proposed_capacity_kw: Number(form.proposed_capacity_kw),
      owns_rooftop: form.owns_rooftop, has_grid_connection: form.has_grid_connection,
      installer_id: form.installer_id.trim(), installer_empanelled: form.installer_empanelled,
      landlord_noc_uploaded: form.landlord_noc_uploaded,
      required_documents: form.required_documents.split(',').map((item) => item.trim()).filter(Boolean),
      uploaded_documents: form.uploaded_documents.split(',').map((item) => item.trim()).filter(Boolean),
      tariff_inr_per_kwh: Number(form.tariff_inr_per_kwh),
      monthly_avg_consumption_kwh: Number(form.monthly_units), rooftop_area_sqft: Number(form.roof_area_sqft),
    }
    try {
      const response = await fetch(`${API_URL}/api/workflows/evaluate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `Evaluation failed (${response.status})`)
      setWorkflow(data as Workflow); setEvents(data.events as EventItem[])
    } catch (reason) {
      if (reason instanceof TypeError) {
        setOfflineAvailable(true)
        setError('Backend agent service is offline or unreachable. Make sure the backend is running on port 8000, or switch to offline preview mode.')
      } else {
        setError(reason instanceof Error ? reason.message : 'The backend could not complete the assessment.')
      }
    }
    finally { setBusy(false) }
  }
  async function approve() {
    if (!workflow) return
    if (offlinePreview) {
      const submitted = { ...workflow, state: 'submitted', human_approval_required: false, application_id: `LOCAL-DEMO-${Date.now().toString().slice(-6)}` }
      setWorkflow(submitted); setReview(false)
      return
    }
    setBusy(true); setError('')
    try {
      const response = await fetch(`${API_URL}/api/workflows/${workflow.workflow_id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ human_approved: true }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || `Submission failed (${response.status})`)
      setWorkflow(data as Workflow); setEvents(data.events as EventItem[]); setReview(false)
    } catch (reason) {
      if (reason instanceof TypeError) {
        setOfflineAvailable(true)
        setError('Backend agent service is offline or unreachable. Make sure the backend is running on port 8000, or switch to offline preview mode.')
      } else setError(reason instanceof Error ? reason.message : 'Could not submit to the mock portal.')
    }
    finally { setBusy(false) }
  }
  function useDemo() {
    setForm(demo); setWorkflow(null); setEvents([]); setError('')
    setActiveStep(1); setOfflineAvailable(false)
  }
  function startNew() {
    setForm(defaults); setWorkflow(null); setEvents([]); setError(''); setReview(false); setActiveStep(1)
  }
  function continueFromStepOne() { if (stepOneValid) { setError(''); setActiveStep(2) } else setError('Please resolve the highlighted Step 1 fields before continuing.') }
  function continueFromStepTwo() { if (stepTwoValid) { setError(''); setActiveStep(3) } else setError('Please complete the required site and consumption fields.') }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">☼</div><div><strong>GoSolar<span>.</span></strong><small>SUBSIDY ASSISTANT</small></div></div>
      <div className="workspace-label">YOUR APPLICATION</div>
      <nav className="nav-list"><button className="nav-item selected"><span className="nav-icon">▦</span>Solar assessment</button><button className="nav-item" onClick={startNew}><span className="nav-icon">↻</span>Start over</button></nav>
      <div className="sidebar-bottom"><div className="system-card"><span className="status-dot" /><div><strong>Demo services</strong><small>Agent API · mock portal</small></div></div><div className="profile"><div className="avatar">GS</div><div><strong>GoSolar workspace</strong><small>Human approval enabled</small></div></div></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="breadcrumbs"><strong>GoSolar</strong><span>/</span>New solar assessment</div><div className="topbar-right"><div className="env-pill"><span className="status-dot" />{offlinePreview ? 'OFFLINE PREVIEW' : 'AGENT API'}</div><button className="button button-quiet" type="button" onClick={useDemo}>⚡ Try Demo</button><a className="button button-quiet" href={PORTAL_URL} target="_blank" rel="noreferrer">Open mock portal ↗</a></div></header>
      <main className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />ROOFTOP SOLAR · PERSONALIZED ESTIMATE</div><h1>Plan your <span>solar journey</span></h1><p>Share a few details to explore your rooftop potential and available subsidy estimate.</p></div><button className="button button-outline" type="button" onClick={() => setGuide(true)}>Learn about subsidies</button></div>
        <ProgressBar activeStep={activeStep} />
        {error && <div className="notice notice-warning" role="alert"><span className="notice-symbol">!</span><span>{error}</span>{offlineAvailable && <button type="button" className="button button-quiet offline-action" onClick={() => { setOfflinePreview(true); setOfflineAvailable(false); setError('') }}>Continue in offline preview</button>}<button type="button" aria-label="Dismiss message" onClick={() => setError('')}>×</button></div>}
        {offlinePreview && <div className="offline-note" role="status">Offline preview is active. Estimates are local approximations; no policy checks or portal submissions will be made.</div>}
        {workflow?.issues.map((issue) => <div className="notice notice-warning" key={issue}><span className="notice-symbol">!</span>{issue}</div>)}
        {workflow?.state === 'submitted' && <div className="notice notice-success"><span className="notice-symbol">✓</span>{offlinePreview ? 'Offline preview completed. No application was sent to a portal.' : 'Mock portal accepted the filing. This is a demonstration receipt, not a government approval.'}</div>}
        <div className="wizard-layout">
          <section className="panel wizard-panel">
            {activeStep === 1 && <>
              <PanelHeading kicker="STEP 01 · CONSUMER & DISCOM" title="Your electricity connection" subtitle="Enter the details shown on your latest electricity bill." icon="01" />
              <form onSubmit={(event) => { event.preventDefault(); continueFromStepOne() }} noValidate>
                <Field label="Applicant name"><input autoComplete="name" value={form.applicant_name} onChange={(event) => update('applicant_name', event.target.value)} placeholder="e.g. Asha Sharma" aria-invalid={!!validation.name} />{form.applicant_name && validation.name && <small className="field-error">{validation.name}</small>}</Field>
                <div className="form-grid">
                  <Field label="State"><select value={form.state} onChange={(event) => update('state', event.target.value)}><option value="">Select your state / UT</option>{stateNames.map((name) => <option key={name} value={name}>{name}</option>)}</select>{!form.state && <small>Select a state to see its DISCOMs.</small>}</Field>
                  <Field label="DISCOM / electricity provider"><select value={form.discom_code} onChange={(event) => update('discom_code', event.target.value)} disabled={!form.state}><option value="">Select your DISCOM</option>{discomOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></Field>
                  <Field label="Consumer / CA number"><input autoComplete="off" value={form.consumer_number} onChange={(event) => update('consumer_number', event.target.value.replace(/\s/g, '').toUpperCase())} placeholder="8–15 letters or digits" aria-invalid={!!form.consumer_number && !!validation.consumer} />{form.consumer_number && validation.consumer && <small className="field-error">{validation.consumer}</small>}</Field>
                  <Field label="Sanctioned load (kW)"><input type="number" min="0.5" max="50" step="0.1" value={form.sanctioned_load_kw} onChange={(event) => update('sanctioned_load_kw', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.load} />{validation.load && <small className="field-error">{validation.load}</small>}</Field>
                  <Field label="Pincode"><input inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pincode} onChange={(event) => update('pincode', event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit PIN code" aria-invalid={!!form.pincode && !!validation.pin} />{form.pincode && validation.pin && <small className="field-error">{validation.pin}</small>}</Field>
                  <Field label="Mobile number"><input inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.mobile} onChange={(event) => update('mobile', event.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" aria-invalid={!!form.mobile && !!validation.mobile} />{form.mobile && validation.mobile && <small className="field-error">{validation.mobile}</small>}</Field>
                </div>
                <div className="wizard-actions"><button className="button button-quiet" type="button" onClick={useDemo}>⚡ Try Demo / Pre-fill Data</button><button className="button button-primary" type="submit" disabled={!stepOneValid}>Continue to Step 2 →</button></div>
              </form>
            </>}
            {activeStep === 2 && <>
              <PanelHeading kicker="STEP 02 · SITE & CONSUMPTION" title="Tell us about your rooftop" subtitle="These details help estimate system size and potential savings." icon="02" />
              <div className="form-grid">
                <Field label="Average monthly consumption (kWh)"><input type="number" min="1" step="1" value={form.monthly_units} onChange={(event) => update('monthly_units', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.monthly} />{validation.monthly && <small className="field-error">{validation.monthly}</small>}</Field>
                <Field label="Usable roof area (sq. ft.)"><input type="number" min="1" step="1" value={form.roof_area_sqft} onChange={(event) => update('roof_area_sqft', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.roof} />{validation.roof && <small className="field-error">{validation.roof}</small>}</Field>
                <Field label="Planned system capacity (kW)"><input type="number" min="0.1" step="0.1" value={form.proposed_capacity_kw} onChange={(event) => update('proposed_capacity_kw', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.capacity} />{validation.capacity && <small className="field-error">{validation.capacity}</small>}</Field>
                <Field label="Electricity tariff (₹ / kWh)"><input type="number" min="0.1" step="0.1" value={form.tariff_inr_per_kwh} onChange={(event) => update('tariff_inr_per_kwh', event.target.value === '' ? '' : Number(event.target.value))} aria-invalid={!!validation.tariff} />{validation.tariff && <small className="field-error">{validation.tariff}</small>}</Field>
                <Field label="Installer / vendor ID"><input value={form.installer_id} onChange={(event) => update('installer_id', event.target.value)} placeholder="Installer registry ID" />{!form.installer_id.trim() && <small className="field-error">Enter the installer registry ID.</small>}</Field>
                <Field label="Applicant type"><select value={form.applicant_type} onChange={(event) => update('applicant_type', event.target.value as Intake['applicant_type'])}><option value="owner">Owner</option><option value="tenant">Tenant</option></select></Field>
              </div>
              <div className="form-section-title">PROJECT DETAILS</div>
              <label className="check-line"><input type="checkbox" checked={form.owns_rooftop} onChange={(event) => update('owns_rooftop', event.target.checked)} /> Rooftop ownership is established</label>
              <label className="check-line"><input type="checkbox" checked={form.has_grid_connection} onChange={(event) => update('has_grid_connection', event.target.checked)} /> Active grid connection</label>
              <label className="check-line"><input type="checkbox" checked={form.installer_empanelled} onChange={(event) => update('installer_empanelled', event.target.checked)} /> Installer marked empanelled (demo declaration)</label>
              {form.applicant_type === 'tenant' && <label className="check-line"><input type="checkbox" checked={form.landlord_noc_uploaded} onChange={(event) => update('landlord_noc_uploaded', event.target.checked)} /> Landlord NOC recorded</label>}
              <Field label="Documents required (comma separated)"><input value={form.required_documents} onChange={(event) => update('required_documents', event.target.value)} placeholder="Electricity bill, Aadhaar" /></Field>
              <Field label="Documents recorded as uploaded"><input value={form.uploaded_documents} onChange={(event) => update('uploaded_documents', event.target.value)} placeholder="Electricity bill" /></Field>
              <div className="wizard-actions"><button className="button button-quiet" type="button" onClick={() => setActiveStep(1)}>← Back</button><button className="button button-primary" type="button" disabled={!stepTwoValid} onClick={continueFromStepTwo}>Continue to Step 3 →</button></div>
            </>}
            {activeStep === 3 && <>
              <PanelHeading kicker="STEP 03 · SUBSIDY & VERIFICATION" title="Review your solar estimate" subtitle="Check your details and run the policy and financial assessment." icon="03" />
              <div className="review-details"><div><small>Applicant</small><strong>{form.applicant_name}</strong></div><div><small>State · DISCOM</small><strong>{form.state} · {form.discom_code}</strong></div><div><small>Consumer number</small><strong>{form.consumer_number}</strong></div><div><small>Usage · roof area</small><strong>{form.monthly_units} kWh/mo · {form.roof_area_sqft} sq. ft.</strong></div><div><small>Recommended system size</small><strong>{estimatedSize.toFixed(1)} kW</strong></div><div><small>Proposed capacity</small><strong>{form.proposed_capacity_kw} kW</strong></div></div>
              <div className="step-three-actions"><button className="button button-quiet" type="button" onClick={() => setActiveStep(2)}>← Back</button><button className="button button-primary" type="button" disabled={busy} onClick={() => { const formEl = document.getElementById('evaluate-form') as HTMLFormElement | null; formEl?.requestSubmit() }}>{busy ? 'Evaluating…' : offlinePreview ? 'Create offline preview' : workflow ? 'Re-evaluate application' : 'Run subsidy & verification check'}</button></div>
              <form id="evaluate-form" onSubmit={evaluate} />
              {workflow && <>
                <div className="workflow-result"><div className="live-pill live-active"><span />{workflow.state.replaceAll('_', ' ').toUpperCase()}</div><p>{workflow.policy_assessment || 'Assessment complete.'}</p>
                  {workflow.financial_summary && <div className="finance-foot"><div><span>Estimated subsidy</span><strong>₹{workflow.financial_summary.estimated_subsidy_inr.toLocaleString('en-IN')}</strong></div><div><span>Annual generation</span><strong>{workflow.financial_summary.estimated_annual_generation_kwh.toLocaleString('en-IN')} kWh</strong></div><div><span>Annual savings</span><strong>₹{workflow.financial_summary.estimated_annual_savings_inr.toLocaleString('en-IN')}</strong></div><div><span>Estimated payback</span><strong>{workflow.financial_summary.estimated_payback_years} years</strong></div></div>}
                </div>
                <section className="panel embedded-panel"><PanelHeading kicker="AGENT WORKFLOW" title="Evaluation progress" subtitle="Intake checks, policy evidence and human review." icon="AI" /><div className="workflow-list">{workflowNodes.map(([node, title, subtitle], index) => {
                  const event = events.find((item) => item.node === node)
                  const done = event?.status === 'completed' || event?.status === 'submitted'
                  const blocked = event?.status === 'blocked'
                  const active = event?.status === 'waiting'
                  return <div className={'workflow-node ' + (done ? 'done ' : '') + (active ? 'active ' : '') + (blocked ? 'blocked' : '')} key={node}><div className="node-rail"><div className="node-circle">{done ? '✓' : blocked ? '!' : index + 1}</div>{index < workflowNodes.length - 1 && <div className="node-line" />}</div><div className="node-content"><strong>{title}</strong><span>{event?.message || subtitle}</span></div><span className="node-state">{event?.status?.toUpperCase() || 'WAITING'}</span></div>
                })}</div></section>
                <section className="panel embedded-panel"><PanelHeading kicker="VERIFICATION TRAIL" title="Policy evidence" subtitle="Rule outcomes and stated basis." icon="✓" />{workflow.evidence_log.map((item, index) => <div className="evidence-item" key={item.rule + index}><span className="evidence-index">{String(index + 1).padStart(2, '0')}</span><span className="evidence-item-copy"><strong>{item.rule.replaceAll('_', ' ')}</strong><small>{item.outcome} · {item.source_title}</small><small>{item.verbatim_snippet || item.excerpt}</small>{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">View source</a>}</span></div>)}</section>
                {workflow.state === 'human_review_required' && <button className="button button-primary full-button" type="button" onClick={() => setReview(true)}>{offlinePreview ? 'Review offline preview →' : 'Review and approve portal submission →'}</button>}
                {workflow.state === 'portal_queued' && <button className="button button-primary full-button" type="button" disabled={busy} onClick={approve}>Retry portal submission →</button>}
                {workflow.application_id && <p className="form-footnote">Mock portal receipt: {workflow.application_id}</p>}
              </>}
            </>}
          </section>
          <div className="wizard-aside"><DashboardSummary monthlyUnits={form.monthly_units} tariffInrPerKwh={form.tariff_inr_per_kwh} sanctionedLoadKw={form.sanctioned_load_kw} roofAreaSqft={form.roof_area_sqft} /><section className="panel guide-prompt"><PanelHeading kicker="KNOW BEFORE YOU GO" title="How subsidies work" subtitle="Understand central assistance, metering and required documents." icon="i" /><button className="button button-outline full-button" type="button" onClick={() => setGuide(true)}>Open the solar guide</button></section>
            {workflow?.state === 'human_review_required' && <section className="panel next-panel"><div className="section-kicker">{offlinePreview ? 'LOCAL PREVIEW' : 'HUMAN REVIEW REQUIRED'}</div><p>{offlinePreview ? 'Review the local estimate; this preview will not contact a portal.' : 'Check the prepared payload before sending it to the simulated portal.'}</p><button className="button button-primary full-button" type="button" onClick={() => setReview(true)}>{offlinePreview ? 'Review offline preview' : 'Review submission'}</button></section>}
          </div>
        </div>
        <footer className="page-footer"><span>GoSolar · Demonstration only</span><span>Not a government service or eligibility determination</span></footer>
      </main>
    </div>
    {review && workflow && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReview(false) }}><section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title"><div className="modal-header"><div><div className="eyebrow">{offlinePreview ? 'OFFLINE PREVIEW' : 'HUMAN-IN-THE-LOOP GATE'}</div><h2 id="review-title">{offlinePreview ? 'Review local preview' : 'Review before portal submission'}</h2><p>{offlinePreview ? 'Completing this preview will not contact a backend or portal.' : 'Approval submits prepared data to the simulated portal.'}</p></div><button className="modal-close" aria-label="Close review" onClick={() => setReview(false)}>×</button></div><div className="review-banner"><span>✓</span><div><strong>{offlinePreview ? 'Local estimate is ready' : 'Application checks are ready'}</strong><p>This is a synthetic filing and does not create a government application.</p></div></div><div className="diff-grid"><div className="diff-card"><div className="diff-title">REVIEWED APPLICATION</div><dl>{Object.entries(workflow.application_parameters).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd>{Array.isArray(value) ? value.join(', ') || '—' : String(value)}</dd></div>)}</dl></div></div><div className="modal-foot"><button className="button button-quiet" onClick={() => setReview(false)}>Back to estimate</button><button className="button button-primary" disabled={busy} onClick={approve}>{busy ? 'Submitting…' : offlinePreview ? 'Complete local preview' : 'Approve and submit'} →</button></div></section></div>}
    <SubsidyGuideModal open={guide} onClose={() => setGuide(false)} />
  </div>
}

function PanelHeading({ kicker, title, subtitle, icon }: { kicker: string; title: string; subtitle: string; icon: string }) {
  return <div className="panel-heading"><div><div className="section-kicker">{kicker}</div><h2>{title}</h2><p>{subtitle}</p></div><div className="step-icon">{icon}</div></div>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
export default App
