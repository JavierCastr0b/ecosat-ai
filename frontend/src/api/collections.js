import { get, post, put, del } from './client'

export const listCollections = () => get('/collections')

export const createCollection = (data) => post('/collections', data)

export const updateCollection = (id, data) => put(`/collections/${id}`, data)

export const deleteCollection = (id) => del(`/collections/${id}`)

export const getCollectionSummary = (id) => get(`/collections/${id}/summary`)
