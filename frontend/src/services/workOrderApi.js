import api from './api'

export const despachoApi = {
  getDespachos: (params = {}) => api.get('/work-orders/despachos/', { params }),
  getDespacho: (id) => api.get(`/work-orders/despachos/${id}/`),
  createDespacho: (data) => api.post('/work-orders/despachos/', data),
  cancelDespacho: (id, reason) => api.post(`/work-orders/despachos/${id}/cancel/`, { reason }),
  downloadReceipt: (id, format = 'pdf') => api.get(`/work-orders/despachos/${id}/receipt/?type=${format}`, {
    responseType: 'blob',
  }),
  downloadDespachosReport: (format = 'pdf') => api.get(`/work-orders/despachos/report/?type=${format}`, {
    responseType: 'blob',
  }),
}

export const solicitanteApi = {
  list: (params = {}) => api.get('/work-orders/solicitantes/', { params }),
  get: (id) => api.get(`/work-orders/solicitantes/${id}/`),
  create: (data) => api.post('/work-orders/solicitantes/', data),
  update: (id, data) => api.put(`/work-orders/solicitantes/${id}/`, data),
  disable: (id) => api.delete(`/work-orders/solicitantes/${id}/`),
  search: (query) => api.get('/work-orders/solicitantes/', { params: { search: query } }),
}

// Mantener workOrderApi como alias por compatibilidad (apunta a despachoApi)
export const workOrderApi = despachoApi
