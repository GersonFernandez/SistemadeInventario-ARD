import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PlusIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { userApi } from '../services/userApi'

const roleLabels = {
  admin: 'Administrador',
  almacenista: 'Encargado de Inventario',
  tecnico: 'Técnico',
}

const roleColors = {
  admin: 'bg-purple-100 text-purple-800',
  almacenista: 'bg-blue-100 text-blue-800',
  tecnico: 'bg-green-100 text-green-800',
}

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('true')
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(15)
  const [savingSession, setSavingSession] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchSessionSetting()
  }, [roleFilter, statusFilter])

  const fetchUsers = async (overrides = {}) => {
    setLoading(true)
    try {
      const effectiveSearch = overrides.search ?? search
      const effectiveRole = overrides.roleFilter ?? roleFilter
      const effectiveStatus = overrides.statusFilter ?? statusFilter
      const params = { page_size: 100 }
      if (effectiveSearch.trim()) params.search = effectiveSearch.trim()
      if (effectiveRole) params.role = effectiveRole
      if (effectiveStatus !== '') params.is_active = effectiveStatus
      const { data } = await userApi.getUsers(params)
      setUsers(data.results || data)
    } catch (error) {
      toast.error('Error al cargar usuarios')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => fetchUsers()

  const handleReset = () => {
    setSearch('')
    setRoleFilter('')
    setStatusFilter('true')
    fetchUsers({ search: '', roleFilter: '', statusFilter: 'true' })
  }

  const fetchSessionSetting = async () => {
    try {
      const { data } = await userApi.getSessionSetting()
      setSessionTimeoutMinutes(data.session_timeout_minutes)
    } catch (error) {
      console.error('Error al cargar configuración de sesión', error)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Desea deshabilitar este usuario?')) return
    try {
      await userApi.deleteUser(id)
      toast.success('Usuario deshabilitado')
      fetchUsers()
    } catch (error) {
      toast.error('Error al deshabilitar el usuario')
    }
  }

  const handleResetPassword = async (id) => {
    if (!confirm('Se enviará una contraseña temporal al correo del usuario. ¿Continuar?')) return
    try {
      await userApi.adminResetPassword(id)
      toast.success('Contraseña temporal enviada por correo.')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo restablecer la contraseña')
    }
  }

  const handleSaveSessionTimeout = async () => {
    setSavingSession(true)
    try {
      await userApi.updateSessionSetting({ session_timeout_minutes: Number(sessionTimeoutMinutes) })
      localStorage.setItem('sessionTimeoutMinutes', String(sessionTimeoutMinutes))
      toast.success('Tiempo de sesión actualizado')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo actualizar la sesión')
    } finally {
      setSavingSession(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Usuarios</h2>
        <Link
          to="/users/new"
          className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo usuario
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar por nombre, correo o cédula..."
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos los roles</option>
            <option value="admin">Administrador</option>
            <option value="almacenista">Encargado de Inventario</option>
            <option value="tecnico">Técnico</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
            <option value="">Todos</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleSearch} className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">Filtrar</button>
            <button onClick={handleReset} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <ArrowPathIcon className="h-4 w-4" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-800">Configuración de sesión</h3>
        <p className="mt-1 text-xs text-gray-500">Minutos de inactividad antes de cerrar sesión automáticamente.</p>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min="5"
            max="240"
            value={sessionTimeoutMinutes}
            onChange={(e) => setSessionTimeoutMinutes(e.target.value)}
            className="w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={handleSaveSessionTimeout}
            disabled={savingSession}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {savingSession ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-600">Cargando...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Nombre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Correo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Estado
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {user.name}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${roleColors[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {!user.is_active
                      ? 'Inactivo'
                      : user.must_change_password
                        ? 'Cambio de contraseña pendiente'
                        : 'Activo'}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <Link
                      to={`/users/${user.id}/edit`}
                      className="text-brand-700 hover:text-brand-900"
                    >
                      Editar
                    </Link>
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      className="ml-4 text-amber-600 hover:text-amber-900"
                    >
                      Reset contraseña
                    </button>
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="ml-4 text-red-600 hover:text-red-900"
                    >
                      Deshabilitar
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-gray-500"
                  >
                    No se encontraron usuarios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
