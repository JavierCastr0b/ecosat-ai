import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/Spinner'
import logotipo from '../assets/logotipo.png'

function NdviDemo() {
  return (
    <div className="w-full max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-[#9EE832]">NDVI</span>
        <span className="text-[11px] text-[#5A6B7A] font-medium">Índice de vegetación</span>
      </div>
      <div className="relative">
        <div
          className="h-2 w-full rounded-full"
          style={{ background: 'linear-gradient(to right, #E04F31 0%, #F5B83F 38%, #9EE832 76%, #6AAD1A 100%)' }}
        />
        {/* Marker at 0.68 */}
        <div
          className="absolute top-[-5px] h-[22px] w-[22px] rounded-full border-2 border-[#080C10] shadow-lg -translate-x-1/2"
          style={{ left: '68%', backgroundColor: '#9EE832' }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-[10px] text-[#3D4D5C]">
        <span>0.0</span><span>0.5</span><span>1.0</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span
          className="text-2xl font-medium leading-none"
          style={{ fontFamily: "'Fira Code', monospace", color: '#9EE832' }}
        >
          0.68
        </span>
        <span className="text-xs text-[#5A6B7A]">· Salud óptima del cultivo</span>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { saveAuth } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [splashDone, setSplashDone] = useState(false)
  const [splashFading, setSplashFading] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setSplashFading(true), 1600)
    const t2 = setTimeout(() => setSplashDone(true), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(form.email, form.password)
      saveAuth(data)
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#080C10' }}>
      {/* Login layout */}
      <div
        className="min-h-screen flex transition-opacity duration-500"
        style={{ opacity: splashDone ? 1 : 0 }}
      >
        {/* Left panel — branding */}
        <div
          className="hidden lg:flex lg:w-1/2 flex-col items-start justify-center px-16 relative"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(158,232,50,0.013) 3px, rgba(158,232,50,0.013) 4px)',
          }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(158,232,50,0.06)_0%,transparent_65%)] pointer-events-none" />

          <div className="relative z-10 w-full max-w-xs">
            <div className="flex items-center gap-3 mb-10">
              <img src={logotipo} alt="EcoSat AI" className="w-12 h-12 object-contain" />
              <div>
                <p className="text-white font-extrabold text-xl tracking-tight leading-none">
                  EcoSat <span style={{ color: '#9EE832' }}>AI</span>
                </p>
                <p className="text-[#5A6B7A] text-[10px] font-medium tracking-widest uppercase mt-0.5">Monitoreo agrícola</p>
              </div>
            </div>

            <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight mb-3">
              Visión satelital.<br />
              <span style={{ color: '#9EE832' }}>Salud de cultivo.</span>
            </h1>
            <p className="text-[#5A6B7A] text-sm leading-relaxed mb-10">
              Análisis espectral con imágenes Sentinel-2 e inteligencia artificial para cada lote.
            </p>

            <NdviDemo />

            <p className="mt-8 text-[11px] text-[#3D4D5C] font-medium tracking-wide uppercase">
              Sentinel-2 · Groq AI · AWS Lambda
            </p>
          </div>
        </div>

        {/* Right panel — form */}
        <div className="flex-1 flex items-center justify-center p-6 bg-soil">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="lg:hidden flex flex-col items-center mb-8">
              <img src={logotipo} alt="EcoSat AI" className="w-16 h-16 object-contain mb-3" />
              <p className="text-orbit font-bold text-xl">EcoSat <span className="text-[#5B8A1A]">AI</span></p>
            </div>

            <div className="bg-field border border-[#E4DFD4] rounded-3xl shadow-sm p-8">
              <div className="mb-7">
                <h2 className="text-xl font-bold text-orbit">Iniciar sesión</h2>
                <p className="text-[#6B6259] text-sm mt-1">Accede a tu plataforma de monitoreo</p>
              </div>

              {error && (
                <div className="mb-5 rounded-xl bg-[#FDE8E3] border border-[#F5A99A] px-4 py-3 text-sm text-[#8C2415]">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full rounded-xl bg-soil border border-[#D4C9B0] text-orbit placeholder-[#A8A09A] px-4 py-3 text-sm focus:border-[#9EE832] focus:ring-2 focus:ring-[#9EE832]/20 focus:outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold py-3 text-sm transition-all mt-2 disabled:opacity-50 hover:brightness-105 active:brightness-95"
                  style={{ background: '#9EE832', color: '#080C10' }}
                >
                  {loading ? <><Spinner size="sm" /> Iniciando sesión...</> : 'Iniciar sesión'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-[#6B6259]">
                ¿No tienes cuenta?{' '}
                <Link to="/register" className="text-[#5B8A1A] hover:text-[#3D6B0C] font-semibold transition-colors">
                  Regístrate
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Splash overlay */}
      {!splashDone && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center transition-all duration-500"
          style={{
            background: '#080C10',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(158,232,50,0.013) 3px, rgba(158,232,50,0.013) 4px)',
            opacity: splashFading ? 0 : 1,
            transform: splashFading ? 'scale(1.04)' : 'scale(1)',
          }}
        >
          <img
            src={logotipo}
            alt="EcoSat AI"
            className="w-28 h-28 object-contain mb-6"
            style={{
              opacity: splashFading ? 0 : 1,
              transform: splashFading ? 'translateY(-8px)' : 'translateY(0)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          />
          <h1
            className="text-3xl font-extrabold text-white tracking-tight"
            style={{
              opacity: splashFading ? 0 : 1,
              transform: splashFading ? 'translateY(8px)' : 'translateY(0)',
              transition: 'opacity 0.5s ease 0.05s, transform 0.5s ease 0.05s',
            }}
          >
            EcoSat <span style={{ color: '#9EE832' }}>AI</span>
          </h1>
          <p
            className="text-[#5A6B7A] text-sm mt-2"
            style={{
              opacity: splashFading ? 0 : 1,
              transition: 'opacity 0.4s ease 0.1s',
            }}
          >
            Monitoreo agrícola satelital
          </p>
        </div>
      )}
    </div>
  )
}
