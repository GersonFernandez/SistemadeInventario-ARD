import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { serviceOrderApi } from '../services/serviceOrderApi'
import { useAuth } from '../context/AuthContext'
import { downloadBlob } from '../utils/download'

const statusOptions = [
  { value: 'recibido', label: 'Recibido' },
  { value: 'en_diagnostico', label: 'En diagnóstico' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'pendiente_repuesto', label: 'Pendiente repuesto' },
  { value: 'completado', label: 'Completado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]

export default function ServiceOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(false)
  const [statusDraft, setStatusDraft] = useState('')
  const [completionOrderOpen, setCompletionOrderOpen] = useState(false)
  const [completionForm, setCompletionForm] = useState({
    diagnosis: '',
    work_performed: '',
    notes: '',
  })

  useEffect(() => {
    fetchOrder()
  }, [id])

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const { data } = await serviceOrderApi.getServiceOrder(id)
      setOrder(data)
      setStatusDraft(data.status)
    } catch (error) {
      toast.error('No se pudo cargar la orden de servicio')
    } finally {
      setLoading(false)
    }
  }

  const canOperateOrder = (currentOrder) => {
    if (user?.role === 'admin' || user?.role === 'almacenista') return true
    return user?.role === 'tecnico' && currentOrder?.assigned_technician === user?.id
  }

  const openCompleteModule = () => {
    if (!order) return
    setCompletionForm({
      diagnosis: order.diagnosis || '',
      work_performed: order.work_performed || '',
      notes: '',
    })
    setCompletionOrderOpen(true)
  }

  const closeCompleteModule = () => {
    setCompletionOrderOpen(false)
    setCompletionForm({ diagnosis: '', work_performed: '', notes: '' })
  }

  const handleTransition = async () => {
    if (!order) return
    const note = window.prompt('Nota de transición (opcional):', '') || ''
    try {
      await serviceOrderApi.transitionServiceOrder(order.id, statusDraft, note)
      toast.success('Estado actualizado')
      fetchOrder()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo actualizar el estado')
    }
  }

  const handleAddNote = async () => {
    if (!order) return
    const note = window.prompt('Escribe la nota técnica:')
    if (!note || !note.trim()) return
    try {
      await serviceOrderApi.addServiceOrderNote(order.id, note.trim())
      toast.success('Nota agregada a la bitácora')
      fetchOrder()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo agregar la nota')
    }
  }

  const submitCompletion = async (e) => {
    e.preventDefault()
    if (!order) return
    if (!completionForm.diagnosis.trim()) {
      toast.error('Debe registrar el diagnóstico final')
      return
    }
    if (!completionForm.work_performed.trim()) {
      toast.error('Debe registrar el trabajo realizado')
      return
    }

    setCompleting(true)
    try {
      await serviceOrderApi.completeServiceOrder(order.id, {
        diagnosis: completionForm.diagnosis.trim(),
        work_performed: completionForm.work_performed.trim(),
        notes: completionForm.notes.trim(),
      })
      toast.success('Orden completada con cierre técnico')
      closeCompleteModule()
      fetchOrder()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo completar la orden')
    } finally {
      setCompleting(false)
    }
  }

  const handleDownloadCompletionReceipt = async (format = 'pdf') => {
    if (!order) return
    try {
      const response = await serviceOrderApi.downloadCompletionReceipt(order.id, format)
      const extension = format === 'pdf' ? 'pdf' : 'xlsx'
      downloadBlob(response, `cierre_${order.service_number}.${extension}`)
      toast.success('Comprobante de cierre descargado')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo descargar el comprobante de cierre')
    }
  }

  if (loading) return <p className="text-gray-600">Cargando...</p>
  if (!order) return <p className="text-gray-600">Orden de servicio no encontrada.</p>

  const orderItems = order.grouped_items && order.grouped_items.length > 0
    ? order.grouped_items
    : [{
      product: order.equipment_name_snapshot || order.equipment_name,
      serial: order.equipment_serial_number,
      description: order.equipment_description_snapshot,
      state_display: order.equipment_condition === 'nuevo' ? 'Nuevo' : 'Usado',
      count: 1,
    }]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/service-orders')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Volver a órdenes de servicio
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Orden {order.service_number}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {order.service_type_display} · Recibida el {new Date(order.received_at).toLocaleString('es-DO')}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-800">
            {order.status_display}
          </span>
          {(order.status === 'completado' || order.status === 'entregado') && (
            <button
              type="button"
              onClick={() => handleDownloadCompletionReceipt('pdf')}
              className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
            >
              <DocumentArrowDownIcon className="h-4 w-4" /> Comprobante PDF
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Información general</h3>
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Tipo de servicio</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.service_type_display}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Técnico asignado</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.assigned_technician_name || 'Sin asignar'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Unidad</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.unit_name || '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Creada por</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.created_by_name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Completada</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.completed_at ? new Date(order.completed_at).toLocaleString('es-DO') : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Entregada</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.delivered_at ? new Date(order.delivered_at).toLocaleString('es-DO') : '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Destinatario</h3>
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Nombre completo</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {[order.recipient_first_name, order.recipient_last_name].filter(Boolean).join(' ') || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Cédula</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.recipient_id_card || '—'}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Rango / Cargo</dt>
                <dd className="mt-1 text-sm text-gray-900">{order.recipient_rank_position || '—'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Productos de la orden</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Serial</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Descripción</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {orderItems.map((item, index) => (
                  <tr key={`${order.id}-item-${index}`}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{item.product}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.serial || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.description || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.state_display}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{item.count || 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Cierre técnico</h3>
              <div className="space-y-3 text-sm text-gray-700">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Diagnóstico</p>
                  <p className="mt-1 whitespace-pre-wrap">{order.diagnosis || 'Sin diagnóstico registrado.'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Trabajo realizado</p>
                  <p className="mt-1 whitespace-pre-wrap">{order.work_performed || 'Sin trabajo final registrado.'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Observaciones</p>
                  <p className="mt-1 whitespace-pre-wrap">{order.notes || 'Sin observaciones.'}</p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-3 text-lg font-semibold text-gray-900">Historial del equipo</h3>
              {order.history && order.history.length > 0 ? (
                <ul className="space-y-3 text-sm text-gray-700">
                  {order.history.map((entry, index) => (
                    <li key={`${order.id}-history-${index}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="font-medium text-gray-900">{entry.title}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {entry.date ? String(entry.date).slice(0, 10) : ''}
                        {entry.technician ? ` · ${entry.technician}` : ''}
                        {entry.location ? ` · ${entry.location}` : ''}
                        {entry.status ? ` · ${entry.status}` : ''}
                      </div>
                      {entry.details && <div className="mt-2 text-xs text-gray-700">{entry.details}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500">Sin historial previo.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Acciones</h3>
            {canOperateOrder(order) ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-gray-500">Cambiar estado</label>
                  <select
                    value={statusDraft}
                    onChange={(e) => setStatusDraft(e.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleTransition}
                  className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Actualizar estado
                </button>
                {order.status !== 'completado' && order.status !== 'entregado' && order.status !== 'cancelado' && (
                  <button
                    type="button"
                    onClick={openCompleteModule}
                    className="w-full rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                  >
                    Completar servicio
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAddNote}
                  className="w-full rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
                >
                  Agregar nota técnica
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Solo lectura para esta orden.</p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Bitácora</h3>
            {order.logs && order.logs.length > 0 ? (
              <ul className="space-y-3 text-sm text-gray-700">
                {order.logs.map((log) => (
                  <li key={log.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="font-medium text-gray-900">{log.actor_name || 'Sistema'} · {log.event}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {log.created_at ? new Date(log.created_at).toLocaleString('es-DO') : '—'}
                    </div>
                    <div className="mt-2 text-xs text-gray-700">{log.note || 'Sin nota'}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Sin eventos.</p>
            )}
          </div>
        </div>
      </div>

      {completionOrderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Completar orden de servicio</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Cierre técnico de la orden <span className="font-semibold text-gray-900">{order.service_number}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeCompleteModule}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={submitCompletion} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Diagnóstico final</label>
                <textarea
                  rows={4}
                  value={completionForm.diagnosis}
                  onChange={(e) => setCompletionForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Trabajo realizado</label>
                <textarea
                  rows={4}
                  value={completionForm.work_performed}
                  onChange={(e) => setCompletionForm((prev) => ({ ...prev, work_performed: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Observaciones de cierre</label>
                <textarea
                  rows={3}
                  value={completionForm.notes}
                  onChange={(e) => setCompletionForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeCompleteModule}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={completing}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {completing ? 'Completando...' : 'Guardar cierre técnico'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}