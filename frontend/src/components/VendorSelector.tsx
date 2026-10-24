import type { SubsidyItem, VendorItem } from '../types/journey'

export default function VendorSelector({ vendors, selectedId, onSelect, capacityKw, subsidy }: {
  vendors: VendorItem[]; selectedId: string; onSelect: (id: string) => void; capacityKw: number; subsidy: SubsidyItem | undefined
}) {
  return <div className="vendor-cards" role="radiogroup" aria-label="Choose an installer">
    {vendors.map((vendor) => {
      const gross = Math.round(vendor.price_per_kw * capacityKw)
      const grant = subsidy?.estimated_subsidy_inr ?? 0
      return <button type="button" role="radio" aria-checked={selectedId === vendor.id} className={`vendor-card ${selectedId === vendor.id ? 'chosen' : ''}`} key={vendor.id} onClick={() => onSelect(vendor.id)}>
        <span className="journey-card-top"><strong>{vendor.name}</strong><span className="journey-provider">{vendor.tier}</span></span>
        <span className="vendor-rating">★ {vendor.rating} <small>{vendor.installs}</small></span>
        <span className="vendor-specs">{vendor.specs}</span>
        <span className="vendor-price">Gross ₹{gross.toLocaleString('en-IN')} − subsidy ₹{grant.toLocaleString('en-IN')} = <strong>₹{Math.max(gross - grant, 0).toLocaleString('en-IN')}</strong></span>
        <span className="journey-provider">Estimated turnaround: {vendor.turnaround_days} business days</span>
      </button>
    })}
  </div>
}
