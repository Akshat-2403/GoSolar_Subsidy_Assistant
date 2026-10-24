import { useState } from 'react'
import './components.css'

export type UploadedDocuments = Record<string, { name: string; size: number } | null>
const slots = [
  { id: 'bill', title: 'Electricity Bill', required: true, accept: '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg' },
  { id: 'ownership', title: 'Rooftop Ownership / Tax Receipt', required: false, accept: '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg' },
  { id: 'governmentId', title: 'Government ID', required: false, accept: '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg' },
]

export default function DocumentUploads({ value, onChange }: { value: UploadedDocuments; onChange: (value: UploadedDocuments) => void }) {
  const [dragTarget, setDragTarget] = useState<string | null>(null)
  function select(id: string, file?: File) {
    if (file) onChange({ ...value, [id]: { name: file.name, size: file.size } })
  }
  return <section className="document-uploads" aria-label="Documents required">
    <h3>Documents Required</h3>
    <p>Upload available documents to keep them with this assessment. PDF, PNG or JPG files are accepted.</p>
    <div className="document-upload-grid">{slots.map((slot) => {
      const file = value[slot.id]
      return <label key={slot.id} className={`document-upload ${dragTarget === slot.id ? 'document-upload-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragTarget(slot.id) }} onDragLeave={() => setDragTarget(null)} onDrop={(event) => { event.preventDefault(); setDragTarget(null); select(slot.id, event.dataTransfer.files[0]) }}>
        <input type="file" accept={slot.accept} onChange={(event) => { select(slot.id, event.target.files?.[0]); event.currentTarget.value = '' }} />
        <strong>{slot.title} {slot.required && <em>Required</em>}</strong>
        {file ? <><span className="document-upload-filename">{file.name}</span><small>{(file.size / 1024).toFixed(1)} KB · Uploaded</small><b className="document-upload-badge">Uploaded</b></> : <><span>Drop a file here or browse</span><small>{slot.required ? 'Required to continue' : 'Optional'}</small></>}
      </label>
    })}</div>
  </section>
}
