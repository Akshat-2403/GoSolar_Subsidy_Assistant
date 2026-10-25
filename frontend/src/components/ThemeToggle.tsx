import './themeToggle.css'

export type ThemeMode = 'light' | 'dark'

export default function ThemeToggle({ mode, onChange }: { mode: ThemeMode; onChange: (mode: ThemeMode) => void }) {
  const dark = mode === 'dark'
  return <button className={`theme-toggle ${dark ? 'is-dark' : ''}`} type="button" aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`} aria-pressed={dark} onClick={() => onChange(dark ? 'light' : 'dark')}>
    <svg className="solar-scene" viewBox="0 0 88 38" role="img" aria-hidden="true">
      <rect className="sky" x="1" y="1" width="86" height="36" rx="18" />
      <g className="sun"><circle cx="60" cy="13" r="6" /><path d="M60 3v-2M60 25v-2M50 13h-2M72 13h-2M53 6l-2-2M69 22l-2-2M67 6l2-2M51 22l2-2" /></g>
      <g className="cloud"><circle cx="59" cy="17" r="6" /><circle cx="67" cy="18" r="5" /><rect x="56" y="17" width="19" height="7" rx="3.5" /></g>
      <g className="panel"><path d="M8 22h34l4 10H5z" /><path d="M14 23l-2 8m10-8-1 8m10-8 1 8m8-8 3 8M9 27h34" /><path d="M25 32v3m-8 0h16" /></g>
    </svg>
    <span className="theme-toggle-label">{dark ? 'Dark' : 'Light'}</span>
  </button>
}
