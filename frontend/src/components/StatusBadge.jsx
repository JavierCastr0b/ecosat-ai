const CONFIG = {
  bueno:      'bg-[#E8F7D4] text-[#3D6B0C] border border-[#C5E89A]',
  moderado:   'bg-[#FEF3D1] text-[#7A5A08] border border-[#F5D98A]',
  bajo:       'bg-[#FEEADF] text-[#873215] border border-[#F5B39A]',
  crítico:    'bg-[#FDE8E3] text-[#8C2415] border border-[#F5A99A]',
  critico:    'bg-[#FDE8E3] text-[#8C2415] border border-[#F5A99A]',
  alta:       'bg-[#FDE8E3] text-[#8C2415] border border-[#F5A99A]',
  media:      'bg-[#FEF3D1] text-[#7A5A08] border border-[#F5D98A]',
  baja:       'bg-[#E8F7D4] text-[#3D6B0C] border border-[#C5E89A]',
  COMPLETED:  'bg-[#E8F7D4] text-[#3D6B0C] border border-[#C5E89A]',
  PROCESSING: 'bg-[#DFF0FF] text-[#1057A0] border border-[#A8D4F5]',
  PENDING:    'bg-[#F0EDE8] text-[#6B6259] border border-[#D4C9B0]',
  FAILED:     'bg-[#FDE8E3] text-[#8C2415] border border-[#F5A99A]',
}

const LABEL = {
  bueno: 'Bueno', moderado: 'Moderado', bajo: 'Bajo',
  crítico: 'Crítico', critico: 'Crítico',
  alta: 'Alta', media: 'Media', baja: 'Baja',
  COMPLETED: 'Completado', PROCESSING: 'Procesando',
  PENDING: 'Pendiente', FAILED: 'Error',
}

export default function StatusBadge({ value, className = '' }) {
  if (!value) return null
  const key = String(value).toLowerCase()
  const colors = CONFIG[key] ?? CONFIG[value] ?? 'bg-[#F0EDE8] text-[#6B6259] border border-[#D4C9B0]'
  const label = LABEL[key] ?? LABEL[value] ?? value
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors} ${className}`}>
      {label}
    </span>
  )
}
