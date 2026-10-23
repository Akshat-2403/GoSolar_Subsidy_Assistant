import { useRef, useState } from 'react'
import { parseBill, type BillExtraction } from '../utils/billParser'
import './components.css'

type Props = { endpoint: string; onExtracted: (data: BillExtraction) => void }

export default function BillUpload({ endpoint, onExtracted }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [scanning, setScanning] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<BillExtraction | null>(null)
  const [error, setError] = useState('')

  async function processFile(file?: File) {
    if (!file) return
    setError(''); setResult(null); setScanning(true)
    try {
      const extraction = await parseBill(file, endpoint)
      onExtracted(extraction)
      setResult(extraction)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not read this bill file.')
    } finally { setScanning(false) }
  }

  return <section className="bill-upload-section" aria-label="Optional electricity bill upload">
    <input ref={inputRef} className="bill-file-input" type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" onChange={(event) => { void processFile(event.target.files?.[0]); event.target.value = '' }} />
    <button type="button" className={`bill-dropzone ${dragging ? 'bill-dropzone-active' : ''}`} onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void processFile(event.dataTransfer.files[0]) }} aria-label="Upload latest electricity bill">
      <span className="bill-upload-icon">{scanning ? <span className="bill-spinner" /> : '⇧'}</span>
      <span className="bill-upload-copy"><strong>{scanning ? 'Scanning your bill…' : 'Have your latest bill? Upload to auto-fill details.'}</strong><small>PDF, PNG or JPG · up to 15 MB · optional</small></span>
      <span className="button button-quiet bill-upload-cta">Choose file</span>
    </button>
    {scanning && <div className="bill-scan-progress" role="status">Checking the optional OCR service. If it is offline, sample preview values will be offered.</div>}
    {result && <p className={`bill-extraction-badge ${result.source === 'sample' ? 'bill-extraction-sample' : ''}`} role="status"><strong>{result.source === 'backend' ? 'Auto-filled from bill' : 'Sample extraction'}</strong><span>{result.message}</span></p>}
    {error && <p className="bill-upload-error" role="alert">{error}</p>}
  </section>
}
