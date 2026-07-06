import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { inventoryApi } from '../services/inventoryApi'

export default function InstallationsPage() {
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [installations, setInstallations] = useState([])
  const [form, setForm] = useState({ item: '', location: '', notes: '' })

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [i, l, ins] = await Promise.all([
        inventoryApi.getItems(),
        inventoryApi.getLocations(),
        inventoryApi.getInstallations(),
      ])
      setItems(i.data.results || i.data)
      setLocations(l.data.results || l.data)
      setInstallations(ins.data.results || ins.data)
    } catch {
      toast.error('No se pudieron cargar instalaciones')
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    try {
      await inventoryApi.createInstallation(form)
      setForm({ item: '', location: '', notes: '' })
      toast.success('Instalación registrada')
      loadAll()
    } catch {
      toast.error('No se pudo registrar la instalación')
    }
  }

  const disable = async (id) => {
    try {
      await inventoryApi.deleteInstallation(id)
      toast.success('Instalación deshabilitada')
      loadAll()
    } catch {
      toast.error('No se pudo deshabilitar')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Instalaciones</h2>
        <p className="mt-1 text-sm text-gray-600">Salida de producto con registro de instalación por ubicación.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-2 max-w-2xl">
        <select className="w-full rounded border px-3 py-2 text-sm" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} required>
          <option value="">Seleccione producto</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select className="w-full rounded border px-3 py-2 text-sm" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required>
          <option value="">Seleccione ubicación</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.breadcrumb || l.name}</option>)}
        </select>
        <textarea className="w-full rounded border px-3 py-2 text-sm" rows={2} placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        <button className="rounded bg-brand-800 px-3 py-2 text-sm text-white">Registrar instalación</button>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Producto</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Técnico</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Ubicación</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {installations.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 text-sm text-gray-900">{r.item_name}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{r.technician_name}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{r.location_name}</td>
                <td className="px-4 py-2 text-sm">{r.is_active ? 'Activo' : 'Inactivo'}</td>
                <td className="px-4 py-2 text-right">
                  {r.is_active && <button onClick={() => disable(r.id)} className="text-xs text-red-600">Deshabilitar</button>}
                </td>
              </tr>
            ))}
            {installations.length === 0 && (
              <tr><td className="px-4 py-4 text-sm text-gray-500" colSpan={5}>Sin instalaciones.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
