import { useState, useEffect, lazy, Suspense } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { createParcel } from '../api/parcels'
import { listCollections } from '../api/collections'
import Spinner from '../components/Spinner'
import { areaStats, formatArea } from '../utils/geo'

const DrawMap = lazy(() => import('../components/DrawMap'))

const CROPS = [
  { value: 'cacao', label: 'Cacao' },
  { value: 'cafe', label: 'Café' },
  { value: 'banano', label: 'Banano' },
  { value: 'cana', label: 'Caña de azúcar' },
  { value: 'arroz', label: 'Arroz' },
  { value: 'maiz', label: 'Maíz' },
  { value: 'palma', label: 'Palma aceitera' },
  { value: 'soya', label: 'Soya' },
  { value: 'yuca', label: 'Yuca' },
  { value: 'otro', label: 'Otro' },
]

export default function NewParcelPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const prefillCollectionId = location.state?.collection_id ?? ''

  const [collections, setCollections] = useState([])
  const [geometry, setGeometry] = useState(null)
  const [form, setForm] = useState({
    name: '',
    collection_id: prefillCollectionId,
    crop_type: 'cacao',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const area = areaStats(geometry)

  useEffect(() => {
    listCollections()
      .then((d) => setCollections(d.collections ?? d ?? []))
      .catch(() => {})
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!geometry) { setError('Dibuja el polígono del lote en el mapa.'); return }
    if (!form.collection_id) { setError('Selecciona una finca.'); return }
    setSaving(true)
    setError('')
    try {
      await createParcel({ ...form, geometry, ...area })
      navigate(`/collections/${form.collection_id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="hero-dark px-6 py-8 lg:px-10">
        <div className="text-xs text-nir mb-2 flex items-center gap-1">
          <Link to="/collections" className="hover:text-white transition-colors">Fincas</Link>
          <span className="text-haze">›</span>
          <span className="text-white">Nuevo lote</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Nuevo lote</h1>
        <p className="text-nir text-sm mt-1">Dibuja el polígono de tu cultivo en el mapa satelital</p>
      </div>

      <div className="px-6 py-6 lg:px-10">
        {error && (
          <div className="mb-5 rounded-xl bg-[#FDE8E3] border border-[#F5A99A] px-4 py-3 text-sm text-[#8C2415]">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <form id="parcel-form" onSubmit={handleSubmit} className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-6 flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-[#6B6259] mb-1.5">Nombre del lote *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-[#D4C9B0] bg-soil px-4 py-2.5 text-sm text-orbit focus:border-[#9EE832] focus:ring-2 focus:ring-[#9EE832]/20 focus:outline-none transition-all"
                  placeholder="Lote Norte"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6259] mb-1.5">Finca *</label>
                {collections.length === 0 ? (
                  <div className="text-xs text-[#7A5A08] bg-[#FEF3D1] border border-[#F5D98A] rounded-xl px-4 py-3">
                    No tienes fincas.{' '}
                    <Link to="/collections" className="underline font-semibold">Crea una primero</Link>
                  </div>
                ) : (
                  <select
                    required
                    value={form.collection_id}
                    onChange={(e) => setForm({ ...form, collection_id: e.target.value })}
                    className="w-full rounded-xl border border-[#D4C9B0] bg-soil px-4 py-2.5 text-sm text-orbit focus:border-[#9EE832] focus:outline-none transition-all"
                  >
                    <option value="">Seleccionar finca...</option>
                    {collections.map((c) => (
                      <option key={c.collection_id} value={c.collection_id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6259] mb-1.5">Tipo de cultivo</label>
                <select
                  value={form.crop_type}
                  onChange={(e) => setForm({ ...form, crop_type: e.target.value })}
                  className="w-full rounded-xl border border-[#D4C9B0] bg-soil px-4 py-2.5 text-sm text-orbit focus:border-[#9EE832] focus:outline-none transition-all"
                >
                  {CROPS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#6B6259] mb-1.5">Notas</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl border border-[#D4C9B0] bg-soil px-4 py-2.5 text-sm text-orbit focus:border-[#9EE832] focus:outline-none resize-none transition-all"
                  placeholder="Observaciones, condiciones del suelo..."
                />
              </div>

              <div className={`rounded-xl px-4 py-3 text-sm font-medium flex items-center gap-2 ${
                geometry
                  ? 'bg-[#E8F7D4] border border-[#C5E89A] text-[#3D6B0C]'
                  : 'bg-soil border border-[#D4C9B0] text-[#6B6259]'
              }`}>
                <span>{geometry ? '✓' : '○'}</span>
                {geometry ? 'Polígono dibujado correctamente' : 'Dibuja el polígono en el mapa →'}
              </div>

              {area && (
                <div className="rounded-xl bg-[#F4FAEA] border border-[#C5E89A] px-4 py-3">
                  <p className="text-[11px] font-bold text-[#5B8A1A] uppercase tracking-widest">Área estimada</p>
                  <p className="text-2xl font-bold text-orbit mt-1">{formatArea(area.area_ha, area.area_m2)}</p>
                  <p className="text-xs text-[#6B6259] mt-1">
                    Calculada desde el polígono dibujado. Úsala como referencia para riego y fertilización.
                  </p>
                </div>
              )}
            </form>

            <button
              type="submit"
              form="parcel-form"
              disabled={saving || !geometry}
              className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold py-3 text-sm transition-all disabled:opacity-50 hover:brightness-105"
              style={{ background: '#9EE832', color: '#080C10' }}
            >
              {saving ? <><Spinner size="sm" /> Guardando...</> : 'Guardar lote'}
            </button>
          </div>

          {/* Map */}
          <div className="lg:col-span-3">
            <div className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-4 h-full">
              <Suspense fallback={<div className="h-120 flex items-center justify-center"><Spinner size="lg" /></div>}>
                <DrawMap onGeometryChange={setGeometry} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
