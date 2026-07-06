import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { inventoryApi } from '../services/inventoryApi'

const emptyForm = { brand: '', name: '', description: '' }

export default function ModelsMaintenancePage() {
  const [models, setModels] = useState([])
  const [brands, setBrands] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  const activeBrands = useMemo(() => brands.filter((b) => b.is_active), [brands])

  const loadAll = async () => {
    try {
      const [mRes, bRes] = await Promise.all([
        inventoryApi.getProductModels(),
        inventoryApi.getBrands(),
      ])
      setModels(mRes.data.results || mRes.data)
      setBrands(bRes.data.results || bRes.data)
    } catch {
      toast.error('No se pudo cargar el mantenimiento de modelos')
    }
  }

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, brand: Number(form.brand) }
      if (editingId) {
        await inventoryApi.updateProductModel(editingId, payload)
        toast.success('Modelo actualizado')
      } else {
        await inventoryApi.createProductModel(payload)
        toast.success('Modelo creado')
      }
      resetForm()
      loadAll()
    } catch {
      toast.error('No se pudo guardar el modelo')
    } finally {
      setSaving(false)
    }
  }

  const editModel = (model) => {
    setEditingId(model.id)
    setForm({
      brand: String(model.brand || ''),
      name: model.name || '',
      description: model.description || '',
    })
  }

  const disableModel = async (id) => {
    try {
      await inventoryApi.deleteProductModel(id)
      toast.success('Modelo deshabilitado')
      loadAll()
      if (editingId === id) resetForm()
    } catch {
      toast.error('No se pudo deshabilitar el modelo')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mantenimiento de Modelos</h2>
        <p className="mt-1 text-sm text-gray-600">Agregar, editar y deshabilitar modelos por marca.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 max-w-2xl">
        <div>
          <label className="text-xs font-semibold text-gray-600">Marca</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            required
          >
            <option value="">Seleccione una marca</option>
            {activeBrands.map((brand) => (
              <option key={brand.id} value={brand.id}>{brand.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Nombre del modelo</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Descripción</label>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <button className="rounded bg-brand-800 px-4 py-2 text-sm text-white disabled:opacity-60" disabled={saving}>
            {saving ? 'Guardando...' : editingId ? 'Actualizar modelo' : 'Crear modelo'}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="rounded border px-4 py-2 text-sm">Cancelar</button>
          )}
        </div>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Marca</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Modelo</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Descripción</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {models.map((model) => (
              <tr key={model.id}>
                <td className="px-4 py-2 text-sm text-gray-700">{model.brand_name}</td>
                <td className="px-4 py-2 text-sm text-gray-900">{model.name}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{model.description || '—'}</td>
                <td className="px-4 py-2 text-sm">{model.is_active ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-2 text-right text-sm">
                  <button onClick={() => editModel(model)} className="text-brand-700 hover:text-brand-900">Editar</button>
                  {model.is_active && (
                    <button onClick={() => disableModel(model.id)} className="ml-4 text-red-600 hover:text-red-900">Deshabilitar</button>
                  )}
                </td>
              </tr>
            ))}
            {models.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-4 text-sm text-gray-500">Sin modelos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
