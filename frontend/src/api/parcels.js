import { get, post, put, del } from './client'

export const listParcels = () => get('/parcels')

export const createParcel = (data) => post('/parcels', data)

export const getParcel = (id) => get(`/parcels/${id}`)

export const updateParcel = (id, data) => put(`/parcels/${id}`, data)

export const deleteParcel = (id) => del(`/parcels/${id}`)

export const getParcelSummary = (id) => get(`/parcels/${id}/summary`)

export const listParcelAnalyses = (id, compact = false, limit = 12) =>
  get(`/parcels/${id}/analyses?compact=${compact}&limit=${limit}`)

export const deleteParcelAnalysis = (parcelId, analysisRecordId) =>
  del(`/parcels/${parcelId}/analyses/${analysisRecordId}`)
