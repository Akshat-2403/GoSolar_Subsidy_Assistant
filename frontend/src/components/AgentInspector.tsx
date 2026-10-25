import { useState } from 'react'
import type { Evidence, EventItem, Workflow } from '../App'

type Props = {
  workflow: Workflow
  events: EventItem[]
}

function formatTimestamp(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? 'Timestamp unavailable' : parsed.toISOString()
}

export default function AgentInspector({ workflow, events }: Props) {
  const [open, setOpen] = useState(false)

  return <section className="panel embedded-panel agent-inspector" aria-label="Agent decision trace">
    <button className="agent-inspector-toggle" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
      <span><span className="section-kicker">TRANSPARENT EXECUTION TRACE</span><strong>Agentic decision engine &amp; tool logs</strong><small>Recorded workflow steps, actual inputs, outputs, and source evidence.</small></span>
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="agent-inspector-body">
      <div className="agent-hitl-note" role="status">
        <strong>{workflow.human_approval_required ? 'Human approval required' : 'No pending approval'}</strong>
        <span>{workflow.human_approval_required ? 'Review the proposed payload before opening the mock portal. No filing has happened yet.' : 'This trace does not indicate an action waiting for approval.'}</span>
      </div>
      <ol className="agent-trace-list">
        {events.map((event, index) => <li className="agent-trace-item" key={`${event.node}-${event.timestamp}-${index}`}>
          <div className="agent-trace-heading"><strong>{event.node.replaceAll('_', ' ')}</strong><span className={`agent-trace-status status-${event.status}`}>{event.status}</span></div>
          <p>{event.message}</p>
          <time dateTime={event.timestamp}>{formatTimestamp(event.timestamp)}</time>
        </li>)}
      </ol>
      <details className="agent-json-details">
        <summary>Application tool payload and evaluation output</summary>
        <pre>{JSON.stringify({ input: workflow.application_parameters, output: { state: workflow.state, issues: workflow.issues, missing_documents: workflow.missing_documents, financial_summary: workflow.financial_summary, policy_assessment: workflow.policy_assessment, application_id: workflow.application_id } }, null, 2)}</pre>
      </details>
      <div className="agent-citations">
        <h3>Policy citations and evidence</h3>
        {workflow.evidence_log.length === 0 && <p>No policy evidence was returned for this run.</p>}
        {workflow.evidence_log.map((item: Evidence, index) => <article key={`${item.evidence_id}-${index}`}>
          <strong>{item.source_title}</strong>
          <span>{item.rule_applied.replaceAll('_', ' ')} · {item.outcome} · checked {formatTimestamp(item.checked_at)}</span>
          <p>{item.verbatim_snippet || item.excerpt}</p>
          {item.source_url && <a href={item.source_url} target="_blank" rel="noreferrer">Open source</a>}
        </article>)}
      </div>
    </div>}
  </section>
}
