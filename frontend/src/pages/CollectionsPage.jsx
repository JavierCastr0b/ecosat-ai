import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listCollections, createCollection, deleteCollection } from '../api/collections'
import Spinner from '../components/Spinner'

export default function CollectionsPage() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState('')

  async function load() {
    try {
      const data = await listCollections()
      setCollections(data.collections ?? data ?? [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await createCollection(form)
      setForm({ name: '', description: '' })
      setShowForm(false)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`¿Eliminar la finca "${name}"? Esta acción no se puede deshacer.`)) return
    try {
      await deleteCollection(id)
      setCollections((prev) => prev.filter((c) => c.collection_id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="hero-dark px-6 py-8 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Fincas</h1>
            <p className="text-nir text-sm mt-1">Organiza tus lotes por finca</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/8 hover:bg-white/15 text-white text-sm font-semibold px-4 py-2.5 transition-colors shrink-0"
          >
            {showForm ? '✕ Cancelar' : '+ Nueva finca'}
          </button>
        </div>
      </div>

      <div className="px-6 py-6 lg:px-10">
        {error && (
          <div className="mb-5 rounded-xl bg-[#FDE8E3] border border-[#F5A99A] px-4 py-3 text-sm text-[#8C2415]">{error}</div>
        )}

        {/* Create form */}
        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 bg-field rounded-2xl border border-[#E4DFD4] shadow-sm p-6">
            <h2 className="font-bold text-orbit mb-4">Nueva finca</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-[#6B6259] mb-1.5">Nombre *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-[#D4C9B0] bg-soil px-4 py-2.5 text-sm text-orbit focus:border-[#9EE832] focus:ring-2 focus:ring-[#9EE832]/20 focus:outline-none transition-all"
                  placeholder="Finca El Paraíso"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B6259] mb-1.5">Descripción</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl border border-[#D4C9B0] bg-soil px-4 py-2.5 text-sm text-orbit focus:border-[#9EE832] focus:ring-2 focus:ring-[#9EE832]/20 focus:outline-none transition-all"
                  placeholder="Ubicación, cultivos..."
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 rounded-xl font-semibold text-sm px-5 py-2.5 transition-all disabled:opacity-60 hover:brightness-105"
                style={{ background: '#9EE832', color: '#080C10' }}
              >
                {creating ? <><Spinner size="sm" /> Creando...</> : 'Crear finca'}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : collections.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#D4C9B0] bg-field p-12 text-center">
            <h2 className="text-xl font-bold text-orbit">Sin fincas aún</h2>
            <p className="text-sm text-[#6B6259] mt-2 mb-6">Crea tu primera finca para organizar tus lotes</p>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl font-semibold text-sm px-6 py-2.5 transition-all hover:brightness-105"
              style={{ background: '#9EE832', color: '#080C10' }}
            >
              + Nueva finca
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {collections.map((c) => (
              <div key={c.collection_id} className="group bg-field rounded-2xl border border-[#E4DFD4] shadow-sm hover:shadow-md hover:border-[#C5E89A] transition-all">
                <Link to={`/collections/${c.collection_id}`} className="block p-5">
                  <div className="h-12 w-12 rounded-xl bg-[#E8F7D4] flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-[#5B8A1A]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" />
                    </svg>
                  </div>
                  <h3 className="font-bold text-orbit group-hover:text-[#3D6B0C] transition-colors mb-1">{c.name}</h3>
                  {c.description && (
                    <p className="text-xs text-[#6B6259] line-clamp-2">{c.description}</p>
                  )}
                </Link>
                <div className="px-5 pb-4 pt-0 flex items-center justify-between border-t border-[#E4DFD4]">
                  <Link
                    to={`/collections/${c.collection_id}`}
                    className="text-xs text-[#5B8A1A] hover:text-[#3D6B0C] font-medium transition-colors"
                  >
                    Ver lotes →
                  </Link>
                  <button
                    onClick={() => handleDelete(c.collection_id, c.name)}
                    className="text-[#D4C9B0] hover:text-[#E04F31] transition-colors"
                    title="Eliminar"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
