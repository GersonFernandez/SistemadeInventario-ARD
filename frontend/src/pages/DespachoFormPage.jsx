import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { TrashIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { despachoApi } from '../services/workOrderApi'
import { inventoryApi } from '../services/inventoryApi'
import SolicitantePicker from '../components/SolicitantePicker'
import ItemSelector from '../components/ItemSelector'
import { useAuth } from '../context/AuthContext'

export default function DespachoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [solicitante, setSolicitante] = useState(null)
  const [unit, setUnit] = useState('')
  const [equipmentReference, setEquipmentReference] = useState('')
  const [notes, setNotes] = useState('')
  const [lineas, setLineas] = useState([])
  const [locations, setLocations] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    inventoryApi.getLocations().then((r) => setLocations(r.data.results || r.data))
  }, [])

  const handleAddItem = ({ item, quantity, item_unit_id }) => {
    if (lineas.some((l) => l.item.id === item.id && l.item_unit_id === item_unit_id)) {
      toast.error('Este artículo ya está agregado al despacho.')
      return
    }
    setLineas([
      ...lineas,
      {
        key: `${item.id}-${item_unit_id || 'qty'}-${Date.now()}`,
        item,
        quantity,
        item_unit_id,
      },
    ])
    toast.success('Artículo agregado')
  }

  const handleRemoveLinea = (key) => {
    setLineas(lineas.filter((l) => l.key !== key))
  }

  const handleSubmit = async () => {
    if (!solicitante) {
      toast.error('Debe seleccionar un solicitante.')
      return
    }
    if (lineas.length === 0) {
      toast.error('Debe agregar al menos un artículo al despacho.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        solicitante_id: solicitante.id,
        unit_id: unit || null,
        equipment_reference: equipmentReference,
        notes,
        items: lineas.map((l) => ({
          item_id: l.item.id,
          quantity: l.quantity,
          item_unit_id: l.item_unit_id,
          notes: '',
        })),
      }
      const { data } = await despachoApi.createDespacho(payload)
      toast.success(`Despacho ${data.ot_number} creado exitosamente`)
      navigate(`/despachos/${data.id}`)
    } catch (err) {
      const data = err.response?.data
      const msg = typeof data?.detail === 'string' ? data.detail : JSON.stringify(data)
      toast.error(msg || 'Error al crear el despacho')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Nuevo Despacho</h2>
        <button
          onClick={() => navigate('/workorders')}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Información del despacho</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Solicitante *</label>
            <SolicitantePicker value={solicitante} onChange={setSolicitante} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Unidad / Base del solicitante</label>
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">— Sin unidad específica —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.breadcrumb || loc.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Entregado por</label>
            <input
              type="text"
              value={user?.name || ''}
              disabled
              className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
            />
            <p className="mt-1 text-xs text-gray-500">Usuario logueado — no se puede modificar.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Referencia del equipo (opcional)</label>
            <input
              type="text"
              value={equipmentReference}
              onChange={(e) => setEquipmentReference(e.target.value)}
              placeholder="Ej: Repuestos para radar AN/SPS-67"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Artículos a despachar</h3>
        <ItemSelector onSelect={handleAddItem} />

        {lineas.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Artículo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Tipo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Serial / Detalle</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Cantidad</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {lineas.map((l) => (
                  <tr key={l.key}>
                    <td className="px-4 py-2 text-sm">
                      <p className="font-medium text-gray-900">{l.item.name}</p>
                      <p className="text-xs text-gray-500">{l.item.code}</p>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{l.item.kind_display}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {l.item_unit_id
                        ? (l.item.units?.find?.((u) => u.id === l.item_unit_id)?.serial_number || `Unit #${l.item_unit_id}`)
                        : '—'}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{l.quantity}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemoveLinea(l.key)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => navigate('/workorders')}
          className="rounded-md border border-gray-300 bg-white px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-md bg-brand-800 px-5 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {submitting ? 'Despachando...' : 'Confirmar Despacho'}
        </button>
      </div>
    </div>
  )
}
