import type { SubsidyItem } from '../types/journey'

export default function SubsidySelector({ items, selectedId, onSelect, capacityKw, consumerGroup }: {
  items: SubsidyItem[]; selectedId: string; onSelect: (id: string) => void; capacityKw: number; consumerGroup: string
}) {
  const eligible = items.filter((item) => item.kind === consumerGroup)
  const displayItems = eligible.length ? eligible : items.filter((item) => item.id === 'pm-surya-ghar')
  return <div className="journey-cards" role="radiogroup" aria-label="Choose a subsidy scheme">
    {displayItems.map((item) => <button type="button" role="radio" aria-checked={selectedId === item.id} className={`journey-card ${selectedId === item.id ? 'chosen' : ''}`} key={item.id} onClick={() => onSelect(item.id)}>
      <span className="journey-card-top"><strong>{item.name}</strong><span className="journey-provider">{item.provider}</span></span>
      <span className="journey-amount">₹{item.estimated_subsidy_inr.toLocaleString('en-IN')} <small>estimated</small></span>
      <span className="journey-net">Indicative net price varies by vendor and system size ({capacityKw.toFixed(1)} kW).</span>
      <span className="journey-tags">{item.eligibility.map((tag) => <i key={tag}>{tag}</i>)}</span>
      <span className="journey-perks">{item.perks.join(' · ')}</span>
      {item.illustrative && <span className="journey-disclaimer">Illustrative only; confirm current policy and eligibility with the relevant authority.</span>}
    </button>)}
  </div>
}
