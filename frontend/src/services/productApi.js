import api from './api'

export const productApi = {
  getItems: (params = {}) => api.get('/products/items/', { params }),
  getItem: (id) => api.get(`/products/items/${id}/`),
  createItem: (formData) => api.post('/products/items/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),

  getCategories: () => api.get('/products/categories/'),
  createCategory: (data) => api.post('/products/categories/', data),

  getBrands: (params = {}) => api.get('/products/brands/', { params }),
  createBrand: (data) => api.post('/products/brands/', data),
  deleteBrand: (id) => api.delete(`/products/brands/${id}/`),

  getProductModels: (params = {}) => api.get('/products/product-models/', { params }),
  createProductModel: (data) => api.post('/products/product-models/', data),
  deleteProductModel: (id) => api.delete(`/products/product-models/${id}/`),

  getProductStates: (params = {}) => api.get('/products/product-states/', { params }),
  createProductState: (data) => api.post('/products/product-states/', data),
  deleteProductState: (id) => api.delete(`/products/product-states/${id}/`),

  getLocations: (params = {}) => api.get('/products/locations/', { params }),
}
