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
  const [errors, setErrors] = useState({})
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
    setErrors((current) => ({ ...current, [name]: undefined }))
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const errs = {}
    if (!formData.name.trim())  errs.name  = 'El nombre completo es obligatorio'
    if (!formData.email.trim()) errs.email = 'El correo es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Formato de correo inválido'
    if (!formData.role)         errs.role  = 'Seleccione un rol'
    if (!isEditing && !formData.password)         errs.password = 'La contraseña es obligatoria para nuevos usuarios'
    if (!isEditing && formData.password && formData.password.length < 8) errs.password = 'La contraseña debe tener al menos 8 caracteres'

    if (Object.keys(errs).length) {
      setErrors(errs)
      toast.error('Corrija los campos marcados antes de continuar')
      return
    }

    setErrors({})
    try {
      const payload = { ...formData }
      if (isEditing) {
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
      const responseErrors = error.response?.data
      if (responseErrors && typeof responseErrors === 'object' && !responseErrors.detail) {
        const fieldErrors = Object.fromEntries(
          Object.entries(responseErrors).map(([field, messages]) => [
            field,
            Array.isArray(messages) ? messages.join(' ') : String(messages),
          ]),
        )
        setErrors(fieldErrors)
        toast.error('Revise los campos señalados en el formulario')
      } else {
        toast.error(responseErrors?.detail || 'No se pudo guardar el usuario. Intente nuevamente.')
      }
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
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${errors.name ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'}`}
            />
            {errors.name && <p id="name-error" className="mt-1.5 text-sm text-red-600">{errors.name}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Correo electrónico</label>
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'email-error' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${errors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'}`}
            />
            {errors.email && <p id="email-error" className="mt-1.5 text-sm text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Rol</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              aria-invalid={Boolean(errors.role)}
              aria-describedby={errors.role ? 'role-error' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${errors.role ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'}`}
            >
              {roleOptions.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            {errors.role && <p id="role-error" className="mt-1.5 text-sm text-red-600">{errors.role}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">ID de agente / Matrícula</label>
            <input
              name="agent_id"
              value={formData.agent_id}
              onChange={handleChange}
              aria-invalid={Boolean(errors.agent_id)}
              aria-describedby={errors.agent_id ? 'agent-id-error' : undefined}
              className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${errors.agent_id ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'}`}
            />
            {errors.agent_id && <p id="agent-id-error" className="mt-1.5 text-sm text-red-600">{errors.agent_id}</p>}
          </div>

          {!isEditing && (
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Contraseña temporal</label>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                required
                aria-invalid={Boolean(errors.password)}
                aria-describedby={errors.password ? 'password-error password-help' : 'password-help'}
                className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${errors.password ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'}`}
              />
              {errors.password && <p id="password-error" className="mt-1.5 text-sm text-red-600">{errors.password}</p>}
              <p id="password-help" className="mt-1 text-xs text-gray-500">
                El usuario deberá reemplazarla cuando inicie sesión por primera vez.
              </p>
            </div>
          )}

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
