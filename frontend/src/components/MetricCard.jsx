const INDEX_CONFIG = {
  NDVI: { label: 'Vigor · Biomasa', accent: '#5B8A1A' },
  NDMI: { label: 'Humedad hídrica', accent: '#1A6FAA' },
  NDRE: { label: 'Clorofila · N', accent: '#A07A15' },
  SAVI: { label: 'Vigor corregido', accent: '#6B3FA8' },
}

function valueTextColor(v) {
  if (v == null) return '#8B9CB0'
  if (v >= 0.6) return '#3D6B0C'
  if (v >= 0.4) return '#7A5A08'
  return '#8C2415'
}

function SpectralBar({ value }) {
  const pct = value != null ? Math.max(0, Math.min(1, value)) * 100 : null
  const markerColor = value == null ? '#8B9CB0' : value >= 0.6 ? '#9EE832' : value >= 0.4 ? '#F5B83F' : '#E04F31'

  return (
    <div className="relative mt-3 mb-1">
      <div
        className="h-1.5 w-full rounded-full"
        style={{ background: 'linear-gradient(to right, #E04F31 0%, #F5B83F 40%, #9EE832 78%, #6AAD1A 100%)' }}
      />
      {pct != null && (
        <div
          className="absolute top-[-3px] h-[18px] w-[18px] rounded-full border-2 border-white shadow-md -translate-x-1/2 transition-all duration-300"
          style={{ left: `${pct}%`, backgroundColor: markerColor }}
        />
      )}
    </div>
  )
}

export default function MetricCard({ index, value }) {
  const cfg = INDEX_CONFIG[index] ?? { label: '', accent: '#8B9CB0' }
  const valColor = valueTextColor(value)

  return (
    <div className="bg-field rounded-2xl border border-[#E4DFD4] p-4 flex flex-col">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: cfg.accent }}>
          {index}
        </span>
        <span className="text-[11px] text-[#A8A09A] font-medium">{cfg.label}</span>
      </div>
      <span
        className="font-mono text-3xl font-medium leading-none mt-1"
        style={{ color: valColor, fontFamily: "'Fira Code', 'Courier New', monospace" }}
      >
        {value != null ? value.toFixed(2) : '—'}
      </span>
      <SpectralBar value={value} />
    </div>
  )
}
