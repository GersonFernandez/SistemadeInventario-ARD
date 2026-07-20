import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { serviceOrderApi } from '../services/serviceOrderApi'

export default function RepairsPage() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const response = await serviceOrderApi.getServiceOrders({ service_type: 'reparacion' })
      setOrders(response.data.results || response.data)
    } catch {
      toast.error('No se pudieron cargar las órdenes de reparación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reparaciones</h2>
        <p className="mt-1 text-sm text-gray-600">
          Detalle de las órdenes de servicio clasificadas como reparación.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Órdenes de reparación</h3>
            <p className="text-xs text-gray-500">No se registran reparaciones aquí; se consultan las órdenes de servicio.</p>
          </div>
          <button type="button" onClick={loadAll} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
            Recargar
          </button>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-gray-500">Cargando...</div>
        ) : orders.length === 0 ? (
          <div className="px-4 py-6 text-sm text-gray-500">No hay órdenes de reparación registradas.</div>
        ) : (
          <div className="divide-y divide-gray-200">
            {orders.map((order) => (
              <details key={order.id} className="group open:bg-gray-50">
                <summary className="cursor-pointer list-none px-4 py-4">
                  <div className="grid gap-2 md:grid-cols-4 md:items-center">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Orden</p>
                      <p className="text-sm font-semibold text-gray-900">{order.service_number}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Equipo</p>
                      <p className="text-sm text-gray-800">{order.equipment_name_snapshot || order.equipment_name}</p>
                      <p className="text-xs text-gray-500">
                        {order.equipment_brand_snapshot || 'Sin marca'} · {order.equipment_model_snapshot || 'Sin modelo'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Serial</p>
                      <p className="text-sm text-gray-800">{order.equipment_serial_number || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-500">Estado</p>
                      <p className="text-sm text-gray-800">{order.status_display}</p>
                    </div>
                  </div>
                </summary>

                <div className="px-4 pb-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">Detalle</p>
                      <p className="mt-2 text-sm text-gray-700">{order.diagnosis || order.work_performed || order.notes || 'Sin detalle adicional'}</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">Técnico</p>
                      <p className="mt-2 text-sm text-gray-700">{order.assigned_technician_name || 'Sin asignar'}</p>
                    </div>
                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">Ubicación / unidad</p>
                      <p className="mt-2 text-sm text-gray-700">{order.unit_name || '—'}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">Bitácora</p>
                      {order.logs && order.logs.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm text-gray-700">
                          {order.logs.map((log) => (
                            <li key={log.id} className="rounded border border-gray-100 bg-gray-50 p-2">
                              <div className="font-medium text-gray-800">{log.actor_name || 'Sistema'} · {log.event}</div>
                              <div className="text-xs text-gray-500">{log.note || 'Sin nota'}</div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Sin eventos.</p>
                      )}
                    </div>

                    <div className="rounded-md border border-gray-200 bg-white p-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">Historial del equipo</p>
                      {order.history && order.history.length > 0 ? (
                        <ul className="mt-2 space-y-2 text-sm text-gray-700">
                          {order.history.map((entry, index) => (
                            <li key={`${order.id}-history-${index}`} className="rounded border border-gray-100 bg-gray-50 p-2">
                              <div className="font-medium text-gray-800">{entry.title}</div>
                              <div className="text-xs text-gray-500">
                                {entry.date ? String(entry.date).slice(0, 10) : ''}
                                {entry.technician ? ` · ${entry.technician}` : ''}
                                {entry.location ? ` · ${entry.location}` : ''}
                              </div>
                              {entry.details && <div className="mt-1 text-xs text-gray-600">{entry.details}</div>}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-gray-500">Sin historial previo.</p>
                      )}
                    </div>
                  </div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
