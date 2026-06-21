import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getParcel, getParcelSummary, listParcelAnalyses, deleteParcel, deleteParcelAnalysis } from '../api/parcels'
import { listCollections } from '../api/collections'
import ParcelMap from '../components/ParcelMap'
import MetricCard from '../components/MetricCard'
import IndexChart from '../components/IndexChart'
import StatusBadge from '../components/StatusBadge'
import Spinner from '../components/Spinner'
import { formatArea, parcelArea } from '../utils/geo'
import { openReportPdf } from '../utils/report'

const CROP_LABELS = {
  cacao: 'Cacao', cafe: 'Café', banano: 'Banano', cana: 'Caña de azúcar',
  arroz: 'Arroz', maiz: 'Maíz', palma: 'Palma aceitera', soya: 'Soya',
  yuca: 'Yuca', otro: 'Otro',
}

function formatPeriod(start, end) {
  const opts = { month: 'short', year: 'numeric', timeZone: 'UTC' }
  const format = (value) => {
    if (!value) return '-'
    const date = new Date(`${value}T00:00:00Z`)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('es-PE', opts).format(date).replace('.', '')
  }
  return `${format(start)} – ${format(end)}`
}

export default function ParcelDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [parcel, setParcel] = useState(null)
  const [summary, setSummary] = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [collection, setCollection] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedReportId, setSelectedReportId] = useState(null)
  const [deletingAnalysisId, setDeletingAnalysisId] = useState(null)

  async function loadParcelData({ keepLoading = false } = {}) {
    if (!keepLoading) setLoading(true)
    try {
      const [parcelData, sumData, analData] = await Promise.all([
        getParcel(id),
        getParcelSummary(id),
        listParcelAnalyses(id, true, 12),
      ])
      setParcel(parcelData)
      setSummary(sumData)
      setAnalyses(analData.analyses ?? analData ?? [])

      const collectionId = parcelData?.collection_id ?? sumData?.parcel?.collection_id
      if (collectionId) {
        const colData = await listCollections()
        const cols = colData.collections ?? colData ?? []
        setCollection(cols.find((c) => c.collection_id === collectionId) ?? null)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadParcelData()
  }, [id])

  async function handleDelete() {
    if (!confirm(`¿Eliminar el lote "${parcel?.name}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteParcel(id)
      navigate(collection ? `/collections/${collection.collection_id}` : '/collections')
    } catch (e) {
      setError(e.message)
    }
  }

  async function handleDeleteAnalysis(report) {
    if (!report?.analysis_record_id) return
    if (!confirm(`¿Eliminar el análisis de ${formatPeriod(report.date_start, report.date_end)}? Esta acción no se puede deshacer.`)) return
    setDeletingAnalysisId(report.analysis_record_id)
    setError('')
    try {
      await deleteParcelAnalysis(id, report.analysis_record_id)
      if (selectedReportId === report.analysis_id) setSelectedReportId(null)
      await loadParcelData({ keepLoading: true })
    } catch (e) {
      setError(e.message)
    } finally {
      setDeletingAnalysisId(null)
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>

  const latest = summary?.latest
  const series = summary?.series
  const area = parcelArea(parcel)
  const selectedReport = analyses.find((item) => item.analysis_id === selectedReportId) ?? latest
  const visualReports = analyses

  function handleExportReport(report = selectedReport) {
    openReportPdf({
      parcel,
      collection,
      report,
      analyses,
    })
  }

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="hero-dark text-white px-6 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs text-nir mb-2 flex items-center gap-1">
              <Link to="/collections" className="hover:text-white transition-colors">Fincas</Link>
              {collection && (
                <>
                  <span className="text-haze">›</span>
                  <Link to={`/collections/${collection.collection_id}`} className="hover:text-white transition-colors">
                    {collection.name}
                  </Link>
                </>
              )}
              <span className="text-haze">›</span>
              <span className="text-white">{parcel?.name ?? '...'}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{parcel?.name ?? id}</h1>
              {latest?.estado_cultivo && <StatusBadge value={latest.estado_cultivo} />}
            </div>
            <p className="text-haze text-sm mt-1">
              {CROP_LABELS[parcel?.crop_type] ?? parcel?.crop_type}
              {area && <span className="ml-2">· {formatArea(area.area_ha, area.area_m2)}</span>}
              {parcel?.notes && <span className="ml-2">· {parcel.notes}</span>}
            </p>
          </div>
          <button
            onClick={handleDelete}
            className="shrink-0 text-xs text-[#E04F31]/70 hover:text-[#E04F31] border border-[#E04F31]/30 hover:border-[#E04F31]/60 rounded-lg px-3 py-1.5 transition-colors"
          >
            Eliminar lote
          </button>
          <button
            onClick={() => handleExportReport()}
            className="shrink-0 text-xs text-[#9EE832] border border-[#9EE832]/40 hover:border-[#9EE832] rounded-lg px-3 py-1.5 transition-colors"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-xl bg-[#FDE8E3] border border-[#F5A99A] px-4 py-3 text-sm text-[#8C2415]">{error}</div>
      )}

      <div className="px-6 py-6">
        {/* Map + AI diagnosis row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">
          {/* Map */}
          <div className="lg:col-span-2 bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-4">
            <p className="text-[11px] font-bold text-[#A8A09A] uppercase tracking-widest mb-3">Mapa del lote</p>
            <ParcelMap geometry={parcel?.geometry} height="280px" />
            {area && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-soil px-3 py-2">
                  <p className="text-[10px] font-bold text-[#A8A09A] uppercase tracking-widest">Área (m²)</p>
                  <p className="text-sm font-bold text-orbit">{formatArea(area.area_ha, area.area_m2)}</p>
                </div>
                <div className="rounded-xl bg-soil px-3 py-2">
                  <p className="text-[10px] font-bold text-[#A8A09A] uppercase tracking-widest">Hectáreas</p>
                  <p className="text-sm font-bold text-orbit">{Number(area.area_ha).toFixed(2)} ha</p>
                </div>
              </div>
            )}
          </div>

          {/* Metrics detail */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {latest?.metrics ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {['NDVI', 'NDMI', 'NDRE', 'SAVI'].map((idx) => (
                    <MetricCard key={idx} index={idx} value={latest.metrics[idx]} />
                  ))}
                </div>
                {latest.trend && Object.keys(latest.trend).length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(latest.trend).map(([idx, trend]) => (
                      <div key={idx} className="bg-field rounded-xl border border-[#E4DFD4] shadow-sm px-3 py-2">
                        <p className="text-[10px] font-bold text-[#A8A09A] uppercase tracking-widest">{idx} vs anterior</p>
                        <p className={`text-sm font-bold ${
                          trend.direction === 'sube' ? 'text-[#3D6B0C]' :
                          trend.direction === 'baja' ? 'text-[#8C2415]' : 'text-[#6B6259]'
                        }`}>
                          {trend.direction === 'sube' ? '+' : ''}{trend.delta?.toFixed(2)}
                          <span className="ml-1 text-xs font-medium">({trend.percent?.toFixed(1)}%)</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Humedad', val: latest.humedad },
                    { label: 'Nutrición', val: latest.nutricion },
                    { label: 'Prioridad', val: latest.prioridad },
                  ].map(({ label, val }) => (
                    <div key={label} className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-3 text-center">
                      <p className="text-xs text-[#A8A09A] mb-1.5">{label}</p>
                      <StatusBadge value={val} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-field rounded-2xl border-2 border-dashed border-[#D4C9B0] p-10 text-center shadow-sm">
                <div>
                  <p className="text-sm font-semibold text-orbit">Sin análisis aún</p>
                  <p className="text-xs text-[#6B6259] mt-1">Lanza un análisis desde la finca</p>
                  {collection && (
                    <Link to={`/collections/${collection.collection_id}`}
                      className="mt-4 inline-flex items-center gap-1 rounded-lg font-medium text-xs px-3 py-1.5 transition-all hover:brightness-105"
                      style={{ background: '#9EE832', color: '#080C10' }}>
                      Ir a la finca →
                    </Link>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Satellite gallery */}
        <div className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-5 mb-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="font-semibold text-orbit">Galería satelital del lote</h2>
              <p className="text-xs text-[#6B6259] mt-1">Evolución visual guardada por cada análisis realizado.</p>
            </div>
            <span className="rounded-full bg-soil px-3 py-1 text-xs font-semibold text-[#6B6259]">
              {visualReports.length} fecha{visualReports.length !== 1 ? 's' : ''}
            </span>
          </div>

          {visualReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visualReports.map((report) => {
                const assets = report.visual_assets || {}
                const contextUrl = assets.context_rgb_thumbnail_url
                const rgbUrl = assets.rgb_thumbnail_url
                const ndviUrl = assets.ndvi_thumbnail_url
                const hasImage = Boolean(contextUrl || rgbUrl || ndviUrl)
                return (
                  <div
                    key={report.analysis_record_id ?? report.analysis_id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedReportId(report.analysis_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelectedReportId(report.analysis_id)
                    }}
                    className={`text-left rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                      selectedReport?.analysis_id === report.analysis_id
                        ? 'border-[#9EE832] ring-2 ring-[#9EE832]/30'
                        : 'border-[#E4DFD4] hover:border-[#C5E89A]'
                    }`}
                  >
                    {contextUrl && (
                      <div className="relative aspect-[16/7] overflow-hidden border-b border-white/70 bg-soil">
                        <span className="absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
                          Contexto Sentinel-2
                        </span>
                        <img src={contextUrl} alt={`Contexto Sentinel-2 del lote ${report.date_end}`} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 bg-soil">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <span className="absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
                          RGB satelital
                        </span>
                        {rgbUrl ? (
                          <img src={rgbUrl} alt={`Imagen RGB del lote ${report.date_end}`} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-[#A8A09A]">RGB no disponible</div>
                        )}
                      </div>
                      <div className="relative aspect-[4/3] overflow-hidden border-l border-white/70">
                        <span className="absolute left-2 top-2 z-10 rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold text-white">
                          NDVI vigor
                        </span>
                        {ndviUrl ? (
                          <img src={ndviUrl} alt={`Mapa NDVI del lote ${report.date_end}`} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-xs text-[#A8A09A]">NDVI no disponible</div>
                        )}
                      </div>
                    </div>
                    <div className="p-3 bg-field">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold text-orbit">{formatPeriod(report.date_start, report.date_end)}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          hasImage ? 'bg-[#E8F7D4] text-[#3D6B0C]' : 'bg-[#FDE8E3] text-[#8C2415]'
                        }`}>
                          {hasImage ? 'Guardada' : 'Sin captura'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A8A09A] mt-1">
                        Contexto Sentinel · RGB del lote · NDVI visual · {report.estado_cultivo ?? 'sin estado'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {contextUrl && (
                          <a
                            href={contextUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-lg border border-[#D4C9B0] px-2 py-1 text-[11px] font-semibold text-[#6B6259] hover:border-[#9EE832] hover:text-[#3D6B0C] transition-colors"
                          >
                            Abrir contexto
                          </a>
                        )}
                        {rgbUrl && (
                          <a
                            href={rgbUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-lg border border-[#D4C9B0] px-2 py-1 text-[11px] font-semibold text-[#6B6259] hover:border-[#9EE832] hover:text-[#3D6B0C] transition-colors"
                          >
                            Abrir RGB
                          </a>
                        )}
                        {ndviUrl && (
                          <a
                            href={ndviUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-lg border border-[#D4C9B0] px-2 py-1 text-[11px] font-semibold text-[#6B6259] hover:border-[#9EE832] hover:text-[#3D6B0C] transition-colors"
                          >
                            Abrir NDVI
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDeleteAnalysis(report)
                          }}
                          disabled={deletingAnalysisId === report.analysis_record_id}
                          className="rounded-lg border border-[#E04F31]/30 px-2 py-1 text-[11px] font-semibold text-[#8C2415] hover:border-[#E04F31]/60 hover:bg-[#FDE8E3] disabled:opacity-50 transition-colors"
                        >
                          {deletingAnalysisId === report.analysis_record_id ? 'Eliminando...' : 'Eliminar análisis'}
                        </button>
                      </div>
                      {ndviUrl && (
                        <div className="mt-2">
                          <div className="h-1.5 rounded-full bg-gradient-to-r from-[#8C2415] via-[#F6C343] to-[#1F7A1F]" />
                          <div className="mt-1 flex justify-between text-[10px] text-[#A8A09A]">
                            <span>Bajo vigor</span>
                            <span>Buen vigor</span>
                          </div>
                        </div>
                      )}
                      {!hasImage && (
                        <p className="text-[11px] text-[#8C2415] mt-2">
                          La imagen se generará en nuevos análisis si Earth Engine devuelve miniatura.
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#D4C9B0] bg-soil px-4 py-8 text-center">
              <p className="text-sm font-semibold text-orbit">Aún no hay capturas satelitales guardadas</p>
              <p className="text-xs text-[#6B6259] mt-1">Lanza un nuevo análisis para guardar la imagen RGB y el mapa NDVI del lote.</p>
            </div>
          )}
        </div>

        {/* AI Analysis card */}
        {latest?.resumen && (
          <div className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="font-semibold text-orbit">Diagnóstico IA</h2>
              {latest.date_start && (
                <span className="text-xs text-[#A8A09A] ml-1">{latest.date_start} – {latest.date_end}</span>
              )}
              {latest.confianza && (
                <span className="ml-auto text-xs text-[#A8A09A]">Confianza: {latest.confianza}</span>
              )}
            </div>
            <p className="text-sm text-[#3D3028] leading-relaxed mb-5">{latest.resumen}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {latest.recomendaciones?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-[#A8A09A] uppercase tracking-widest mb-2">Recomendaciones</p>
                  <ul className="space-y-2">
                    {latest.recomendaciones.map((r, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#3D3028]">
                        <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-[#E8F7D4] text-[#5B8A1A] flex items-center justify-center text-xs">•</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {latest.acciones_inmediatas?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-[#A07A15] uppercase tracking-widest mb-2">Acciones inmediatas</p>
                  <ul className="space-y-2">
                    {latest.acciones_inmediatas.map((a, i) => (
                      <li key={i} className="flex gap-2 text-sm text-[#3D3028]">
                        <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-[#FEF3D1] text-[#7A5A08] flex items-center justify-center text-xs">→</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {latest.plan_temporada?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#E4DFD4]">
                <p className="text-[11px] font-bold text-[#1057A0] uppercase tracking-widest mb-2">Plan de temporada</p>
                <ul className="space-y-1">
                  {latest.plan_temporada.map((p, i) => (
                    <li key={i} className="text-sm text-[#3D3028] flex gap-2">
                      <span className="text-[#5DB8F5]">›</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {selectedReport && selectedReport.analysis_id !== latest?.analysis_id && (
          <div className="bg-field rounded-2xl border border-[#C5E89A] shadow-sm p-5 mb-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="font-semibold text-orbit">Reporte histórico seleccionado</h2>
                <p className="text-xs text-[#A8A09A]">{selectedReport.date_start} – {selectedReport.date_end}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportReport(selectedReport)}
                  className="rounded-lg border border-[#9EE832] text-[#3D6B0C] px-3 py-1.5 text-xs font-semibold hover:bg-[#E8F7D4] transition-colors"
                >
                  Exportar PDF
                </button>
                <button
                  onClick={() => handleDeleteAnalysis(selectedReport)}
                  disabled={deletingAnalysisId === selectedReport.analysis_record_id}
                  className="rounded-lg border border-[#E04F31]/30 text-[#8C2415] px-3 py-1.5 text-xs font-semibold hover:border-[#E04F31]/60 hover:bg-[#FDE8E3] disabled:opacity-50 transition-colors"
                >
                  {deletingAnalysisId === selectedReport.analysis_record_id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
            <p className="text-sm text-[#3D3028] leading-relaxed mb-4">{selectedReport.resumen}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {['NDVI', 'NDMI', 'NDRE', 'SAVI'].map((idx) => (
                <div key={idx} className="rounded-xl bg-soil px-3 py-2">
                  <p className="text-[10px] font-bold text-[#A8A09A] uppercase tracking-widest">{idx}</p>
                  <p className="font-bold text-orbit">{selectedReport.metrics?.[idx]?.toFixed(2) ?? '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Time series */}
        {series && Object.keys(series).some((k) => series[k]?.length > 0) && (
          <div className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-5 mb-5">
            <h2 className="font-semibold text-orbit mb-4">Series temporales</h2>
            <IndexChart series={series} />
          </div>
        )}

        {/* History table */}
        {analyses.length > 0 && (
          <div className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-5">
            <h2 className="font-semibold text-orbit mb-4">Historial de análisis</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4DFD4]">
                    {['Período', 'NDVI', 'NDMI', 'NDRE', 'SAVI', 'Estado', 'Prioridad', 'Acciones'].map((h) => (
                      <th key={h} className="text-left text-[11px] font-bold text-[#A8A09A] uppercase tracking-widest pb-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EDE8]">
                  {analyses.map((a, i) => (
                    <tr key={a.analysis_id ?? i} className="hover:bg-soil/50 transition-colors">
                      <td className="py-2.5 pr-4 text-[#6B6259] whitespace-nowrap text-xs">{a.date_start} – {a.date_end}</td>
                      {['NDVI', 'NDMI', 'NDRE', 'SAVI'].map((idx) => (
                        <td key={idx} className="py-2.5 pr-4 font-bold" style={{ fontFamily: "'Fira Code', monospace", fontSize: '13px', color: a.metrics?.[idx] != null ? (a.metrics[idx] >= 0.6 ? '#3D6B0C' : a.metrics[idx] >= 0.4 ? '#7A5A08' : '#8C2415') : '#8B9CB0' }}>
                          {a.metrics?.[idx]?.toFixed(2) ?? '—'}
                        </td>
                      ))}
                      <td className="py-2.5 pr-4"><StatusBadge value={a.estado_cultivo} /></td>
                      <td className="py-2.5"><StatusBadge value={a.prioridad} /></td>
                      <td className="py-2.5 pr-4">
                        <button
                          onClick={() => setSelectedReportId(a.analysis_id)}
                          className="rounded-lg border border-[#D4C9B0] px-2 py-1 text-xs text-[#6B6259] hover:border-[#9EE832] hover:text-[#3D6B0C] transition-colors"
                        >
                          Ver
                        </button>
                        <button
                          onClick={() => handleDeleteAnalysis(a)}
                          disabled={deletingAnalysisId === a.analysis_record_id}
                          className="ml-2 rounded-lg border border-[#E04F31]/30 px-2 py-1 text-xs text-[#8C2415] hover:border-[#E04F31]/60 hover:bg-[#FDE8E3] disabled:opacity-50 transition-colors"
                        >
                          {deletingAnalysisId === a.analysis_record_id ? '...' : 'Borrar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
