import { useMemo, useRef, useState } from 'react'
import './App.css'

type WorkflowStatus = 'idle' | 'running' | 'blocked' | 'review' | 'submitted'
type NodeStatus = 'done' | 'active' | 'waiting' | 'blocked'
type FormData = {
  consumerNumber: string
  discomCode: string
  sanctionedLoad: number
  capacity: number
  ownership: 'OWNER' | 'TENANT'
  nocAttached: boolean
  vendor: string
  monthlyConsumption: number
  rooftopArea: number
  tariff: number
  costPerKw: number
}
type Evidence = {
  title: string
  clause: string
  snippet: string
  sourceUrl: string
  note: string
}

const initialForm: FormData = {
  consumerNumber: 'ABCD12345678',
  discomCode: 'MSEDCL',
  sanctionedLoad: 5,
  capacity: 3,
  ownership: 'OWNER',
  nocAttached: false,
  vendor: 'sunrise-approved',
  monthlyConsumption: 350,
  rooftopArea: 400,
  tariff: 8,
  costPerKw: 60000,
}

const vendors = [
  { id: 'sunrise-approved', name: 'Sunrise Solar — empanelled', approved: true },
  { id: 'green-grid-approved', name: 'GreenGrid Energy — empanelled', approved: true },
  { id: 'unverified-vendor', name: 'Local installer — not verified', approved: false },
]

const evidenceItems: Evidence[] = [
  {
    title: 'Central subsidy calculation',
    clause: 'Specification §3.3 · Tiered subsidy',
    snippet: 'First 2 kW: ₹30,000 per kW. Third kW: ₹18,000. Capacity of 3 kW or more is capped at ₹78,000 total.',
    sourceUrl: 'https://pmsuryaghar.gov.in/',
    note: 'Figures shown here follow the project specification and must be verified against current official scheme guidance before real applications.',
  },
  {
    title: 'Sanctioned-load guardrail',
    clause: 'Specification §3.3 · Rule C',
    snippet: 'The proposal is flagged when planned solar capacity exceeds the sanctioned load; offer a capped proposal or a load-enhancement path.',
    sourceUrl: 'https://www.mahadiscom.in/',
    note: 'Actual capacity limits depend on the applicable DISCOM rules and connection type. The frontend does not independently certify compliance.',
  },
  {
    title: 'Ownership and NOC',
    clause: 'Specification §3.3 · Rule A',
    snippet: 'When roof ownership is TENANT, a No Objection Certificate must be attached before the workflow can advance.',
    sourceUrl: 'https://pmsuryaghar.gov.in/',
    note: 'This is the project’s workflow guardrail. Confirm the documents required for the applicant’s specific property and scheme.',
  },
]

