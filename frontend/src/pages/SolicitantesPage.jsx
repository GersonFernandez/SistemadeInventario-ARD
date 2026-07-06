import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { solicitanteApi } from '../services/workOrderApi'
import { inventoryApi } from '../services/inventoryApi'

const emptyForm = {
  name: '',
  rank: '',
  agent_id: '',
  unit: '',
  notes: '',
  is_active: true,
}

export default function SolicitantesPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [solicitantes, setSolicitantes] = useState([])
  const [locations, setLocations] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    fetchAll()
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [solRes, locRes] = await Promise.all([
        solicitanteApi.list({ is_active: 'true' }),
        inventoryApi.getLocations(),
      ])
      setSolicitantes(solRes.data || [])
      setLocations(locRes.data.results || locRes.data)
    } catch (error) {
      toast.error('No se pudo cargar la información de solicitantes')
    } finally {
      setLoading(false)
    }
  }

  const startEdit = async (id) => {
    try {
      const { data } = await solicitanteApi.get(id)
      setEditingId(id)
      setForm({
        name: data.name || '',
        rank: data.rank || '',
        agent_id: data.agent_id || '',
        unit: data.unit || '',
        notes: data.notes || '',
        is_active: data.is_active,
      })
    } catch {
      toast.error('No se pudo cargar el solicitante')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const submitForm = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form }
      if (!payload.unit) payload.unit = null
      if (editingId) {
        await solicitanteApi.update(editingId, payload)
        toast.success('Solicitante actualizado')
      } else {
        await solicitanteApi.create(payload)
        toast.success('Solicitante creado')
      }
      resetForm()
      fetchAll()
    } catch (error) {
      const data = error.response?.data
      const msg = data?.detail || Object.values(data || {}).flat().join(', ') || 'Error al guardar'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const disableSolicitante = async (id) => {
    if (!confirm('¿Desea deshabilitar este solicitante?')) return
    try {
      await solicitanteApi.disable(id)
      toast.success('Solicitante deshabilitado')
      fetchAll()
    } catch {
      toast.error('No se pudo deshabilitar el solicitante')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Solicitantes</h2>
        <p className="mt-1 text-sm text-gray-600">Gestión de solicitantes para despachos y préstamos.</p>
      </div>

      <form onSubmit={submitForm} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-semibold text-gray-800">{editingId ? 'Editar solicitante' : 'Nuevo solicitante'}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre completo"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={form.rank}
            onChange={(e) => setForm({ ...form, rank: e.target.value })}
            placeholder="Rango/Grado"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={form.agent_id}
            onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
            placeholder="Cédula o ID"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={form.unit}
            onChange={(e) => setForm({ ...form, unit: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Sin ubicación</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.breadcrumb || loc.name}</option>
            ))}
          </select>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={2}
            placeholder="Notas"
            className="md:col-span-2 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-600">Cargando...</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Nombre</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Ubicación</th>
                <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {solicitantes.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-sm text-gray-900">{s.rank ? `${s.rank} ` : ''}{s.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{s.agent_id || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{s.unit_name || '—'}</td>
                  <td className="px-4 py-2 text-right text-sm">
                    <button onClick={() => startEdit(s.id)} className="text-brand-700 hover:text-brand-900">Editar</button>
                    <button onClick={() => disableSolicitante(s.id)} className="ml-4 text-red-600 hover:text-red-900">Deshabilitar</button>
                  </td>
                </tr>
              ))}
              {solicitantes.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">No hay solicitantes activos.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
