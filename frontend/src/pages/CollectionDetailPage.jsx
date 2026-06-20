import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { listCollections } from '../api/collections'
import { listParcels, getParcelSummary } from '../api/parcels'
import { submitAnalysis, getAnalysisStatus } from '../api/analysis'
import { usePolling } from '../hooks/usePolling'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import ParcelThumbnail from '../components/ParcelThumbnail'
import { formatArea, parcelArea } from '../utils/geo'

const CROP_LABELS = {
  cacao: 'Cacao', cafe: 'Café', banano: 'Banano', cana: 'Caña de azúcar',
  arroz: 'Arroz', maiz: 'Maíz', palma: 'Palma aceitera', soya: 'Soya',
  yuca: 'Yuca', otro: 'Otro',
}

function ndviColor(v) {
  if (v == null) return '#8B9CB0'
  if (v >= 0.6) return '#3D6B0C'
  if (v >= 0.4) return '#7A5A08'
  return '#8C2415'
}

export default function CollectionDetailPage() {
  const { id } = useParams()
  const [collection, setCollection] = useState(null)
  const [parcels, setParcels] = useState([])
  const [summaries, setSummaries] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [analysisForm, setAnalysisForm] = useState({
    date_start: '2025-01-01',
    date_end: '2025-06-01',
    indices: ['NDVI', 'NDMI', 'NDRE', 'SAVI'],
  })
  const [submitting, setSubmitting] = useState(false)
  const [activeAnalysis, setActiveAnalysis] = useState(null)
  const rankings = useMemo(() => {
    const rows = parcels
      .map((parcel) => ({ parcel, latest: summaries[parcel.parcel_id]?.latest }))
      .filter((row) => row.latest)

    const priorityScore = { alta: 3, media: 2, baja: 1 }
    return {
      priority: [...rows]
        .sort((a, b) => (priorityScore[b.latest.prioridad] ?? 0) - (priorityScore[a.latest.prioridad] ?? 0))
        .slice(0, 3),
      water: [...rows]
        .sort((a, b) => (a.latest.metrics?.NDMI ?? 999) - (b.latest.metrics?.NDMI ?? 999))
        .slice(0, 3),
      vigor: [...rows]
        .sort((a, b) => (b.latest.metrics?.NDVI ?? -999) - (a.latest.metrics?.NDVI ?? -999))
        .slice(0, 3),
      nutrition: [...rows]
        .sort((a, b) => (a.latest.metrics?.NDRE ?? 999) - (b.latest.metrics?.NDRE ?? 999))
        .slice(0, 3),
    }
  }, [parcels, summaries])

  useEffect(() => {
    async function load() {
      try {
        const [colData, parcelData] = await Promise.all([listCollections(), listParcels()])
        const cols = colData.collections ?? colData ?? []
        setCollection(cols.find((c) => c.collection_id === id) ?? null)
        const all = parcelData.parcels ?? parcelData ?? []
        const mine = all.filter((p) => p.collection_id === id)
        setParcels(mine)
        const summs = {}
        await Promise.allSettled(mine.map(async (p) => {
          try { summs[p.parcel_id] = await getParcelSummary(p.parcel_id) } catch (_) {}
        }))
        setSummaries(summs)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const pollAnalysis = useCallback(async () => {
    if (!activeAnalysis?.analysis_id) return
    try {
      const data = await getAnalysisStatus(activeAnalysis.analysis_id)
      setActiveAnalysis((prev) => ({ ...prev, ...data }))
      if (data.status === 'COMPLETED' || data.status === 'FAILED') {
        const summs = {}
        await Promise.allSettled(parcels.map(async (p) => {
          try { summs[p.parcel_id] = await getParcelSummary(p.parcel_id) } catch (_) {}
        }))
        setSummaries(summs)
      }
    } catch (_) {}
  }, [activeAnalysis?.analysis_id, parcels])

  usePolling(pollAnalysis, 4000, activeAnalysis && !['COMPLETED', 'FAILED'].includes(activeAnalysis.status))

  function toggleIndex(idx) {
    setAnalysisForm((prev) => ({
      ...prev,
      indices: prev.indices.includes(idx) ? prev.indices.filter((i) => i !== idx) : [...prev.indices, idx],
    }))
  }

  async function handleSubmitAnalysis(e) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const data = await submitAnalysis({
        collection_id: id,
        date_start: analysisForm.date_start,
        date_end: analysisForm.date_end,
        indices: analysisForm.indices,
      })
      setActiveAnalysis({ analysis_id: data.analysis_id, status: 'PROCESSING', total_parcelas: data.total_parcelas })
      setShowAnalysis(false)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="hero-dark px-6 py-8 lg:px-10">
        <div className="text-xs text-nir mb-2 flex items-center gap-1">
          <Link to="/collections" className="hover:text-white transition-colors">Fincas</Link>
          <span className="text-haze">›</span>
          <span className="text-white">{collection?.name ?? id}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{collection?.name}</h1>
            {collection?.description && (
              <p className="text-nir text-sm mt-1">{collection.description}</p>
            )}
            <p className="text-xs text-haze mt-1">{parcels.length} lote{parcels.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link
              to="/parcels/new"
              state={{ collection_id: id }}
              className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/8 hover:bg-white/15 text-white text-sm font-medium px-4 py-2.5 transition-colors"
            >
              + Lote
            </Link>
            <button
              onClick={() => setShowAnalysis(!showAnalysis)}
              className="flex items-center gap-2 rounded-xl font-semibold text-sm px-4 py-2.5 transition-all hover:brightness-105"
              style={{ background: '#9EE832', color: '#080C10' }}
            >
              Lanzar análisis
            </button>
          </div>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-10">
        {error && <div className="mb-5 rounded-xl bg-[#FDE8E3] border border-[#F5A99A] px-4 py-3 text-sm text-[#8C2415]">{error}</div>}

        {/* Analysis status banner */}
        {activeAnalysis && (
          <div className={`mb-5 rounded-2xl border p-4 flex items-center gap-4 ${
            activeAnalysis.status === 'COMPLETED' ? 'bg-[#E8F7D4] border-[#C5E89A]' :
            activeAnalysis.status === 'FAILED' ? 'bg-[#FDE8E3] border-[#F5A99A]' :
            'bg-[#DFF0FF] border-[#A8D4F5]'
          }`}>
            {!['COMPLETED', 'FAILED'].includes(activeAnalysis.status) && <Spinner size="sm" />}
            <div className="flex-1">
              <p className="text-sm font-semibold text-orbit">
                {activeAnalysis.status === 'COMPLETED' ? 'Análisis completado' :
                 activeAnalysis.status === 'FAILED' ? 'El análisis falló' :
                 'Análisis en progreso...'}
              </p>
              <p className="text-xs text-[#6B6259] mt-0.5">
                {activeAnalysis.total_parcelas} lote{activeAnalysis.total_parcelas !== 1 ? 's' : ''} · ID: {activeAnalysis.analysis_id?.slice(0, 8)}...
              </p>
            </div>
            {['COMPLETED', 'FAILED'].includes(activeAnalysis.status) && (
              <button onClick={() => setActiveAnalysis(null)} className="text-[#A8A09A] hover:text-orbit transition-colors">✕</button>
            )}
          </div>
        )}

        {Object.values(rankings).some((items) => items.length > 0) && (
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { title: 'Prioridad de atención', items: rankings.priority, value: (row) => row.latest.prioridad },
              { title: 'Mayor estrés hídrico', items: rankings.water, value: (row) => row.latest.metrics?.NDMI?.toFixed(2) },
              { title: 'Mejor vigor', items: rankings.vigor, value: (row) => row.latest.metrics?.NDVI?.toFixed(2) },
              { title: 'Nutrición más baja', items: rankings.nutrition, value: (row) => row.latest.metrics?.NDRE?.toFixed(2) },
            ].map((block) => (
              <div key={block.title} className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-4">
                <p className="text-[11px] font-bold text-[#A8A09A] uppercase tracking-widest mb-3">{block.title}</p>
                <div className="space-y-2">
                  {block.items.map((row) => (
                    <Link key={row.parcel.parcel_id} to={`/parcels/${row.parcel.parcel_id}`} className="flex items-center justify-between gap-3 rounded-xl bg-soil px-3 py-2 hover:bg-[#E8F7D4] transition-colors">
                      <span className="min-w-0 truncate text-sm font-semibold text-orbit">{row.parcel.name}</span>
                      <span className="shrink-0 text-xs font-bold text-[#3D6B0C]">{block.value(row) ?? '—'}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Analysis form */}
        {showAnalysis && (
          <form onSubmit={handleSubmitAnalysis} className="mb-6 bg-field rounded-2xl border border-[#C5E89A] shadow-sm p-6">
            <h2 className="font-bold text-orbit mb-4">Configurar análisis satelital</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-[#6B6259] mb-1.5">Fecha inicio</label>
                <input type="date" value={analysisForm.date_start}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, date_start: e.target.value })}
                  className="w-full rounded-xl border border-[#D4C9B0] bg-soil px-4 py-2.5 text-sm text-orbit focus:border-[#9EE832] focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6259] mb-1.5">Fecha fin</label>
                <input type="date" value={analysisForm.date_end}
                  onChange={(e) => setAnalysisForm({ ...analysisForm, date_end: e.target.value })}
                  className="w-full rounded-xl border border-[#D4C9B0] bg-soil px-4 py-2.5 text-sm text-orbit focus:border-[#9EE832] focus:outline-none transition-all" />
              </div>
            </div>
            <div className="mb-5">
              <label className="block text-sm font-medium text-[#6B6259] mb-2">Índices espectrales</label>
              <div className="flex flex-wrap gap-2">
                {['NDVI', 'NDMI', 'NDRE', 'SAVI'].map((idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleIndex(idx)}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-all ${
                      analysisForm.indices.includes(idx)
                        ? 'border-[#9EE832] text-orbit'
                        : 'bg-field text-[#6B6259] border-[#D4C9B0] hover:border-[#9EE832]'
                    }`}
                    style={analysisForm.indices.includes(idx) ? { background: '#9EE832' } : {}}
                  >
                    {idx}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAnalysis(false)}
                className="rounded-xl border border-[#D4C9B0] bg-field text-[#6B6259] hover:text-orbit text-sm px-4 py-2 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={submitting || analysisForm.indices.length === 0}
                className="flex items-center gap-2 rounded-xl font-semibold text-sm px-5 py-2 transition-all disabled:opacity-60 hover:brightness-105"
                style={{ background: '#9EE832', color: '#080C10' }}>
                {submitting ? <><Spinner size="sm" /> Enviando...</> : 'Iniciar análisis'}
              </button>
            </div>
          </form>
        )}

        {/* Parcels grid */}
        {parcels.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#D4C9B0] bg-field p-12 text-center">
            <h2 className="text-xl font-bold text-orbit">Sin lotes en esta finca</h2>
            <p className="text-sm text-[#6B6259] mt-2 mb-6">Agrega lotes para poder lanzar análisis satelitales</p>
            <Link
              to="/parcels/new"
              state={{ collection_id: id }}
              className="inline-flex items-center gap-2 rounded-xl font-semibold text-sm px-6 py-2.5 transition-all hover:brightness-105"
              style={{ background: '#9EE832', color: '#080C10' }}
            >
              + Nuevo lote
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {parcels.map((p) => {
              const s = summaries[p.parcel_id]
              const latest = s?.latest
              const area = parcelArea(p)
              return (
                <Link
                  key={p.parcel_id}
                  to={`/parcels/${p.parcel_id}`}
                  className="group bg-field rounded-2xl border border-[#E4DFD4] shadow-sm hover:shadow-md hover:border-[#C5E89A] transition-all overflow-hidden"
                >
                  <ParcelThumbnail geometry={p.geometry} className="h-28 w-full" />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-bold text-orbit group-hover:text-[#3D6B0C] transition-colors text-sm leading-tight">{p.name}</p>
                      {latest?.prioridad && <StatusBadge value={latest.prioridad} />}
                    </div>
                    <p className="text-xs text-[#A8A09A] mb-3">
                      {CROP_LABELS[p.crop_type] ?? p.crop_type}
                      {area && <span className="ml-1">· {formatArea(area.area_ha, area.area_m2)}</span>}
                    </p>

                    {latest?.estado_cultivo && (
                      <div className="mb-3">
                        <StatusBadge value={latest.estado_cultivo} />
                      </div>
                    )}

                    {latest?.metrics ? (
                      <div className="grid grid-cols-2 gap-1.5">
                        {['NDVI', 'NDMI', 'NDRE', 'SAVI'].map((idx) => (
                          latest.metrics[idx] != null && (
                            <div key={idx} className="bg-soil rounded-lg px-2 py-1 flex items-center justify-between">
                              <span className="text-xs text-[#A8A09A]">{idx}</span>
                              <span className="text-xs font-bold font-mono" style={{ color: ndviColor(latest.metrics[idx]), fontFamily: "'Fira Code', monospace" }}>
                                {latest.metrics[idx].toFixed(2)}
                              </span>
                            </div>
                          )
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#A8A09A] italic bg-soil rounded-lg px-3 py-2">Sin análisis aún</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