function formatINR(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function calculateSubsidy(capacity: number) {
  const kw = Math.max(0, capacity)
  return Math.min(kw, 2) * 30000 + Math.min(Math.max(kw - 2, 0), 1) * 18000
}

function App() {
  const [form, setForm] = useState<FormData>(initialForm)
  const [status, setStatus] = useState<WorkflowStatus>('idle')
  const [activeNav, setActiveNav] = useState('Mission control')
  const [selectedEvidence, setSelectedEvidence] = useState<Evidence | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [notice, setNotice] = useState('Demo mode · calculations use the project specification')
  const [applicationId, setApplicationId] = useState('')
  const [lastRun, setLastRun] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const chosenVendor = vendors.find((vendor) => vendor.id === form.vendor) ?? vendors[0]
  const subsidy = useMemo(() => calculateSubsidy(form.capacity), [form.capacity])
  const annualGeneration = form.capacity * 1450
  const estimatedSystemCost = form.capacity * form.costPerKw
  const netCost = Math.max(0, estimatedSystemCost - subsidy)
  const annualSavings = annualGeneration * form.tariff
  const payback = annualSavings > 0 ? netCost / annualSavings : 0
  const areaRequired = form.capacity * 100
  const capacityExceeded = form.capacity > form.sanctionedLoad
  const areaInsufficient = form.rooftopArea > 0 && form.rooftopArea < areaRequired
  const consumerValid = /^[A-Z0-9]{8,16}$/.test(form.consumerNumber.trim())
  const blockers = [
    !consumerValid ? 'Consumer number must be 8–16 uppercase letters or digits.' : '',
    form.ownership === 'TENANT' && !form.nocAttached ? 'Tenant application needs an uploaded NOC before it can continue.' : '',
    !chosenVendor.approved ? 'Selected installer is not verified as empanelled.' : '',
    areaInsufficient ? `Rooftop area appears low: approximately ${areaRequired} sq. ft. is needed for ${form.capacity} kW.` : '',
  ].filter(Boolean)
  const warnings = [
    capacityExceeded ? `Proposed capacity (${form.capacity} kW) exceeds sanctioned load (${form.sanctionedLoad} kW).` : '',
  ].filter(Boolean)

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
    setStatus('idle')
    setApplicationId('')
  }

  const handleFile = (file?: File) => {
    if (!file) return
    setUploadName(file.name)
    setNotice(`${file.name} attached. OCR auto-fill requires a connected backend; review extracted values before use.`)
  }

  const runValidation = () => {
    setLastRun(new Date().toLocaleTimeString())
    setApplicationId('')
    if (blockers.length > 0) {
      setStatus('blocked')
      setNotice('Validation halted: resolve the blocking items listed in Intake & validation.')
      return
    }
    setStatus('review')
    setNotice(warnings.length ? 'Validation completed with a capacity warning. Review the proposal before proceeding.' : 'Validation completed. Human review is required before any submission.')
    setReviewOpen(true)
  }

  const authorizeSubmission = async () => {
    if (blockers.length > 0) {
      setReviewOpen(false)
      setStatus('blocked')
      setNotice('Submission blocked. Resolve the validation issues first.')
      return
    }
    setSubmitting(true)
    const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '')
    if (!apiBase) {
      setSubmitting(false)
      setReviewOpen(false)
      setNotice('Demo only: no VITE_API_BASE_URL is configured. No application was submitted. Configure your real backend endpoint before enabling submission.')
      setStatus('review')
      return
    }
    try {
      // Replace /api/applications/submit with the actual route exposed by your FastAPI backend.
      const response = await fetch(`${apiBase}/api/applications/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consumer_number: form.consumerNumber,
          discom_code: form.discomCode,
          sanctioned_load_kw: form.sanctionedLoad,
          planned_capacity_kw: form.capacity,
          roof_ownership_type: form.ownership,
          noc_document_attached: form.nocAttached,
          selected_vendor_id: form.vendor,
          monthly_avg_consumption_kwh: form.monthlyConsumption,
          rooftop_area_sqft: form.rooftopArea,
          human_approved: true,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.detail || `Backend returned HTTP ${response.status}`)
      const id = payload.application_id || payload.applicationId || payload.id
      if (!id) throw new Error('Backend responded without an application ID. Submission status is unconfirmed.')
      setApplicationId(String(id))
      setStatus('submitted')
      setNotice('Backend returned an application ID. Verify the record and audit log in your backend.')
      setReviewOpen(false)
    } catch (error) {
      setStatus('review')
      setNotice(`Submission could not be confirmed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setReviewOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const exportAudit = () => {
    const audit = {
      product: 'Rooftop Solar Subsidy Assistant',
      exported_at: new Date().toISOString(),
      mode: import.meta.env.VITE_API_BASE_URL ? 'backend-configured' : 'demo-only',
      workflow_status: status,
      application_id: applicationId || null,
      input: form,
      calculations: {
        subsidy_inr: subsidy,
        annual_generation_kwh: annualGeneration,
        estimated_system_cost_inr: estimatedSystemCost,
        net_cost_after_subsidy_inr: netCost,
        estimated_annual_savings_inr: annualSavings,
        estimated_payback_years: Number(payback.toFixed(2)),
      },
      blockers,
      warnings,
      document: uploadName || null,
      note: 'Frontend-generated summary; not a digitally signed or official government audit document.',
    }
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'rooftop-solar-audit-summary.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const nodes: { title: string; detail: string; state: NodeStatus }[] = [
    { title: 'Input ingest', detail: 'Document & form intake', state: status === 'idle' ? 'waiting' : 'done' },
    { title: 'Rule verification', detail: blockers.length ? 'Blocking issue found' : warnings.length ? 'Review warning' : 'Guardrails checked', state: status === 'blocked' ? 'blocked' : status === 'idle' ? 'waiting' : 'done' },
    { title: 'Financial engine', detail: 'Subsidy & payback estimate', state: status === 'idle' || status === 'blocked' ? 'waiting' : 'done' },
    { title: 'Human review gate', detail: status === 'review' ? 'Awaiting decision' : status === 'submitted' ? 'Approved' : 'Approval required', state: status === 'review' ? 'active' : status === 'submitted' ? 'done' : 'waiting' },
    { title: 'Portal submitter', detail: status === 'submitted' ? 'Backend confirmed ID' : 'Not executed', state: status === 'submitted' ? 'done' : 'waiting' },
  ]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><span>☀</span></div>
          <div><strong>rooftop<span>.</span></strong><small>SUBSIDY ASSISTANT</small></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list" aria-label="Main navigation">
          {[
            ['Mission control', '◫'],
            ['Applications', '▤'],
            ['Evidence library', '⌕'],
            ['Audit trail', '↗'],
          ].map(([label, icon]) => (
            <button key={label} className={`nav-item ${activeNav === label ? 'selected' : ''}`} onClick={() => {
              setActiveNav(label)
              if (label === 'Evidence library') setSelectedEvidence(evidenceItems[0])
              if (label === 'Audit trail') setNotice('Audit summary is generated locally from the current workflow. Export it using the button below.')
            }}>
              <span className="nav-icon">{icon}</span>{label}
              {label === 'Applications' && applicationId && <span className="nav-count">1</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="system-card">
            <span className="status-dot" />
            <div><strong>Local workspace</strong><small>Backend connection unverified</small></div>
          </div>
          <div className="profile">
            <div className="avatar">RA</div><div><strong>Rooftop Admin</strong><small>Project workspace</small></div><span className="profile-more">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">Workspace <span>/</span> <strong>{activeNav}</strong></div>
          <div className="topbar-right"><span className="env-pill"><span className="status-dot" /> DEVELOPMENT</span><button className="icon-button" aria-label="Notifications">♧</button><div className="avatar small-avatar">RA</div></div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> SOLAR SUBSIDY WORKFLOW</div>
              <h1>Mission control<span>.</span></h1>
              <p>Validate an application, inspect the evidence, and approve every action with confidence.</p>
            </div>
            <button className="button button-quiet" onClick={exportAudit}><span>↓</span> Export audit summary</button>
          </section>

          <section className="summary-grid" aria-label="Application overview">
            <div className="summary-card">
              <div className="summary-label">ESTIMATED SUBSIDY <span className="summary-icon green">₹</span></div>
              <div className="summary-value">{formatINR(subsidy)}</div>
              <div className="summary-foot"><span className="mini-check">✓</span> Based on project subsidy tiers</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">ANNUAL GENERATION <span className="summary-icon amber">☼</span></div>
              <div className="summary-value">{annualGeneration.toLocaleString('en-IN')} <small>kWh</small></div>
              <div className="summary-foot">Estimated · 1,450 kWh per kW/year</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">PAYBACK PERIOD <span className="summary-icon blue">↗</span></div>
              <div className="summary-value">{payback.toFixed(1)} <small>years</small></div>
              <div className="summary-foot">Illustrative, based on entered costs</div>
            </div>
            <div className="summary-card">
              <div className="summary-label">WORKFLOW STATUS <span className="summary-icon violet">◷</span></div>
              <div className="summary-value status-value">{status === 'submitted' ? 'Verified' : status === 'blocked' ? 'Blocked' : status === 'review' ? 'In review' : 'Draft'}</div>
              <div className="summary-foot"><span className={`status-chip ${status}`}>{status === 'submitted' ? 'ID received' : status === 'blocked' ? 'Action needed' : status === 'review' ? 'Sign-off needed' : 'Not started'}</span></div>
            </div>
          </section>

          {notice && <div className={`notice ${status === 'blocked' ? 'notice-warning' : status === 'submitted' ? 'notice-success' : ''}`}><span className="notice-symbol">{status === 'blocked' ? '!' : status === 'submitted' ? '✓' : 'i'}</span><span>{notice}</span><button aria-label="Dismiss notice" onClick={() => setNotice('')}>×</button></div>}

          <section className="mission-grid">
            <div className="panel intake-panel">
              <div className="panel-heading">
                <div><div className="section-kicker">01 / INTAKE</div><h2>Application details</h2><p>Enter consumer and rooftop information.</p></div>
                <span className="step-icon">↙</span>
              </div>

              <div className="upload-zone" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files[0]) }}>
                <input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={(event) => handleFile(event.target.files?.[0])} />
                <div className="upload-icon">↑</div>
                <div className="upload-copy"><strong>{uploadName || 'Upload electricity bill'}</strong><span>{uploadName ? 'Attached locally · OCR not yet connected' : 'Drag & drop PDF or image, or browse files'}</span></div>
                <button className="browse-button" onClick={() => fileInput.current?.click()}>Browse</button>
              </div>

              <div className="form-section-title">CONSUMER INFORMATION</div>
              <div className="form-grid">
                <label className="field full"><span>Consumer account number</span><input value={form.consumerNumber} maxLength={16} onChange={(e) => update('consumerNumber', e.target.value.toUpperCase())} placeholder="8–16 letters or digits" /><small>Demo value prefilled. Confirm against the utility bill.</small></label>
                <label className="field"><span>Distribution company (DISCOM)</span><select value={form.discomCode} onChange={(e) => update('discomCode', e.target.value)}><option value="MSEDCL">MSEDCL · Maharashtra</option><option value="BESCOM">BESCOM · Karnataka</option><option value="TANGEDCO">TANGEDCO · Tamil Nadu</option><option value="OTHER">Other / not listed</option></select></label>
                <label className="field"><span>Monthly usage (kWh)</span><input type="number" min="1" value={form.monthlyConsumption} onChange={(e) => update('monthlyConsumption', Math.max(1, Number(e.target.value)))} /></label>
              </div>

              <div className="form-section-title">ROOFTOP & SYSTEM</div>
              <div className="form-grid">
                <label className="field"><span>Roof ownership</span><select value={form.ownership} onChange={(e) => update('ownership', e.target.value as FormData['ownership'])}><option value="OWNER">Owner</option><option value="TENANT">Tenant / leased</option></select></label>
                <label className="field"><span>Sanctioned load (kW)</span><input type="number" min="0.1" step="0.1" value={form.sanctionedLoad} onChange={(e) => update('sanctionedLoad', Math.max(0.1, Number(e.target.value)))} /></label>
                <label className="field full range-field"><span>Planned solar capacity <strong>{form.capacity.toFixed(1)} kW</strong></span><input type="range" min="0.5" max="10" step="0.5" value={form.capacity} onChange={(e) => update('capacity', Number(e.target.value))} /><div className="range-labels"><span>0.5 kW</span><span>10 kW</span></div></label>
                <label className="field"><span>Shadow-free roof area (sq. ft.)</span><input type="number" min="0" value={form.rooftopArea} onChange={(e) => update('rooftopArea', Math.max(0, Number(e.target.value)))} /></label>
                <label className="field"><span>Installer / vendor</span><select value={form.vendor} onChange={(e) => update('vendor', e.target.value)}>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
                {form.ownership === 'TENANT' && <label className="noc-field full"><input type="checkbox" checked={form.nocAttached} onChange={(e) => update('nocAttached', e.target.checked)} /><span><strong>Landlord NOC attached</strong><small>Confirm the NOC is actually attached before proceeding.</small></span><span className={`tiny-tag ${form.nocAttached ? 'ok' : 'warning'}`}>{form.nocAttached ? 'ATTACHED' : 'REQUIRED'}</span></label>}
              </div>

              <div className="form-section-title">FINANCIAL ASSUMPTIONS</div>
              <div className="form-grid">
                <label className="field"><span>Average system cost / kW (₹)</span><input type="number" min="1" value={form.costPerKw} onChange={(e) => update('costPerKw', Math.max(1, Number(e.target.value)))} /></label>
                <label className="field"><span>Retail tariff (₹ / kWh)</span><input type="number" min="0.1" step="0.1" value={form.tariff} onChange={(e) => update('tariff', Math.max(0.1, Number(e.target.value)))} /></label>
              </div>

              <div className="validation-box">
                <div className="validation-head"><strong>Pre-flight checks</strong><span className={blockers.length ? 'text-danger' : 'text-success'}>{blockers.length ? `${blockers.length} blocker(s)` : 'No blockers detected'}</span></div>
                {blockers.length === 0 && warnings.length === 0 && <div className="check-line"><span className="check-circle">✓</span> Consumer format, vendor, ownership and roof area look ready for review.</div>}
                {blockers.map((item) => <div className="issue-line" key={item}><span>!</span>{item}</div>)}
                {warnings.map((item) => <div className="warning-line" key={item}><span>△</span>{item}</div>)}
              </div>
              <button className="button button-primary full-button" onClick={runValidation}><span>✦</span> Run validation agent <span className="button-arrow">→</span></button>
              <div className="form-footnote">No portal action occurs until the human review gate is approved.</div>
            </div>

            <div className="center-column">
              <div className="panel workflow-panel">
                <div className="panel-heading">
                  <div><div className="section-kicker">02 / ORCHESTRATION</div><h2>Live workflow</h2><p>Agent state machine · frontend simulation</p></div>
                  <span className={`live-pill ${status !== 'idle' ? 'live-active' : ''}`}><span />{status === 'idle' ? 'STANDBY' : status === 'blocked' ? 'HALTED' : status === 'submitted' ? 'COMPLETE' : 'ACTIVE'}</span>
                </div>
                <div className="workflow-list">
                  {nodes.map((node, index) => <div className={`workflow-node ${node.state}`} key={node.title}>
                    <div className="node-rail"><div className="node-circle">{node.state === 'done' ? '✓' : node.state === 'blocked' ? '!' : String(index + 1).padStart(2, '0')}</div>{index < nodes.length - 1 && <div className="node-line" />}</div>
                    <div className="node-content"><strong>{node.title}</strong><span>{node.detail}</span></div>
                    <span className="node-state">{node.state === 'done' ? 'DONE' : node.state === 'active' ? 'WAITING' : node.state === 'blocked' ? 'BLOCKED' : 'QUEUED'}</span>
                  </div>)}
                </div>
                <div className="workflow-footer"><div><span className="status-dot" /> {lastRun ? `Last run at ${lastRun}` : 'Waiting for validation input'}</div><span>STATEFUL FLOW</span></div>
              </div>

              <div className="panel finance-panel">
                <div className="panel-heading compact-heading"><div><div className="section-kicker">03 / FINANCIAL ENGINE</div><h2>Solar yield forecast</h2></div><span className="finance-badge">ESTIMATE</span></div>
                <div className="finance-main"><div><span className="metric-label">Net cost after subsidy</span><strong>{formatINR(netCost)}</strong><span className="metric-caption">System cost less estimated subsidy</span></div><div className="sun-illustration">☼</div></div>
                <div className="finance-bars">
                  <div className="bar-row"><span>Gross system cost</span><strong>{formatINR(estimatedSystemCost)}</strong><div className="bar-track"><div className="bar-fill cost-fill" style={{ width: '100%' }} /></div></div>
                  <div className="bar-row"><span>Estimated subsidy</span><strong>{formatINR(subsidy)}</strong><div className="bar-track"><div className="bar-fill subsidy-fill" style={{ width: `${Math.min(100, estimatedSystemCost ? subsidy / estimatedSystemCost * 100 : 0)}%` }} /></div></div>
                </div>
                <div className="finance-foot"><div><span>Annual savings</span><strong>{formatINR(annualSavings)}</strong></div><div><span>Required roof area</span><strong>{areaRequired.toLocaleString('en-IN')} sq. ft.</strong></div></div>
              </div>
            </div>

            <aside className="right-column">
              <div className="panel evidence-panel">
                <div className="panel-heading">
                  <div><div className="section-kicker">04 / TRACEABILITY</div><h2>Evidence drawer</h2><p>Inspect the rule behind each check.</p></div>
                  <span className="evidence-icon">⌕</span>
                </div>
                <div className="evidence-status"><span className="status-dot amber-dot" /> SPECIFICATION-BASED DEMO</div>
                <div className="evidence-list">
                  {evidenceItems.map((item, index) => <button className={`evidence-item ${selectedEvidence?.title === item.title ? 'evidence-selected' : ''}`} key={item.title} onClick={() => setSelectedEvidence(selectedEvidence?.title === item.title ? null : item)}>
                    <span className="evidence-index">0{index + 1}</span><span className="evidence-item-copy"><strong>{item.title}</strong><small>{item.clause}</small></span><span className="evidence-chevron">↗</span>
                  </button>)}
                </div>
                {selectedEvidence && <div className="evidence-detail"><div className="evidence-detail-top"><span>SELECTED EVIDENCE</span><button aria-label="Close evidence" onClick={() => setSelectedEvidence(null)}>×</button></div><strong>{selectedEvidence.title}</strong><p>{selectedEvidence.snippet}</p><div className="evidence-note">{selectedEvidence.note}</div><a href={selectedEvidence.sourceUrl} target="_blank" rel="noreferrer">Open reference website ↗</a><small>Retrieved timestamp: not available in demo mode</small></div>}
                <div className="evidence-disclaimer"><span>ⓘ</span><p>Evidence is not fetched live yet. These cards are based on the project spec and are not a verified legal determination.</p></div>
              </div>

              <div className="panel next-panel">
                <div className="section-kicker">NEXT ACTION</div>
                <div className="next-icon">✓</div>
                <h3>{status === 'blocked' ? 'Resolve blockers' : status === 'submitted' ? 'Application ID received' : status === 'review' ? 'Review is ready' : 'Ready when you are'}</h3>
                <p>{status === 'blocked' ? 'Update the flagged fields and run validation again.' : status === 'submitted' ? 'The configured backend returned an application ID.' : status === 'review' ? 'Inspect the payload and explicitly authorize submission.' : 'Run the validation agent to start the workflow.'}</p>
                {applicationId && <div className="application-id"><small>APPLICATION ID</small><strong>{applicationId}</strong></div>}
                <button className="button button-outline full-button" onClick={() => status === 'review' ? setReviewOpen(true) : runValidation()}>{status === 'review' ? 'Open approval review' : status === 'submitted' ? 'Re-run validation' : 'Start validation'} <span className="button-arrow">→</span></button>
              </div>
            </aside>
          </section>

          <footer className="page-footer"><span>ROOFTOP SUBSIDY ASSISTANT <span className="footer-dot">•</span> FRONTEND PROTOTYPE</span><span>Built for transparent, human-approved workflows</span></footer>
        </div>
      </main>

      {reviewOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReviewOpen(false) }}>
        <section className="review-modal" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="modal-header"><div><div className="section-kicker">HUMAN-IN-THE-LOOP GATE</div><h2 id="review-title">Review before submission</h2><p>Compare the proposed payload and approve only when it is correct.</p></div><button className="modal-close" onClick={() => setReviewOpen(false)} aria-label="Close review">×</button></div>
          <div className="review-banner"><span>ⓘ</span><div><strong>Explicit approval required</strong><p>Authorizing sends the application payload to the configured backend endpoint. In demo mode, no submission can occur.</p></div></div>
          {warnings.length > 0 && <div className="modal-warning">{warnings.map((warning) => <p key={warning}>△ {warning}</p>)}</div>}
          <div className="diff-grid"><div className="diff-card"><div className="diff-title"><span>01</span> USER INPUT</div><dl><dt>Consumer number</dt><dd>{form.consumerNumber}</dd><dt>DISCOM</dt><dd>{form.discomCode}</dd><dt>Ownership</dt><dd>{form.ownership}</dd><dt>Planned capacity</dt><dd>{form.capacity} kW</dd><dt>Selected vendor</dt><dd>{chosenVendor.name}</dd></dl></div><div className="diff-card normalized"><div className="diff-title"><span>02</span> NORMALIZED PAYLOAD</div><dl><dt>Sanctioned load</dt><dd>{form.sanctionedLoad} kW</dd><dt>NOC flag</dt><dd>{form.nocAttached ? 'Attached' : 'Not attached / not required'}</dd><dt>Subsidy estimate</dt><dd className="green-text">{formatINR(subsidy)}</dd><dt>Net system cost</dt><dd>{formatINR(netCost)}</dd><dt>Estimated payback</dt><dd>{payback.toFixed(1)} years</dd></dl></div></div>
          <div className="modal-foot"><button className="button button-quiet" onClick={() => setReviewOpen(false)}>Reject / go back</button><button className="button button-primary" disabled={submitting || blockers.length > 0} onClick={authorizeSubmission}>{submitting ? 'Sending…' : 'Authorize & submit'} <span>→</span></button></div>
        </section>
      </div>}
    </div>
  )
}

export default App
