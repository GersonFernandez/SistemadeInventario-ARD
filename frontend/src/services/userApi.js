import api from './api'

export const userApi = {
  getUsers: (params = {}) => api.get('/users/', { params }),
  getUser: (id) => api.get(`/users/${id}/`),
  createUser: (data) => api.post('/users/', data),
  updateUser: (id, data) => api.put(`/users/${id}/`, data),
  deleteUser: (id) => api.delete(`/users/${id}/`),

  changeMyPassword: (data) => api.post('/auth/change-password/', data),
  adminResetPassword: (userId) => api.post('/auth/admin-reset-password/', { user_id: userId }),
  getSessionSetting: () => api.get('/settings/session/'),
  updateSessionSetting: (data) => api.put('/settings/session/', data),
}
