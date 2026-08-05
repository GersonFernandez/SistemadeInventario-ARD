import api from './api'

export const serviceOrderApi = {
  getServiceOrders: (params = {}) => api.get('/work-orders/service-orders/', { params }),
  getServiceOrder: (id) => api.get(`/work-orders/service-orders/${id}/`),
  createServiceOrder: (data) => api.post('/work-orders/service-orders/', data),
  updateServiceOrder: (id, data) => api.put(`/work-orders/service-orders/${id}/`, data),
  assignServiceOrder: (id, technicianId) =>
    api.post(`/work-orders/service-orders/${id}/assign/`, { technician_id: technicianId }),
  transitionServiceOrder: (id, status, note = '') =>
    api.post(`/work-orders/service-orders/${id}/transition/`, { status, note }),
  addServiceOrderNote: (id, note) =>
    api.post(`/work-orders/service-orders/${id}/add_note/`, { note }),
  completeServiceOrder: (id, data) =>
    api.post(`/work-orders/service-orders/${id}/complete_service/`, data),
  downloadCompletionReceipt: (id, format = 'pdf') =>
    api.get(`/work-orders/service-orders/${id}/completion_receipt/?type=${format}`, {
      responseType: 'blob',
    }),
  downloadReport: (format = 'pdf', params = {}) =>
    api.get('/work-orders/service-orders/report/', {
      params: { type: format, ...params },
      responseType: 'blob',
    }),
}
