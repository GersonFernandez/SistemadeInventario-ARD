import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { userApi } from '../services/userApi'

const roleOptions = [
  { value: 'admin', label: 'Administrador' },
  { value: 'almacenista', label: 'Encargado de Inventario' },
  { value: 'tecnico', label: 'Técnico' },
]

export default function UserFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(isEditing)
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'tecnico',
    agent_id: '',
    password: '',
    is_active: true,
  })

  useEffect(() => {
    if (isEditing) {
      fetchUser()
    }
  }, [id])

  const fetchUser = async () => {
    try {
      const { data } = await userApi.getUser(id)
      setFormData({
        email: data.email,
        name: data.name,
        role: data.role,
        agent_id: data.agent_id || '',
        password: '',
        is_active: data.is_active,
      })
    } catch (error) {
      toast.error('Error al cargar el usuario')
      navigate('/users')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // ── Frontend validation ──
    const errs = {}
    if (!formData.name.trim())  errs.name  = 'El nombre completo es obligatorio'
    if (!formData.email.trim()) errs.email = 'El correo es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Formato de correo inválido'
    if (!formData.role)         errs.role  = 'Seleccione un rol'
    if (!isEditing && !formData.password)         errs.password = 'La contraseña es obligatoria para nuevos usuarios'
    if (!isEditing && formData.password && formData.password.length < 8) errs.password = 'La contraseña debe tener al menos 8 caracteres'
    if (isEditing && formData.password && formData.password.length < 8) errs.password = 'Si deseas cambiar la contraseña, debe tener al menos 8 caracteres'

    if (Object.keys(errs).length) {
      toast.error('Corrija los campos marcados antes de continuar')
      // surface each error as a toast so they're visible even without inline errors
      Object.values(errs).forEach((msg) => toast.error(msg, { duration: 4000 }))
      return
    }

    try {
      const payload = { ...formData }
      if (!payload.password && isEditing) {
        delete payload.password
      }

      if (isEditing) {
        await userApi.updateUser(id, payload)
        toast.success('Usuario actualizado')
      } else {
        await userApi.createUser(payload)
        toast.success('Usuario creado')
      }

      navigate('/users')
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        Object.values(error.response?.data || {}).flat().join(', ') ||
        'Error al guardar el usuario'
      toast.error(message)
    }
  }

  if (loading) {
    return <p className="text-gray-600">Cargando...</p>
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditing ? 'Editar usuario' : 'Nuevo usuario'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Rol</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            >
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ID de agente / Matrícula</label>
            <input
              name="agent_id"
              value={formData.agent_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Contraseña {isEditing && '(dejar en blanco para mantener actual)'}
            </label>
            <input
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required={!isEditing}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div className="flex items-center h-full pt-6">
            <label className="flex items-center gap-2">
              <input
                name="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-700"
              />
              <span className="text-sm text-gray-700">Usuario activo</span>
            </label>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            {isEditing ? 'Guardar cambios' : 'Crear usuario'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/users')}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}
