import { useEffect } from 'react'
import './components.css'

type Props = { open: boolean; onClose: () => void }

export default function SubsidyGuideModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null
  return <div className="guide-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="guide-modal" role="dialog" aria-modal="true" aria-labelledby="subsidy-guide-title">
      <header className="guide-modal-header">
        <div><p className="guide-eyebrow">SOLAR, SIMPLIFIED</p><h2 id="subsidy-guide-title">Your rooftop solar guide</h2></div>
        <button type="button" className="guide-close" onClick={onClose} aria-label="Close guide">×</button>
      </header>
      <div className="guide-content">
        <section aria-labelledby="scheme-title">
          <h3 id="scheme-title">PM Surya Ghar subsidy</h3>
          <p>For eligible residential rooftop systems, the central financial assistance is calculated by capacity:</p>
          <ul className="guide-slabs">
            <li><strong>First 2 kW</strong><span>₹30,000 per kW, up to ₹60,000</span></li>
            <li><strong>Third kW</strong><span>₹18,000 for the additional 1 kW</span></li>
            <li><strong>Above 3 kW</strong><span>Total central subsidy is capped at ₹78,000</span></li>
          </ul>
          <p className="guide-note">This is an estimate for guidance. Actual eligibility and disbursement depend on current scheme rules and verification.</p>
        </section>
        <section aria-labelledby="metering-title">
          <h3 id="metering-title">Net metering and gross metering</h3>
          <p><strong>Net metering:</strong> Solar energy used at home offsets imported electricity; eligible surplus is exported and credited against consumption under your DISCOM’s rules.</p>
          <p><strong>Gross metering:</strong> Solar generation is measured and exported to the grid, while household electricity use is billed separately. Export rates and availability depend on local policy.</p>
        </section>
        <section aria-labelledby="documents-title">
          <h3 id="documents-title">Documents to keep ready</h3>
          <ul className="guide-checklist"><li>Recent electricity bill</li><li>Aadhaar and applicant identity details</li><li>Roof ownership proof or landlord NOC, where applicable</li></ul>
        </section>
      </div>
      <footer className="guide-modal-footer"><button type="button" className="button button-primary" onClick={onClose}>Got it</button></footer>
    </section>
  </div>
}
