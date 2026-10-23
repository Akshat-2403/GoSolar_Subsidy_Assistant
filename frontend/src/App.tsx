import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import './App.css'

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const PORTAL_URL = import.meta.env.VITE_PORTAL_URL || 'http://127.0.0.1:8001'

type EventItem = { node: string; status: string; message: string; timestamp: string }
type Evidence = { rule: string; outcome: string; excerpt: string; checked_at: string; source_url: string | null }
type Workflow = {
  workflow_id: string; state: string; can_proceed: boolean; human_approval_required: boolean
  issues: string[]; missing_documents: string[]; application_parameters: Record<string, unknown>
  evidence_log: Evidence[]; events: EventItem[]; financial_summary: null | {
    estimated_subsidy_inr: number; estimated_annual_generation_kwh: number; estimated_annual_savings_inr: number; estimated_payback_years: number
  }; application_id: string | null
}
type Intake = {
  applicant_name: string; state: string; applicant_type: 'owner' | 'tenant'; consumer_number: string
  discom_code: string; sanctioned_load_kw: number; proposed_capacity_kw: number; owns_rooftop: boolean
  has_grid_connection: boolean; installer_id: string; installer_empanelled: boolean; landlord_noc_uploaded: boolean
  required_documents: string; uploaded_documents: string; tariff_inr_per_kwh: number
}
const defaults: Intake = {
  applicant_name: '', state: '', applicant_type: 'owner', consumer_number: '', discom_code: '',
  sanctioned_load_kw: 5, proposed_capacity_kw: 3, owns_rooftop: true, has_grid_connection: true,
  installer_id: '', installer_empanelled: true, landlord_noc_uploaded: false,
  required_documents: '', uploaded_documents: '', tariff_inr_per_kwh: 8,
}
const nodes = [
  ['validate_input', 'Validate intake schema', 'Required fields and numeric bounds'],
  ['policy_checks', 'Evaluate policy guardrails', 'Ownership · grid · vendor · capacity · documents'],
  ['financial_calculation', 'Calculate estimate', 'Subsidy slab · generation · payback'],
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

  const activeWorkflowId = workflow?.workflow_id

  useEffect(() => {
    if (!activeWorkflowId) return
    const stream = new EventSource(API_URL + '/api/workflows/' + activeWorkflowId + '/events')
    stream.onmessage = (message) => {
      try {
        const item = JSON.parse(message.data) as EventItem
        setEvents((current) => current.some((event) => event.node === item.node && event.timestamp === item.timestamp) ? current : [...current, item])
      } catch { setError('Received an unreadable workflow event.') }
    }
    stream.addEventListener('complete', () => stream.close())
    stream.onerror = () => stream.close()
    return () => stream.close()
  }, [activeWorkflowId])

  function update<K extends keyof Intake>(key: K, value: Intake[K]) { setForm((current) => ({ ...current, [key]: value })) }
  async function evaluate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true)
    const payload = {
      ...form, consumer_number: form.consumer_number.trim().toUpperCase(),
      required_documents: form.required_documents.split(',').map((x) => x.trim()).filter(Boolean),
      uploaded_documents: form.uploaded_documents.split(',').map((x) => x.trim()).filter(Boolean),
    }
    try {
      const response = await fetch(API_URL + '/api/workflows/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Evaluation failed (' + response.status + ')')
      setWorkflow(data as Workflow); setEvents(data.events as EventItem[])
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not reach the backend.') }
    finally { setBusy(false) }
  }
  async function approve() {
    if (!workflow) return
    setBusy(true); setError('')
    try {
      const response = await fetch(API_URL + '/api/workflows/' + workflow.workflow_id + '/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ human_approved: true }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Submission failed (' + response.status + ')')
      setWorkflow(data as Workflow); setEvents(data.events as EventItem[]); setReview(false)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not submit to the mock portal.') }
    finally { setBusy(false) }
  }
  function startNew() { setWorkflow(null); setEvents([]); setError(''); setReview(false); setForm(defaults) }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">☼</div><div><strong>rooftop<span>.</span></strong><small>SUBSIDY ASSISTANT</small></div></div>
      <div className="workspace-label">MISSION CONTROL</div>
      <nav className="nav-list"><button className="nav-item selected"><span className="nav-icon">▦</span>New application</button><button className="nav-item" onClick={startNew}><span className="nav-icon">◷</span>Start over</button></nav>
      <div className="sidebar-bottom"><div className="system-card"><span className="status-dot" /><div><strong>Demo services</strong><small>Agent API · mock portal</small></div></div><div className="profile"><div className="avatar">AI</div><div><strong>Operator workspace</strong><small>Human approval enabled</small></div></div></div>
    </aside>
    <div className="main-area">
      <header className="topbar"><div className="breadcrumbs">Applications <span>/</span><strong>New evaluation</strong></div><div className="topbar-right"><div className="env-pill"><span className="status-dot" />DEMO ENVIRONMENT</div><a className="button button-quiet" href={PORTAL_URL} target="_blank" rel="noreferrer">Open mock portal ↗</a></div></header>
      <main className="page-content">
        <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" />ROOFTOP SOLAR · APPLICATION REVIEW</div><h1>Subsidy <span>Mission Control</span></h1><p>Evaluate application details, inspect evidence, then approve a simulated portal filing.</p></div>{(workflow?.state === 'human_review_required' || workflow?.state === 'portal_queued') && <button className="button button-primary" onClick={() => workflow.state === 'portal_queued' ? approve() : setReview(true)}>{workflow.state === 'portal_queued' ? 'Retry portal submission' : 'Review and approve'} →</button>}</div>
        <section className="summary-grid">
          <Summary label="WORKFLOW" value={workflow?.workflow_id || '—'} foot="Evaluation reference" tone="green" icon="⌘" />
          <Summary label="STATUS" value={workflow?.state.replaceAll('_', ' ') || 'Awaiting intake'} foot={workflow?.human_approval_required ? 'Waiting for your review' : workflow ? workflow.issues.length + ' open issue(s)' : 'Submit details to begin'} tone={workflow?.issues.length ? 'amber' : 'blue'} icon="◷" />
          <Summary label="EST. SUBSIDY" value={workflow?.financial_summary ? '₹' + workflow.financial_summary.estimated_subsidy_inr.toLocaleString('en-IN') : '—'} foot="Indicative calculation" tone="violet" icon="₹" />
          <Summary label="PORTAL APPLICATION" value={workflow?.application_id || '—'} foot={workflow?.application_id ? 'Simulated portal receipt' : 'Not submitted'} tone="green" icon="↗" />
        </section>
        {error && <div className="notice notice-warning"><span className="notice-symbol">!</span>{error}<button onClick={() => setError('')}>×</button></div>}
        {workflow?.issues.map((issue) => <div className="notice notice-warning" key={issue}><span className="notice-symbol">!</span>{issue}</div>)}
        {workflow?.state === 'submitted' && <div className="notice notice-success"><span className="notice-symbol">✓</span>Mock portal accepted the filing. This is a demonstration receipt, not a government approval.</div>}

        <div className="mission-grid">
          <section className="panel">
            <PanelHeading kicker="STEP 01 · INTAKE" title="Applicant information" subtitle="Enter utility and project details for an initial assessment." icon="＋" />
            <form onSubmit={evaluate}>
              <Field label="Applicant name"><input required minLength={2} value={form.applicant_name} onChange={(e) => update('applicant_name', e.target.value)} placeholder="e.g. Asha Sharma" /></Field>
              <div className="form-grid">
                <Field label="State"><input required value={form.state} onChange={(e) => update('state', e.target.value)} placeholder="Maharashtra" /></Field>
                <Field label="Applicant type"><select value={form.applicant_type} onChange={(e) => update('applicant_type', e.target.value as Intake['applicant_type'])}><option value="owner">Owner</option><option value="tenant">Tenant</option></select></Field>
                <Field label="Consumer number"><input required minLength={8} maxLength={16} pattern="[A-Za-z0-9]{8,16}" value={form.consumer_number} onChange={(e) => update('consumer_number', e.target.value)} placeholder="8–16 letters or digits" /></Field>
                <Field label="DISCOM code"><input required value={form.discom_code} onChange={(e) => update('discom_code', e.target.value)} placeholder="e.g. MSEDCL" /></Field>
                <Field label="Sanctioned load (kW)"><input required type="number" min="0.1" step="0.1" value={form.sanctioned_load_kw} onChange={(e) => update('sanctioned_load_kw', Number(e.target.value))} /></Field>
                <Field label="Planned capacity (kW)"><input required type="number" min="0.1" step="0.1" value={form.proposed_capacity_kw} onChange={(e) => update('proposed_capacity_kw', Number(e.target.value))} /></Field>
                <Field label="Installer ID"><input required value={form.installer_id} onChange={(e) => update('installer_id', e.target.value)} placeholder="Installer registry ID" /></Field>
                <Field label="Tariff (₹ / kWh)"><input required type="number" min="0.1" step="0.1" value={form.tariff_inr_per_kwh} onChange={(e) => update('tariff_inr_per_kwh', Number(e.target.value))} /></Field>
              </div>
              <div className="form-section-title">DECLARATIONS AND DOCUMENT CHECKLIST</div>
              <label className="check-line"><input type="checkbox" checked={form.owns_rooftop} onChange={(e) => update('owns_rooftop', e.target.checked)} /> Rooftop ownership is established</label>
              <label className="check-line"><input type="checkbox" checked={form.has_grid_connection} onChange={(e) => update('has_grid_connection', e.target.checked)} /> Active grid connection</label>
              <label className="check-line"><input type="checkbox" checked={form.installer_empanelled} onChange={(e) => update('installer_empanelled', e.target.checked)} /> Installer marked empanelled (demo declaration)</label>
              {form.applicant_type === 'tenant' && <label className="noc-field full"><input type="checkbox" checked={form.landlord_noc_uploaded} onChange={(e) => update('landlord_noc_uploaded', e.target.checked)} /><span><strong>Landlord NOC recorded</strong><small>Authenticity is not independently verified.</small></span><span className="tiny-tag warning">REQUIRED</span></label>}
              <Field label="Required documents (comma separated)"><input value={form.required_documents} onChange={(e) => update('required_documents', e.target.value)} placeholder="Electricity bill, identity proof" /></Field>
              <Field label="Documents recorded as uploaded (comma separated)"><input value={form.uploaded_documents} onChange={(e) => update('uploaded_documents', e.target.value)} placeholder="Electricity bill" /></Field>
              <button className="button button-primary full-button" type="submit" disabled={busy}>{busy ? 'Processing…' : workflow ? 'Re-evaluate application' : 'Evaluate application'} <span className="button-arrow">→</span></button>
              <p className="form-footnote">Demo only · this build does not process uploaded document contents.</p>
            </form>
          </section>

          <div className="center-column">
            <section className="panel"><PanelHeading kicker="STEP 02 · AGENT WORKFLOW" title="Live evaluation" subtitle="Deterministic checks and human review gate." icon="⌁" /><div className="live-pill live-active"><span />{workflow ? 'WORKFLOW EVENTS' : 'READY FOR INTAKE'}</div>
              <div className="workflow-list">{nodes.map(([node, title, subtitle], index) => {
                const event = events.find((item) => item.node === node)
                const done = event?.status === 'completed' || event?.status === 'submitted'
                const blocked = event?.status === 'blocked'
                const active = event?.status === 'waiting'
                return <div className={'workflow-node ' + (done ? 'done ' : '') + (active ? 'active ' : '') + (blocked ? 'blocked' : '')} key={node}>
                  <div className="node-rail"><div className="node-circle">{done ? '✓' : blocked ? '!' : index + 1}</div>{index < 4 && <div className="node-line" />}</div>
                  <div className="node-content"><strong>{title}</strong><span>{event?.message || subtitle}</span></div><span className="node-state">{event?.status?.toUpperCase() || 'WAITING'}</span>
                </div>
              })}</div>
              {workflow?.financial_summary && <div className="finance-foot"><div><span>Annual generation</span><strong>{workflow.financial_summary.estimated_annual_generation_kwh.toLocaleString('en-IN')} kWh</strong></div><div><span>Estimated payback</span><strong>{workflow.financial_summary.estimated_payback_years} years</strong></div></div>}
            </section>
            {workflow?.state === 'human_review_required' && <section className="panel next-panel"><div className="section-kicker">NEXT ACTION</div><div className="next-icon">✓</div><h3>Ready for your review</h3><p>Check the payload and evidence before sending it to the demo portal.</p><button className="button button-primary full-button" onClick={() => setReview(true)}>Open review diff →</button></section>}
          </div>

          <div className="right-column">
            <section className="panel evidence-panel"><PanelHeading kicker="STEP 03 · EVIDENCE" title="Verification trail" subtitle="Rule outcomes and stated basis." icon="⌕" /><div className="evidence-status"><span className="status-dot amber-dot" />{workflow ? workflow.evidence_log.length + ' CHECKS RECORDED' : 'NO EVIDENCE YET'}</div>
              <div className="evidence-list">{workflow?.evidence_log.map((item, index) => <div className="evidence-item" key={item.rule + index}><span className="evidence-index">{String(index + 1).padStart(2, '0')}</span><span className="evidence-item-copy"><strong>{item.rule.replaceAll('_', ' ')}</strong><small>{item.outcome} · {new Date(item.checked_at).toLocaleString()}</small><small>{item.excerpt}</small>{item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">View source</a>}</span></div>)}
              {!workflow && <p className="form-footnote">Evidence entries appear after evaluation. Applicant declarations are not independent verification.</p>}</div>
              {workflow && <div className="evidence-disclaimer"><span>ⓘ</span><p>Registry and document authenticity checks are not connected. Entries without a source URL reflect submitted information.</p></div>}
            </section>
            <section className="panel"><PanelHeading kicker="DEMO TARGET" title="Mock DISCOM portal" subtitle="Standalone simulated filing target." icon="↗" /><p className="form-footnote">The agent sends the approved payload to this portal. No government system is contacted.</p><a className="button button-outline full-button" href={PORTAL_URL} target="_blank" rel="noreferrer">Open portal ↗</a></section>
          </div>
        </div>
        <footer className="page-footer"><span>Rooftop Solar Subsidy Assistant · Demonstration only</span><span>Not a government service or eligibility determination</span></footer>
      </main>
    </div>
    {review && workflow && <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setReview(false) }}>
      <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
        <div className="modal-header"><div><div className="eyebrow">HUMAN-IN-THE-LOOP GATE</div><h2 id="review-title">Review before portal submission</h2><p>Approval submits the prepared data to the simulated portal.</p></div><button className="modal-close" aria-label="Close review" onClick={() => setReview(false)}>×</button></div>
        <div className="review-banner"><span>✓</span><div><strong>Application checks are ready</strong><p>This is a synthetic filing and does not create a government application.</p></div></div>
        <div className="diff-grid">{[workflow.application_parameters, {
          applicant_name: workflow.application_parameters.applicant_name,
          consumer_number: workflow.application_parameters.consumer_number,
          discom_code: workflow.application_parameters.discom_code,
          state: workflow.application_parameters.state,
          planned_capacity_kw: workflow.application_parameters.proposed_capacity_kw,
          sanctioned_load_kw: workflow.application_parameters.sanctioned_load_kw,
          vendor_id: workflow.application_parameters.installer_id,
        }].map((record, side) => <div className={'diff-card ' + (side ? 'normalized' : '')} key={side}><div className="diff-title">{side ? '02  MOCK PORTAL PAYLOAD' : '01  REVIEWED INTAKE'}</div><dl>{Object.entries(record).map(([key, value]) => <div key={key}><dt>{key.replaceAll('_', ' ')}</dt><dd className={side ? 'green-text' : ''}>{Array.isArray(value) ? value.join(', ') || '—' : String(value)}</dd></div>)}</dl></div>)}</div>
        <div className="modal-foot"><button className="button button-quiet" onClick={() => setReview(false)}>Back to application</button><button className="button button-primary" disabled={busy} onClick={approve}>{busy ? 'Submitting…' : 'Approve and submit'} →</button></div>
      </section>
    </div>}
  </div>
}

function Summary({ label, value, foot, tone, icon }: { label: string; value: string; foot: string; tone: string; icon: string }) {
  return <article className="summary-card"><div className="summary-label">{label}<span className={'summary-icon ' + tone}>{icon}</span></div><div className="summary-value status-value">{value}</div><div className="summary-foot">{foot}</div></article>
}
function PanelHeading({ kicker, title, subtitle, icon }: { kicker: string; title: string; subtitle: string; icon: string }) {
  return <div className="panel-heading"><div><div className="section-kicker">{kicker}</div><h2>{title}</h2><p>{subtitle}</p></div><div className="step-icon">{icon}</div></div>
}
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="field"><span>{label}</span>{children}</label> }
export default App




