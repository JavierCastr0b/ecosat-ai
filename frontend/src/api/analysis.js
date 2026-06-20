import { get, post } from './client'

export const submitAnalysis = (body) => post('/analysis/saved', body)

export const getAnalysisStatus = (id) => get(`/analysis/${id}/status`)
