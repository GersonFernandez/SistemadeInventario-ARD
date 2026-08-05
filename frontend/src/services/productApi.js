import api from './api'

export const productApi = {
  getItems: (params = {}) => api.get('/products/items/', { params }),
  getItem: (id) => api.get(`/products/items/${id}/`),
  createItem: (formData) => api.post('/products/items/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateItem: (id, data) => api.patch(`/products/items/${id}/`, data),
  deleteItem: (id) => api.delete(`/products/items/${id}/`),

  getCategories: () => api.get('/products/categories/'),
  createCategory: (data) => api.post('/products/categories/', data),

  getBrands: (params = {}) => api.get('/products/brands/', { params }),
  createBrand: (data) => api.post('/products/brands/', data),
  updateBrand: (id, data) => api.patch(`/products/brands/${id}/`, data),
  deleteBrand: (id) => api.patch(`/products/brands/${id}/`, { is_active: false }),
  reactivateBrand: (id) => api.patch(`/products/brands/${id}/`, { is_active: true }),

  getProductModels: (params = {}) => api.get('/products/product-models/', { params }),
  createProductModel: (data) => api.post('/products/product-models/', data),
  updateProductModel: (id, data) => api.patch(`/products/product-models/${id}/`, data),
  deleteProductModel: (id) => api.patch(`/products/product-models/${id}/`, { is_active: false }),
  reactivateProductModel: (id) => api.patch(`/products/product-models/${id}/`, { is_active: true }),

  getProductStates: (params = {}) => api.get('/products/product-states/', { params }),
  createProductState: (data) => api.post('/products/product-states/', data),
  updateProductState: (id, data) => api.patch(`/products/product-states/${id}/`, data),
  deleteProductState: (id) => api.patch(`/products/product-states/${id}/`, { is_active: false }),
  reactivateProductState: (id) => api.patch(`/products/product-states/${id}/`, { is_active: true }),

  getUnitMeasures: (params = {}) => api.get('/products/unit-measures/', { params }),
  createUnitMeasure: (data) => api.post('/products/unit-measures/', data),
  updateUnitMeasure: (id, data) => api.patch(`/products/unit-measures/${id}/`, data),
  deleteUnitMeasure: (id) => api.patch(`/products/unit-measures/${id}/`, { is_active: false }),
  reactivateUnitMeasure: (id) => api.patch(`/products/unit-measures/${id}/`, { is_active: true }),

  getLocations: (params = {}) => api.get('/products/locations/', { params }),
}
