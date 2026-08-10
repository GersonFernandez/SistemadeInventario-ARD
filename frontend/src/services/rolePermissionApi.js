import api from './api'

export const rolePermissionApi = {
  list: () => api.get('/role-permissions/'),
  update: (id, data) => api.patch(`/role-permissions/${id}/`, data),
}
