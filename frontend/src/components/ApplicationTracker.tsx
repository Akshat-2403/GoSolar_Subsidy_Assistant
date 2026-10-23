import { useState, type FormEvent } from 'react'
import './applicationTracker.css'

const milestones = [
  { title: 'Application submitted & verified', detail: 'Application details received and format checks completed.' },
  { title: 'DISCOM technical sanction & feasibility', detail: 'Utility review of connection capacity and technical feasibility.' },
  { title: 'Vendor site inspection & installation', detail: 'Site survey and rooftop system installation.' },
  { title: 'Bi-directional net meter commissioning', detail: 'Meter installation and grid synchronization.' },
  { title: 'DBT subsidy credit to bank account', detail: 'Subsidy disbursement after required commissioning steps.' },
]

export default function ApplicationTracker() {
  const [reference, setReference] = useState('')
  const [trackedReference, setTrackedReference] = useState('')
  const [message, setMessage] = useState('')

  function track(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = reference.trim().toUpperCase()
    if (!id) { setMessage('Enter a consumer number or application reference to view the demo timeline.'); setTrackedReference(''); return }
    setTrackedReference(id)
    setMessage('')
  }

  function tryDemo() {
    const demoId = 'GS-2026-04281'
    setReference(demoId)
    setTrackedReference(demoId)
    setMessage('')
  }

  return <section className="application-tracker panel" aria-labelledby="tracker-title">
    <div className="tracker-heading"><div><p className="guide-eyebrow">APPLICATION STATUS</p><h1 id="tracker-title">Track your solar application</h1><p>View an illustrative milestone timeline for a consumer or application reference.</p></div><span className="tracker-demo-badge">SIMULATED TRACKER</span></div>
    <form className="tracker-search" onSubmit={track}>
      <label className="field"><span>Consumer number or application reference</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="e.g. GS-2026-04281" aria-describedby="tracker-hint" /></label>
      <div className="tracker-search-actions"><button className="button button-primary" type="submit">Track application</button><button className="button button-quiet" type="button" onClick={tryDemo}>Try Demo Tracking ID</button></div>
      <small id="tracker-hint" className="tracker-hint">Demo only: this preview does not query a live DISCOM status system.</small>
      {message && <p className="tracker-error" role="alert">{message}</p>}
    </form>
    {trackedReference && <div className="tracker-results" aria-live="polite">
      <div className="tracker-result-heading"><div><span className="guide-eyebrow">TRACKING REFERENCE</span><strong>{trackedReference}</strong></div><span className="tracker-current-status"><i />Technical feasibility in progress</span></div>
      <ol className="tracker-timeline">
        {milestones.map((milestone, index) => {
          const status = index === 0 ? 'completed' : index === 1 ? 'in-progress' : 'pending'
          const stateLabel = status === 'completed' ? 'DONE' : status === 'in-progress' ? 'IN PROGRESS' : 'PENDING'
          return <li className={`tracker-milestone tracker-${status}`} key={milestone.title}>
            <div className="tracker-rail"><span className="tracker-marker">{status === 'completed' ? '✓' : index + 1}</span>{index < milestones.length - 1 && <span className="tracker-connector" />}</div>
            <div className="tracker-milestone-copy"><strong>{milestone.title}</strong><p>{milestone.detail}</p></div>
            <span className="tracker-milestone-status">{stateLabel}</span>
          </li>
        })}
      </ol>
      <p className="tracker-disclaimer">All milestones and statuses shown are simulated for product demonstration. Check with your DISCOM for official application updates.</p>
    </div>}
  </section>
}
