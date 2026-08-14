import api from './api'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001/api/v1'

export const inventoryApi = {
  downloadInventoryReport: (format = 'pdf', filters = {}) => api.get(`/inventory/items/report/`, {
    params: { type: format, ...filters },
    responseType: 'blob',
  }),

  getCategories: () => api.get('/inventory/categories/'),
  getCategory: (id) => api.get(`/inventory/categories/${id}/`),
  createCategory: (data) => api.post('/inventory/categories/', data),
  updateCategory: (id, data) => api.put(`/inventory/categories/${id}/`, data),
  deleteCategory: (id) => api.delete(`/inventory/categories/${id}/`),

  getBrands: (params = {}) => api.get('/inventory/brands/', { params }),
  createBrand: (data) => api.post('/inventory/brands/', data),
  updateBrand: (id, data) => api.put(`/inventory/brands/${id}/`, data),
  deleteBrand: (id) => api.delete(`/inventory/brands/${id}/`),

  getProductModels: (params = {}) => api.get('/inventory/product-models/', { params }),
  createProductModel: (data) => api.post('/inventory/product-models/', data),
  updateProductModel: (id, data) => api.put(`/inventory/product-models/${id}/`, data),
  deleteProductModel: (id) => api.delete(`/inventory/product-models/${id}/`),

  getProductStates: (params = {}) => api.get('/inventory/product-states/', { params }),
  createProductState: (data) => api.post('/inventory/product-states/', data),
  updateProductState: (id, data) => api.put(`/inventory/product-states/${id}/`, data),
  deleteProductState: (id) => api.delete(`/inventory/product-states/${id}/`),

  getUnitMeasures: (params = {}) => api.get('/inventory/unit-measures/', { params }),

  getLocationTypes: (params = {}) => api.get('/inventory/location-types/', { params }),
  getLocationType: (id) => api.get(`/inventory/location-types/${id}/`),
  createLocationType: (data) => api.post('/inventory/location-types/', data),
  updateLocationType: (id, data) => api.put(`/inventory/location-types/${id}/`, data),
  deleteLocationType: (id) => api.delete(`/inventory/location-types/${id}/`),

  getLocations: (params = {}) => api.get('/inventory/locations/', { params }),
  getLocation: (id) => api.get(`/inventory/locations/${id}/`),
  createLocation: (data) => api.post('/inventory/locations/', data),
  updateLocation: (id, data) => api.put(`/inventory/locations/${id}/`, data),
  deleteLocation: (id) => api.delete(`/inventory/locations/${id}/`),

  getItems: (params = {}) => api.get('/inventory/items/', { params }),
  getItem: (id) => api.get(`/inventory/items/${id}/`),
  createItem: (formData) => api.post('/inventory/items/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateItem: (id, formData) => api.put(`/inventory/items/${id}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteItem: (id) => api.delete(`/inventory/items/${id}/`),
  getCriticalItems: () => api.get('/inventory/items/critical/'),
  addItemUnit: (id, data) => api.post(`/inventory/items/${id}/add_unit/`, data),

  getItemUnits: (params = {}) => api.get('/inventory/item-units/', { params }),
  getItemUnit: (id) => api.get(`/inventory/item-units/${id}/`),
  getOverdueUnits: () => api.get('/inventory/item-units/?overdue=true'),
  setUnitStatus: (id, data) => api.post(`/inventory/item-units/${id}/set_status/`, data),
  receiveUnit: (id, data) => api.post(`/inventory/item-units/${id}/receive/`, data),

  getItemLoans: (params = {}) => api.get('/inventory/item-loans/', { params }),
  getItemLoan: (id) => api.get(`/inventory/item-loans/${id}/`),
  createItemLoan: (data) => api.post('/inventory/item-loans/', data),
  returnItemLoan: (id) => api.post(`/inventory/item-loans/${id}/return_unit/`, {}),
  extendItemLoan: (id, days) => api.post(`/inventory/item-loans/${id}/extend/`, { days }),
  downloadLoansReport: (params = {}) => api.get('/inventory/item-loans/report/', {
    params,
    responseType: 'blob',
  }),

  getStockMovements: (params = {}) => api.get('/inventory/stock-movements/', { params }),
  createStockMovement: (data) => api.post('/inventory/stock-movements/', data),

  getTransfers: (params = {}) => api.get('/inventory/transfers/', { params }),
  getTransfer: (id) => api.get(`/inventory/transfers/${id}/`),
  createTransfer: (data) => api.post('/inventory/transfers/', data),
  approveTransfer: (id) => api.post(`/inventory/transfers/${id}/approve/`, {}),
  rejectTransfer: (id) => api.post(`/inventory/transfers/${id}/reject/`, {}),

  getRepairs: (params = {}) => api.get('/inventory/repairs/', { params }),
  createRepair: (data) => api.post('/inventory/repairs/', data),
  updateRepair: (id, data) => api.put(`/inventory/repairs/${id}/`, data),
  deleteRepair: (id) => api.delete(`/inventory/repairs/${id}/`),

  getInstallations: (params = {}) => api.get('/inventory/installations/', { params }),
  createInstallation: (data) => api.post('/inventory/installations/', data),
  createInstallationBatch: (data) => api.post('/inventory/installations/create_batch/', data),
  updateInstallation: (id, data) => api.put(`/inventory/installations/${id}/`, data),
  deleteInstallation: (id) => api.delete(`/inventory/installations/${id}/`),

  getProductEntries: (params = {}) => api.get('/inventory/product-entries/', { params }),
  createProductEntryBatch: (payload, attachments = {}) => {
    const formData = new FormData()
    formData.append('payload', JSON.stringify(payload))

    if (Array.isArray(attachments)) {
      attachments.forEach((file) => formData.append('attachments', file))
    } else {
      ;(attachments.photos || []).forEach((file) => formData.append('photos', file))
      ;(attachments.documents || []).forEach((file) => formData.append('documents', file))
      ;(attachments.signedReceipt || []).forEach((file) => formData.append('signed_receipt', file))
    }

    return api.post('/inventory/product-entries/create_batch/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  downloadProductEntryReceipt: (receptionId, format = 'pdf') => api.get('/inventory/product-entries/receipt/', {
    params: { reception_id: receptionId, type: format },
    responseType: 'blob',
  }),
  downloadProductEntryHistoryReport: (format = 'pdf', params = {}) => api.get('/inventory/product-entries/history-report/', {
    params: { type: format, ...params },
    responseType: 'blob',
  }),
  getProductEntryAttachments: (receptionId, params = {}) => api.get('/inventory/product-entries/attachments/', {
    params: { reception_id: receptionId, ...params },
  }),
  uploadProductEntryAttachments: (receptionId, files = {}) => {
    const formData = new FormData()
    formData.append('reception_id', receptionId)
    ;(files.photos || []).forEach((file) => formData.append('photos', file))
    ;(files.documents || []).forEach((file) => formData.append('documents', file))
    ;(files.signedReceipt || []).forEach((file) => formData.append('signed_receipt', file))

    return api.post('/inventory/product-entries/upload_attachments/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  uploadSignedReceipt: (receptionId, files = []) => {
    const formData = new FormData()
    formData.append('reception_id', receptionId)
    ;(files || []).forEach((file) => formData.append('signed_receipt', file))

    return api.post('/inventory/product-entries/upload_signed_receipt/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export const getMediaUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${API_URL.replace('/api/v1', '')}${path}`
}
