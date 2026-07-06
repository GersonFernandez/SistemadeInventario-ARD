import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { inventoryApi } from '../services/inventoryApi'

const emptyForm = { name: '', description: '' }

export default function BrandsMaintenancePage() {
  const [brands, setBrands] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadBrands()
  }, [])

  const loadBrands = async () => {
    try {
      const { data } = await inventoryApi.getBrands()
      setBrands(data.results || data)
    } catch {
      toast.error('No se pudieron cargar las marcas')
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
      if (editingId) {
        await inventoryApi.updateBrand(editingId, form)
        toast.success('Marca actualizada')
      } else {
        await inventoryApi.createBrand(form)
        toast.success('Marca creada')
      }
      resetForm()
      loadBrands()
    } catch {
      toast.error('No se pudo guardar la marca')
    } finally {
      setSaving(false)
    }
  }

  const editBrand = (brand) => {
    setEditingId(brand.id)
    setForm({ name: brand.name || '', description: brand.description || '' })
  }

  const disableBrand = async (id) => {
    try {
      await inventoryApi.deleteBrand(id)
      toast.success('Marca deshabilitada')
      loadBrands()
      if (editingId === id) resetForm()
    } catch {
      toast.error('No se pudo deshabilitar la marca')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mantenimiento de Marcas</h2>
        <p className="mt-1 text-sm text-gray-600">Agregar, editar y deshabilitar marcas.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3 max-w-2xl">
        <div>
          <label className="text-xs font-semibold text-gray-600">Nombre</label>
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
            {saving ? 'Guardando...' : editingId ? 'Actualizar marca' : 'Crear marca'}
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
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Descripción</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-2 text-right" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {brands.map((brand) => (
              <tr key={brand.id}>
                <td className="px-4 py-2 text-sm text-gray-900">{brand.name}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{brand.description || '—'}</td>
                <td className="px-4 py-2 text-sm">{brand.is_active ? 'Activa' : 'Inactiva'}</td>
                <td className="px-4 py-2 text-right text-sm">
                  <button onClick={() => editBrand(brand)} className="text-brand-700 hover:text-brand-900">Editar</button>
                  {brand.is_active && (
                    <button onClick={() => disableBrand(brand.id)} className="ml-4 text-red-600 hover:text-red-900">Deshabilitar</button>
                  )}
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-4 text-sm text-gray-500">Sin marcas.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
