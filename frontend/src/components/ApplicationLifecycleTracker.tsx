import { useState } from 'react'
import type { TrackingRecord } from '../types/journey'

export default function ApplicationLifecycleTracker({ record, onAdvance, onReschedule }: {
  record: TrackingRecord; onAdvance: () => void; onReschedule: () => void
}) {
  const [copied, setCopied] = useState(false)
  async function copyId() {
    try { await navigator.clipboard.writeText(record.tracking_id); setCopied(true); window.setTimeout(() => setCopied(false), 1800) } catch { setCopied(false) }
  }
  function downloadDocket() {
    const printable = window.open('', '_blank')
    if (!printable) return
    const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
    printable.opener = null
    printable.document.write(`<title>GoSolar Submission Docket</title><style>body{font:16px Arial,sans-serif;max-width:760px;margin:40px auto;color:#183325}h1{color:#237344}.id{font-size:24px;font-weight:bold;padding:16px;background:#eff8f0}@media print{button{display:none}}</style><h1>GoSolar Submission Docket</h1><div class="id">${escape(record.tracking_id)}</div><p>${escape(record.application.applicant_name)} · ${escape(record.application.state)} · ${escape(record.application.consumer_number)}</p><p>System: ${record.application.system_size_kw} kW</p><p>Scheme: ${escape(record.application.subsidy.name)}</p><p>Vendor: ${escape(record.application.vendor.name)}</p><p>Submitted: ${escape(new Date(record.submitted_at).toLocaleString())}</p><p>This is a demo acknowledgment, not a government sanction.</p><p>Use your browser print dialog and choose “Save as PDF”.</p>`)
    printable.document.close(); printable.print()
  }
  return <section className="panel lifecycle-panel">
    <div className="tracking-banner"><div><small>APPLICATION TRACKING ID</small><strong>{record.tracking_id}</strong></div><button className="button button-outline" type="button" onClick={copyId}>{copied ? 'Copied' : 'Copy Tracking ID'}</button></div>
    <p className="journey-disclaimer">Demo application status · {record.status.replaceAll('_', ' ')} · Updated {new Date(record.updated_at).toLocaleString()}</p>
    <ol className="lifecycle-list">{record.milestones.map((step, index) => <li className={`lifecycle-step ${step.status}`} key={step.title}><span className="lifecycle-marker">{step.status === 'completed' ? '✓' : index + 1}</span><div><strong>{step.title}</strong><small>{step.timestamp ? new Date(step.timestamp).toLocaleString() : step.status === 'in_progress' ? 'In progress' : 'Pending'}</small></div></li>)}</ol>
    <div className="lifecycle-actions"><button type="button" className="button button-outline" onClick={downloadDocket}>Download Submission Docket</button><button type="button" className="button button-outline" onClick={onReschedule}>Reschedule Site Survey</button><button type="button" className="button button-primary" disabled={record.current_stage >= record.milestones.length - 1} onClick={onAdvance}>Simulate Next Stage</button></div>
    <details className="agent-log"><summary>Agent validation log ({record.agent_validation_logs.length})</summary>{record.agent_validation_logs.map((log, index) => <p key={`${log.timestamp}-${index}`}><strong>{log.stage.replaceAll('_', ' ')}</strong> · {log.message} <small>{new Date(log.timestamp).toLocaleString()}</small></p>)}</details>
  </section>
}
