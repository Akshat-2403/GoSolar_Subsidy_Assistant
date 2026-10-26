import { useEffect, useState } from 'react'
import './benchmarkDrawer.css'

type Case = { id: string; description: string }
type Result = { case_id: string; passed: boolean; actual: string; expected: string; synthetic: boolean }
const API_URL = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

export default function BenchmarkDrawer() {
  const [open, setOpen] = useState(false)
  const [cases, setCases] = useState<Case[]>([])
  const [results, setResults] = useState<Record<string, Result>>({})
  const [running, setRunning] = useState<string | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    void fetch(`${API_URL}/api/benchmark/status`).then(async (response) => {
      if (!response.ok) throw new Error('Benchmark API is unavailable. Start the GoSolar backend to run these checks.')
      const data = await response.json() as { cases: Case[] }
      setCases(data.cases)
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Could not load benchmark cases.'))
  }, [open])
  async function run(caseId: string) {
    setRunning(caseId); setError('')
    try {
      const response = await fetch(`${API_URL}/api/benchmark/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ case_id: caseId }) })
      if (!response.ok) throw new Error(`Benchmark ${caseId} could not run (${response.status}).`)
      const result = await response.json() as Result
      setResults((current) => ({ ...current, [caseId]: result }))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Benchmark run failed.') }
    finally { setRunning(null) }
  }
  return <>
    <button className="button button-quiet benchmark-audit-launch" type="button" onClick={() => setOpen(true)}>⚡ Run Architecture Audit &amp; Benchmarks</button>
    {open && <div className="audit-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}><section className="audit-modal" role="dialog" aria-modal="true" aria-labelledby="audit-title"><header><div><span className="section-kicker">SYSTEM CHECK</span><h2 id="audit-title">AI evaluator &amp; benchmark audit</h2><p>Run deterministic synthetic cases against the local workflow API.</p></div><button type="button" className="icon-button" aria-label="Close audit" onClick={() => setOpen(false)}>×</button></header>
      <div className="audit-agents"><span>Supervisor</span><span>Grid feasibility</span><span>Subsidy optimizer</span><span>Policy compliance</span><span>Portal submission · human gated</span></div>
      {error && <p className="audit-error" role="alert">{error}</p>}
      <div className="audit-cases">{cases.map((item) => { const result = results[item.id]; return <article key={item.id}><div><strong>{item.id}</strong><p>{item.description}</p>{result && <small>Expected: {result.expected} · Actual: {result.actual}{result.synthetic ? ' · synthetic' : ''}</small>}</div><button className="button button-outline" disabled={running !== null} onClick={() => void run(item.id)}>{running === item.id ? 'Running…' : result ? 'Run again' : 'Run'}</button><b className={result?.passed ? 'audit-pass' : result ? 'audit-fail' : ''}>{result ? result.passed ? 'PASS' : 'FAIL' : 'READY'}</b></article> })}</div>
      <footer><a href={`${API_URL}/docs`} target="_blank" rel="noreferrer">API docs</a><a href="/VERIFICATION_EVIDENCE.md" target="_blank" rel="noreferrer">Verification evidence</a><span>All cases use synthetic data; TC4 remains pending official DISCOM capacity study.</span></footer>
    </section></div>}
  </>
}
