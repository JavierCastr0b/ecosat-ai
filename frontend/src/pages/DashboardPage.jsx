import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listCollections } from '../api/collections'
import { listParcels } from '../api/parcels'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import { formatArea, parcelArea } from '../utils/geo'

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatDate() {
  const d = new Date()
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches'
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [collections, setCollections] = useState([])
  const [parcels, setParcels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([listCollections(), listParcels()])
      .then(([c, p]) => {
        setCollections(c.collections ?? c ?? [])
        setParcels(p.parcels ?? p ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex h-full items-center justify-center"><Spinner size="lg" /></div>

  const firstName = user?.name?.split(' ')[0] ?? 'Agricultor'

  return (
    <div className="min-h-full">
      {/* Hero banner */}
      <div className="hero-dark px-6 py-8 lg:px-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-nir text-xs font-medium tracking-wide">{formatDate()}</p>
            <h1 className="text-2xl lg:text-3xl font-bold text-white mt-1">
              {greeting()}, <span className="text-nir">{firstName}</span>
            </h1>
            <p className="text-haze text-sm mt-1">Sistema de monitoreo agrícola satelital</p>
          </div>
          <div className="h-11 w-11 rounded-full bg-nir border-2 border-[#C5E89A] flex items-center justify-center text-orbit font-bold text-lg shrink-0">
            {firstName[0]?.toUpperCase()}
          </div>
        </div>

        {/* Stat pills */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          {[
            { value: collections.length, label: 'Fincas' },
            { value: parcels.length, label: 'Lotes' },
            { value: 4, label: 'Índices activos' },
          ].map(({ value, label }) => (
            <div key={label} className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-center">
              <p
                className="text-2xl font-bold text-nir leading-none"
                style={{ fontFamily: "'Fira Code', monospace" }}
              >
                {value}
              </p>
              <p className="text-xs text-haze mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-6 lg:px-10">
        {collections.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#D4C9B0] bg-field p-12 text-center">
            <p className="text-5xl mb-4">🌱</p>
            <h2 className="text-xl font-bold text-orbit">Comienza creando tu primera finca</h2>
            <p className="text-sm text-[#6B6259] mt-2 mb-6">Organiza tus lotes por finca para lanzar análisis satelitales</p>
            <Link
              to="/collections"
              className="inline-flex items-center gap-2 rounded-xl font-semibold text-sm px-6 py-2.5 transition-all hover:brightness-105"
              style={{ background: '#9EE832', color: '#080C10' }}
            >
              + Nueva finca
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Haciendas column */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-orbit">Tus fincas</h2>
                <Link to="/collections" className="text-sm text-[#5B8A1A] hover:text-[#3D6B0C] font-medium transition-colors">Ver todas →</Link>
              </div>

              <div className="flex flex-col gap-3">
                {collections.map((c) => {
                  const parcelCount = parcels.filter((p) => p.collection_id === c.collection_id).length
                  return (
                    <Link
                      key={c.collection_id}
                      to={`/collections/${c.collection_id}`}
                      className="group bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-5 hover:shadow-md hover:border-[#C5E89A] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-[#E8F7D4] flex items-center justify-center shrink-0">
                          <svg className="w-6 h-6 text-[#5B8A1A]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-orbit group-hover:text-[#3D6B0C] transition-colors">{c.name}</p>
                          {c.description && <p className="text-sm text-[#6B6259] truncate mt-0.5">{c.description}</p>}
                          <p className="text-xs text-[#A8A09A] mt-1">{parcelCount} lote{parcelCount !== 1 ? 's' : ''}</p>
                        </div>
                        <svg className="w-5 h-5 text-[#D4C9B0] group-hover:text-[#9EE832] transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </Link>
                  )
                })}
              </div>

              {/* Parcelas preview */}
              {parcels.length > 0 && (
                <div className="mt-2">
                  <h2 className="text-base font-bold text-orbit mb-3">Lotes recientes</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {parcels.slice(0, 4).map((p) => {
                      const area = parcelArea(p)
                      return (
                        <Link
                          key={p.parcel_id}
                          to={`/parcels/${p.parcel_id}`}
                          className="group bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-4 hover:shadow-md hover:border-[#C5E89A] transition-all flex items-center gap-3"
                        >
                          <div className="h-9 w-9 rounded-lg bg-[#E8F7D4] flex items-center justify-center shrink-0">
                            <svg className="w-4.5 h-4.5 text-[#5B8A1A]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-orbit truncate group-hover:text-[#3D6B0C] transition-colors">{p.name}</p>
                            <p className="text-xs text-[#A8A09A] truncate">
                              {p.crop_type ?? 'Sin cultivo'}
                              {area && <span className="ml-1">· {formatArea(area.area_ha, area.area_m2)}</span>}
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick actions column */}
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-bold text-orbit">Acciones rápidas</h2>

              <Link
                to="/parcels/new"
                className="group bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-5 hover:shadow-md hover:border-[#C5E89A] transition-all"
              >
                <div className="h-11 w-11 rounded-xl bg-[#E8F7D4] flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[#5B8A1A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeWidth={1.8} />
                    <path strokeLinecap="round" strokeWidth={1.8} d="M12 8v8M8 12h8" />
                  </svg>
                </div>
                <p className="font-semibold text-orbit text-sm group-hover:text-[#3D6B0C] transition-colors">Nuevo lote</p>
                <p className="text-xs text-[#6B6259] mt-1">Dibuja el polígono de tu cultivo en el mapa satelital</p>
              </Link>

              <Link
                to="/collections"
                className="group bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-5 hover:shadow-md hover:border-[#A8D4F5] transition-all"
              >
                <div className="h-11 w-11 rounded-xl bg-[#DFF0FF] flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-[#1057A0]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                </div>
                <p className="font-semibold text-orbit text-sm group-hover:text-[#1057A0] transition-colors">Lanzar análisis</p>
                <p className="text-xs text-[#6B6259] mt-1">Procesa imágenes Sentinel-2 con inteligencia artificial</p>
              </Link>

              {/* Index legend */}
              <div className="bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-5">
                <p className="text-[11px] font-bold text-[#A8A09A] uppercase tracking-widest mb-3">Índices espectrales</p>
                {[
                  { name: 'NDVI', desc: 'Vigor · Biomasa', color: '#9EE832' },
                  { name: 'NDMI', desc: 'Humedad hídrica', color: '#5DB8F5' },
                  { name: 'NDRE', desc: 'Clorofila · N', color: '#F5B83F' },
                  { name: 'SAVI', desc: 'Vigor corregido', color: '#C084FC' },
                ].map(({ name, desc, color }) => (
                  <div key={name} className="flex items-center gap-2.5 py-1.5">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-bold text-orbit w-10">{name}</span>
                    <span className="text-xs text-[#6B6259]">{desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
