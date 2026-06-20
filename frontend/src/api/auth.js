import { post, get } from './client'

export const register = (name, email, password) =>
  post('/auth/register', { name, email, password })

export const login = (email, password) =>
  post('/auth/login', { email, password })

export const me = () => get('/auth/me')

export const logout = () => post('/auth/logout', {})
