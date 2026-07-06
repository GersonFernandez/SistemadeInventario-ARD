import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { inventoryApi } from '../services/inventoryApi'

export default function RepairsPage() {
  const [items, setItems] = useState([])
  const [repairs, setRepairs] = useState([])
  const [form, setForm] = useState({ item: '', details: '' })

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [i, r] = await Promise.all([inventoryApi.getItems(), inventoryApi.getRepairs()])
      setItems(i.data.results || i.data)
      setRepairs(r.data.results || r.data)
    } catch {
      toast.error('No se pudo cargar reparaciones')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      await inventoryApi.createRepair(form)
      setForm({ item: '', details: '' })
      toast.success('Reparación registrada')
      loadAll()
    } catch {
      toast.error('No se pudo registrar la reparación')
    }
  }

  const disable = async (id) => {
    try {
      await inventoryApi.deleteRepair(id)
      toast.success('Reparación deshabilitada')
      loadAll()
    } catch {
      toast.error('No se pudo deshabilitar')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reparaciones</h2>
        <p className="mt-1 text-sm text-gray-600">Registro histórico de reparaciones por producto.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-2 max-w-2xl">
        <select className="w-full rounded border px-3 py-2 text-sm" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} required>
          <option value="">Seleccione producto</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <textarea className="w-full rounded border px-3 py-2 text-sm" rows={3} placeholder="Detalle de la reparación" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} required />
        <button className="rounded bg-brand-800 px-3 py-2 text-sm text-white">Guardar reparación</button>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Producto</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Técnico</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Detalle</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {repairs.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-sm text-gray-900">{r.item_name}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{r.technician_name}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{r.details}</td>
                <td className="px-4 py-2 text-sm">{r.is_active ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-2 text-right">
                  {r.is_active && <button onClick={() => disable(r.id)} className="text-xs text-red-600">Deshabilitar</button>}
                </td>
              </tr>
            ))}
            {repairs.length === 0 && (
              <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={5}>Sin reparaciones.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
