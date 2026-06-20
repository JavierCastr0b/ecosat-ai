import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import logotipo from '../assets/logotipo.png'

export default function RegisterPage() {
  const { saveAuth } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await register(form.name, form.email, form.password)
      saveAuth(data)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-soil flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src={logotipo} alt="EcoSat AI" className="w-16 h-16 object-contain mb-3" />
          <p className="text-orbit font-bold text-xl">EcoSat <span className="text-[#5B8A1A]">AI</span></p>
        </div>

        <div className="bg-field border border-[#E4DFD4] rounded-3xl shadow-sm p-8">
          <div className="mb-7">
            <h2 className="text-xl font-bold text-orbit">Crear cuenta</h2>
            <p className="text-[#6B6259] text-sm mt-1">Comienza a monitorear tus cultivos</p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl bg-[#FDE8E3] border border-[#F5A99A] px-4 py-3 text-sm text-[#8C2415]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#6B6259] uppercase tracking-wide mb-2">
                Nombre completo
              </label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl bg-soil border border-[#D4C9B0] text-orbit placeholder-[#A8A09A] px-4 py-3 text-sm focus:border-[#9EE832] focus:ring-2 focus:ring-[#9EE832]/20 focus:outline-none transition-all"
                placeholder="Juan Pérez"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6B6259] uppercase tracking-wide mb-2">
                Correo electrónico
              </label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl bg-soil border border-[#D4C9B0] text-orbit placeholder-[#A8A09A] px-4 py-3 text-sm focus:border-[#9EE832] focus:ring-2 focus:ring-[#9EE832]/20 focus:outline-none transition-all"
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#6B6259] uppercase tracking-wide mb-2">
                Contraseña
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full rounded-xl bg-soil border border-[#D4C9B0] text-orbit placeholder-[#A8A09A] px-4 py-3 text-sm focus:border-[#9EE832] focus:ring-2 focus:ring-[#9EE832]/20 focus:outline-none transition-all"
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold py-3 text-sm transition-all mt-2 disabled:opacity-50 hover:brightness-105 active:brightness-95"
              style={{ background: '#9EE832', color: '#080C10' }}
            >
              {loading ? <><Spinner size="sm" /> Creando cuenta...</> : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#6B6259]">
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" className="text-[#5B8A1A] hover:text-[#3D6B0C] font-semibold transition-colors">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
