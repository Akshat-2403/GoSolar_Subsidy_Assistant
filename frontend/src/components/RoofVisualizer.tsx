import './roofVisualizer.css'

type Props = { roofAreaSqft: number | ''; systemCapacityKw: number }

const PANEL_WATTS = 550
const PANEL_AREA_SQFT = 21

export default function RoofVisualizer({ roofAreaSqft, systemCapacityKw }: Props) {
  const area = Number(roofAreaSqft) || 0
  const moduleCount = systemCapacityKw > 0 ? Math.ceil(systemCapacityKw * 1000 / PANEL_WATTS) : 0
  const coveragePct = area > 0 ? Math.min(100, Math.round(moduleCount * PANEL_AREA_SQFT / area * 100)) : 0
  const columns = Math.min(6, Math.max(1, Math.ceil(Math.sqrt(moduleCount))))
  const tiles = Array.from({ length: Math.min(moduleCount, 48) }, (_, index) => {
    const col = index % columns
    const row = Math.floor(index / columns)
    const x = 88 + col * 39 + row * 12
    const y = 31 + row * 19 - col * 5
    return <polygon key={index} points={`${x},${y} ${x + 34},${y - 8} ${x + 34},${y + 1} ${x},${y + 10}`} className="roof-panel-tile" />
  })

  return <section className="roof-visualizer" aria-label="Solar panel rooftop layout preview">
    <div className="roof-visualizer-heading"><div><p className="guide-eyebrow">SITE FEASIBILITY</p><h3>Roof layout preview</h3><p>Indicative 550 W module placement with access clearance.</p></div><span className="roof-preview-badge">2D PREVIEW</span></div>
    <div className="roof-canvas">
      <svg viewBox="0 0 440 190" role="img" aria-label={`${moduleCount} solar panels arranged on an isometric roof preview`}>
        <polygon points="62,62 271,14 390,74 180,126" className="roof-shadow" />
        <polygon points="62,50 271,2 390,62 180,114" className="roof-surface" />
        <polygon points="78,54 270,10 365,58 174,103" className="roof-clearance" />
        {tiles}
        <path d="M62 50v15l118 61V114M180 114v12l210-52V62" className="roof-edge" />
        <text x="208" y="153" className="roof-svg-label">ACCESS & SHADOW CLEARANCE</text>
        <line x1="189" y1="144" x2="365" y2="104" className="roof-clearance-line" />
      </svg>
      {moduleCount === 0 && <div className="roof-empty-overlay">Enter roof area and system capacity to preview panel placement.</div>}
    </div>
    <div className="roof-stat-grid">
      <div><span>Solar modules</span><strong>{moduleCount || '--'}</strong><small>550 W each</small></div>
      <div><span>Roof coverage</span><strong>{area > 0 && moduleCount ? `${coveragePct}%` : '--'}</strong><small>{area ? `${Math.round(area * coveragePct / 100)} of ${area} sq. ft.` : 'Enter roof area'}</small></div>
      <div><span>Shadow buffer</span><strong>{moduleCount ? '20%' : '--'}</strong><small>Reserved for edges & access</small></div>
    </div>
    {moduleCount > 48 && <p className="roof-visualizer-note">Showing a representative layout of 48 modules; estimated total: {moduleCount} modules.</p>}
  </section>
}
