const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''
).replace(/\/+$/, '')

async function request(path, options = {}) {
  const token = localStorage.getItem('ecosat_token')
  const tenantId = localStorage.getItem('ecosat_tenant')

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(tenantId ? { 'X-Tenant-Id': tenantId } : {}),
      ...options.headers,
    },
  })

  if (res.status === 204) return null

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.message || data.error || `Error ${res.status}`)
  }

  return data
}

export const get = (path) => request(path, { method: 'GET' })
export const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })
export const put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) })
export const del = (path) => request(path, { method: 'DELETE' })
