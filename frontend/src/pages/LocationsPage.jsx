import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { PlusIcon, PencilIcon, TrashIcon, MapPinIcon, TagIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { inventoryApi } from '../services/inventoryApi'
import { useAuth } from '../context/AuthContext'
import LocationTypePicker from '../components/LocationTypePicker'
import { hasPermission } from '../utils/permissions'

const typeBadgeClass = (code) => {
  const map = {
    taller: 'bg-indigo-100 text-indigo-800',
    base_naval: 'bg-blue-100 text-blue-800',
    unidad_naval: 'bg-cyan-100 text-cyan-800',
    comandancia: 'bg-purple-100 text-purple-800',
    destacamento: 'bg-amber-100 text-amber-800',
  }
  return map[code] || 'bg-gray-100 text-gray-800'
}

export default function LocationsPage() {
  const { user } = useAuth()
  const canEdit = hasPermission(user, 'locations.manage', ['admin', 'almacenista'])
  const [tab, setTab] = useState('ubicaciones')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Ubicaciones</h2>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTab('ubicaciones')}
            className={`flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium ${
              tab === 'ubicaciones'
                ? 'border-brand-800 text-brand-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <MapPinIcon className="h-4 w-4" />
            Ubicaciones
          </button>
          <button
            onClick={() => setTab('tipos')}
            className={`flex items-center gap-2 border-b-2 px-1 py-2 text-sm font-medium ${
              tab === 'tipos'
                ? 'border-brand-800 text-brand-900'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <TagIcon className="h-4 w-4" />
            Tipos de ubicación
          </button>
        </nav>
      </div>

      {tab === 'ubicaciones' && <UbicacionesTab canEdit={canEdit} />}
      {tab === 'tipos' && <TiposTab canEdit={canEdit} />}
    </div>
  )
}


function UbicacionesTab({ canEdit }) {
  const [locations, setLocations] = useState([])
  const [locationTypes, setLocationTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState(null)
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [formData, setFormData] = useState({ name: '', codigo: '', location_type: null })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchLocations()
    fetchTypes()
  }, [])

  const fetchLocations = async () => {
    setLoading(true)
    try {
      const { data } = await inventoryApi.getLocations()
      setLocations(data.results || data)
    } catch (err) {
      toast.error('Error al cargar ubicaciones')
    } finally {
      setLoading(false)
    }
  }

  const fetchTypes = async () => {
    try {
      const { data } = await inventoryApi.getLocationTypes()
      setLocationTypes(data || [])
    } catch (err) {
      console.error(err)
    }
  }

  const openCreateModal = () => {
    setEditingLocation(null)
    const firstType = locationTypes[0]
    setFormData({ name: '', codigo: '', location_type: firstType ? firstType.id : null })
    setModalOpen(true)
  }

  const openEditModal = (location) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      codigo: location.codigo || '',
      location_type: location.location_type,
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    if (!formData.location_type) {
      toast.error('Debe seleccionar un tipo de ubicación')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: formData.name,
        codigo: formData.codigo || '',
        location_type: formData.location_type,
      }
      if (editingLocation) {
        await inventoryApi.updateLocation(editingLocation.id, payload)
        toast.success('Ubicación actualizada')
      } else {
        await inventoryApi.createLocation(payload)
        toast.success('Ubicación creada')
      }
      setModalOpen(false)
      fetchLocations()
    } catch (err) {
      const detail = err.response?.data
      toast.error(typeof detail === 'object' ? JSON.stringify(detail) : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (location) => {
    if (!confirm(`¿Eliminar la ubicación "${location.name}"?`)) return
    try {
      await inventoryApi.deleteLocation(location.id)
      toast.success('Ubicación eliminada')
      fetchLocations()
    } catch (err) {
      const detail = err.response?.data?.detail || 'Error al eliminar'
      toast.error(detail)
    }
  }

  const filtered = locations.filter((loc) => {
    if (typeFilter && loc.location_type !== parseInt(typeFilter)) return false
    if (search && !loc.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <>
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            <PlusIcon className="h-4 w-4" />
            Nueva ubicación
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Buscar ubicación..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          {locationTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-gray-600">Cargando...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Padre</th>
                {canEdit && (
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map((loc) => {
                const parent = locations.find((l) => l.id === loc.parent)
                return (
                  <tr key={loc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{loc.name}</td>
                    <td className="px-6 py-4 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadgeClass(loc.type_code)}`}>
                        {loc.type_display}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-mono">{loc.codigo || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{parent ? parent.name : '—'}</td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <button
                          onClick={() => openEditModal(loc)}
                          className="text-brand-700 hover:text-brand-900"
                        >
                          <PencilIcon className="h-4 w-4 inline" />
                        </button>
                        <button
                          onClick={() => handleDelete(loc)}
                          className="ml-3 text-red-600 hover:text-red-900"
                        >
                          <TrashIcon className="h-4 w-4 inline" />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-6 py-8 text-center text-sm text-gray-500">
                    No hay ubicaciones que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingLocation ? 'Editar ubicación' : 'Nueva ubicación'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Tipo de ubicación *</label>
                <select
                  value={formData.location_type || ''}
                  onChange={(e) => setFormData({ ...formData, location_type: parseInt(e.target.value) || null })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">— Seleccione —</option>
                  {locationTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Código (opcional)</label>
                <input
                  type="text"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}


function TiposTab({ canEdit }) {
  const [types, setTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingType, setEditingType] = useState(null)
  const [formData, setFormData] = useState({ code: '', name: '', description: '', is_active: true })
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchTypes()
  }, [])

  const fetchTypes = async () => {
    setLoading(true)
    try {
      const { data } = await inventoryApi.getLocationTypes()
      setTypes(data || [])
    } catch (err) {
      toast.error('Error al cargar tipos')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    setEditingType(null)
    setFormData({ code: '', name: '', description: '', is_active: true })
    setModalOpen(true)
  }

  const openEditModal = (t) => {
    setEditingType(t)
    setFormData({
      code: t.code,
      name: t.name,
      description: t.description || '',
      is_active: t.is_active,
    })
    setModalOpen(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.code.trim() || !formData.name.trim()) {
      toast.error('Código y nombre son obligatorios')
      return
    }
    setSaving(true)
    try {
      if (editingType) {
        await inventoryApi.updateLocationType(editingType.id, formData)
        toast.success('Tipo actualizado')
      } else {
        await inventoryApi.createLocationType(formData)
        toast.success('Tipo creado')
      }
      setModalOpen(false)
      fetchTypes()
    } catch (err) {
      const detail = err.response?.data
      toast.error(typeof detail === 'object' ? JSON.stringify(detail) : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (t) => {
    if (!confirm(`¿Eliminar el tipo "${t.name}"? Si tiene ubicaciones asociadas, no se podrá eliminar.`)) return
    try {
      await inventoryApi.deleteLocationType(t.id)
      toast.success('Tipo eliminado')
      fetchTypes()
    } catch (err) {
      const detail = err.response?.data?.detail || 'Error al eliminar'
      toast.error(detail)
    }
  }

  return (
    <>
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo tipo
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-gray-600">Cargando...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Código</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Descripción</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ubicaciones</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Activo</th>
                {canEdit && (
                  <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {types.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900">{t.code}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${typeBadgeClass(t.code)}`}>
                      {t.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{t.description || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{t.locations_count ?? '—'}</td>
                  <td className="px-6 py-4 text-sm">
                    {t.is_active ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Sí</span>
                    ) : (
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">No</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <button onClick={() => openEditModal(t)} className="text-brand-700 hover:text-brand-900">
                        <PencilIcon className="h-4 w-4 inline" />
                      </button>
                      <button onClick={() => handleDelete(t)} className="ml-3 text-red-600 hover:text-red-900">
                        <TrashIcon className="h-4 w-4 inline" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {types.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 6 : 5} className="px-6 py-8 text-center text-sm text-gray-500">
                    No hay tipos registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingType ? 'Editar tipo' : 'Nuevo tipo'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700">Código *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  disabled={!!editingType}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono disabled:bg-gray-100"
                />
                {editingType && <p className="mt-1 text-xs text-gray-500">El código no se puede editar.</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Nombre *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Descripción</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Activo</span>
                </label>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
