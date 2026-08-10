import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import { rolePermissionApi } from '../services/rolePermissionApi'

const permissionGroups = [
  {
    title: 'Administración',
    items: [
      { key: 'users.manage', label: 'Gestionar usuarios' },
      { key: 'roles.manage', label: 'Gestionar roles y permisos' },
      { key: 'audit.view', label: 'Ver auditoría' },
    ],
  },
  {
    title: 'Inventario y Catálogos',
    items: [
      { key: 'inventory.view', label: 'Ver inventario' },
      { key: 'inventory.manage', label: 'Gestionar inventario' },
      { key: 'products.view', label: 'Ver productos' },
      { key: 'products.manage', label: 'Gestionar productos' },
      { key: 'locations.view', label: 'Ver ubicaciones' },
      { key: 'locations.manage', label: 'Gestionar ubicaciones' },
      { key: 'catalogs.view', label: 'Ver catálogos' },
      { key: 'catalogs.manage', label: 'Gestionar catálogos' },
    ],
  },
  {
    title: 'Operaciones',
    items: [
      { key: 'service_orders.view', label: 'Ver órdenes de servicio' },
      { key: 'service_orders.manage', label: 'Gestionar órdenes de servicio' },
      { key: 'reception.view', label: 'Ver recepciones' },
      { key: 'reception.manage', label: 'Gestionar recepciones' },
      { key: 'despachos.view', label: 'Ver despachos' },
      { key: 'despachos.manage', label: 'Gestionar despachos' },
      { key: 'solicitantes.view', label: 'Ver solicitantes' },
      { key: 'solicitantes.manage', label: 'Gestionar solicitantes' },
      { key: 'reports.export', label: 'Exportar reportes' },
    ],
  },
]

function normalizeRoleOrder(rows) {
  const rank = { admin: 0, almacenista: 1, tecnico: 2 }
  return [...rows].sort((a, b) => (rank[a.role] ?? 99) - (rank[b.role] ?? 99))
}

export default function RolePermissionsPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingRoleId, setSavingRoleId] = useState(null)

  useEffect(() => {
    loadPermissions()
  }, [])

  const loadPermissions = async () => {
    setLoading(true)
    try {
      const { data } = await rolePermissionApi.list()
      setRows(normalizeRoleOrder(data.results || data))
    } catch (error) {
      toast.error('No se pudieron cargar los permisos por rol')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const matrixRows = useMemo(() => {
    return permissionGroups.flatMap((group) => [
      { type: 'group', key: `group:${group.title}`, title: group.title },
      ...group.items.map((item) => ({ type: 'perm', ...item })),
    ])
  }, [])

  const togglePermission = (roleId, permissionKey) => {
    setRows((prev) => prev.map((row) => {
      if (row.id !== roleId) return row
      return {
        ...row,
        permissions: {
          ...row.permissions,
          [permissionKey]: !Boolean(row.permissions?.[permissionKey]),
        },
      }
    }))
  }

  const handleSave = async (row) => {
    setSavingRoleId(row.id)
    try {
      await rolePermissionApi.update(row.id, { permissions: row.permissions })
      toast.success(`Permisos actualizados para ${row.role_label}`)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo guardar la configuración')
      await loadPermissions()
    } finally {
      setSavingRoleId(null)
    }
  }

  if (loading) {
    return <p className="text-gray-600">Cargando permisos por rol...</p>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-100 bg-gradient-to-r from-brand-900 to-brand-700 p-6 text-white shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-100">Administración de seguridad</p>
        <h2 className="mt-2 text-3xl font-bold">Roles y permisos</h2>
        <p className="mt-2 max-w-3xl text-sm text-brand-100">
          Visualice y configure los permisos operativos por rol para cada módulo del sistema.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">Permiso</th>
                {rows.map((row) => (
                  <th key={row.id} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    {row.role_label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {matrixRows.map((entry) => {
                if (entry.type === 'group') {
                  return (
                    <tr key={entry.key} className="bg-gray-50/80">
                      <td colSpan={rows.length + 1} className="px-6 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                        {entry.title}
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr key={entry.key} className="hover:bg-gray-50">
                    <td className="px-6 py-3 text-sm text-gray-800">{entry.label}</td>
                    {rows.map((row) => {
                      const checked = Boolean(row.permissions?.[entry.key])
                      return (
                        <td key={`${row.id}-${entry.key}`} className="px-4 py-3 text-center">
                          <label className="inline-flex cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePermission(row.id, entry.key)}
                              className="h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-700"
                            />
                          </label>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {rows.map((row) => {
          const granted = Object.values(row.permissions || {}).filter(Boolean).length
          const total = Object.keys(row.permissions || {}).length
          const saving = savingRoleId === row.id
          return (
            <div key={`card-${row.id}`} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-brand-700" />
                <h3 className="text-sm font-semibold text-gray-900">{row.role_label}</h3>
              </div>
              <p className="mt-1 text-xs text-gray-500">Permisos activos: {granted} de {total}</p>
              <button
                type="button"
                onClick={() => handleSave(row)}
                disabled={saving}
                className="mt-3 w-full rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
