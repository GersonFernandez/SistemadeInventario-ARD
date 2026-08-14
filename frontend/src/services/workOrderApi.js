import api from './api'

export const despachoApi = {
  getDespachos: (params = {}) => api.get('/work-orders/despachos/', { params }),
  getDespacho: (id) => api.get(`/work-orders/despachos/${id}/`),
  getDispatchableItems: (params = {}) => api.get('/work-orders/despachos/dispatchable-items/', { params }),
  createDespacho: (data) => api.post('/work-orders/despachos/', data),
  cancelDespacho: (id, reason) => api.post(`/work-orders/despachos/${id}/cancel/`, { reason }),
  downloadReceipt: (id, format = 'pdf') => api.get(`/work-orders/despachos/${id}/receipt/?type=${format}`, {
    responseType: 'blob',
  }),
  downloadDespachosReport: (format = 'pdf') => api.get(`/work-orders/despachos/report/?type=${format}`, {
    responseType: 'blob',
  }),
  downloadReceptionDispatchReport: (format = 'pdf', params = {}) => api.get('/work-orders/despachos/reception-dispatch-report/', {
    params: { type: format, ...params },
    responseType: 'blob',
  }),
  getAttachments: (id, params = {}) => api.get(`/work-orders/despachos/${id}/attachments/`, { params }),
  uploadAttachments: (id, files = {}) => {
    const formData = new FormData()
    ;(files.evidences || []).forEach((file) => formData.append('evidences', file))
    ;(files.receipts || []).forEach((file) => formData.append('receipts', file))
    return api.post(`/work-orders/despachos/${id}/upload_attachments/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const solicitanteApi = {
  list: (params = {}) => api.get('/work-orders/solicitantes/', { params }),
  get: (id) => api.get(`/work-orders/solicitantes/${id}/`),
  create: (data) => api.post('/work-orders/solicitantes/', data),
  update: (id, data) => api.put(`/work-orders/solicitantes/${id}/`, data),
  partialUpdate: (id, data) => api.patch(`/work-orders/solicitantes/${id}/`, data),
  disable: (id) => api.delete(`/work-orders/solicitantes/${id}/`),
  search: (query) => api.get('/work-orders/solicitantes/', { params: { search: query } }),
}

// Mantener workOrderApi como alias por compatibilidad (apunta a despachoApi)
export const workOrderApi = despachoApi
