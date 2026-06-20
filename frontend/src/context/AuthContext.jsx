import { createContext, useContext, useState, useEffect } from 'react'
import { me } from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('ecosat_token')
    if (!token) { setLoading(false); return }
    me()
      .then((data) => setUser(data.user ?? data))
      .catch(() => clearAuth())
      .finally(() => setLoading(false))
  }, [])

  function saveAuth(data) {
    localStorage.setItem('ecosat_token', data.token)
    localStorage.setItem('ecosat_tenant', data.tenant_id)
    localStorage.setItem('ecosat_user', JSON.stringify(data.user))
    setUser(data.user)
  }

  function clearAuth() {
    localStorage.removeItem('ecosat_token')
    localStorage.removeItem('ecosat_tenant')
    localStorage.removeItem('ecosat_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, saveAuth, clearAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
