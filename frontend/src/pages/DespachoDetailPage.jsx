import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, XCircleIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { despachoApi } from '../services/workOrderApi'
import { getMediaUrl } from '../services/inventoryApi'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/permissions'

const stateStyles = {
  issued: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function DespachoDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = hasPermission(user, 'despachos.manage', ['admin', 'almacenista'])
  const canExport = hasPermission(user, 'reports.export', ['admin', 'almacenista', 'tecnico'])
  const [despacho, setDespacho] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [receiptFiles, setReceiptFiles] = useState([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)

  useEffect(() => {
    fetchDespacho()
  }, [id])

  const fetchDespacho = async () => {
    setLoading(true)
    try {
      const { data } = await despachoApi.getDespacho(id)
      setDespacho(data)
    } catch (err) {
      toast.error('No se pudo cargar el despacho')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      toast.error('Debe indicar el motivo de la anulación.')
      return
    }
    setCancelling(true)
    try {
      await despachoApi.cancelDespacho(id, cancelReason)
      toast.success('Despacho anulado y movimientos revertidos')
      setShowCancelModal(false)
      setCancelReason('')
      fetchDespacho()
    } catch (err) {
      const msg = err.response?.data?.detail || 'Error al anular'
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    } finally {
      setCancelling(false)
    }
  }

  const canCancel = () => {
    if (!despacho) return false
    if (despacho.status === 'cancelled') return false
    return canManage
  }

  const evidenceAttachments = (despacho?.attachments || []).filter((a) => a.attachment_type === 'evidencia')
  const receiptAttachments = (despacho?.attachments || []).filter((a) => a.attachment_type === 'comprobante')

  const openAttachment = (attachment) => {
    const path = attachment.file_url || attachment.file
    if (!path) {
      toast.error('El adjunto no tiene una URL válida')
      return
    }
    const a = document.createElement('a')
    a.href = getMediaUrl(path)
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.download = `despacho_${despacho.ot_number}_${attachment.id}`
    a.click()
  }

  const uploadAttachments = async () => {
    if (!evidenceFiles.length && !receiptFiles.length) {
      toast.error('Seleccione al menos un archivo de evidencia o comprobante')
      return
    }

    setUploadingAttachments(true)
    try {
      await despachoApi.uploadAttachments(id, {
        evidences: evidenceFiles,
        receipts: receiptFiles,
      })
      toast.success('Adjuntos cargados correctamente')
      setEvidenceFiles([])
      setReceiptFiles([])
      await fetchDespacho()
    } catch {
      toast.error('No se pudieron subir los adjuntos del despacho')
    } finally {
      setUploadingAttachments(false)
    }
  }

  const handleDownloadReceipt = async () => {
    try {
      const response = await despachoApi.downloadReceipt(id, 'pdf')
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comprobante_despacho_${despacho.ot_number}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast.error('No se pudo descargar el comprobante')
    }
  }

  if (loading) return <p className="text-gray-600">Cargando...</p>
  if (!despacho) return <p className="text-gray-600">Despacho no encontrado.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/despachos')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Volver
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Despacho {despacho.ot_number}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Despachado el {new Date(despacho.issued_at).toLocaleString('es-DO')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button
              onClick={handleDownloadReceipt}
              className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PrinterIcon className="h-4 w-4" />
              Comprobante
            </button>
          )}
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
              stateStyles[despacho.status] || 'bg-gray-100 text-gray-800'
            }`}
          >
            {despacho.status_display}
          </span>
          {canCancel() && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              <XCircleIcon className="h-4 w-4" />
              Anular
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Información</h3>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-gray-500">Solicitante</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {despacho.solicitante_detail?.full_name || despacho.solicitante_detail?.name}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Unidad / Base</dt>
            <dd className="mt-1 text-sm text-gray-900">{despacho.unit_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Entregado por</dt>
            <dd className="mt-1 text-sm text-gray-900">{despacho.delivered_by_name}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Referencia del equipo</dt>
            <dd className="mt-1 text-sm text-gray-900">{despacho.equipment_reference || '—'}</dd>
          </div>
          {despacho.notes && (
            <div className="md:col-span-2">
              <dt className="text-xs font-medium text-gray-500">Notas</dt>
              <dd className="mt-1 text-sm text-gray-900">{despacho.notes}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Adjuntos del despacho</h3>

        {canManage && (
          <div className="mb-5 rounded-md border border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-800">Subir evidencias y comprobantes</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Evidencias</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setEvidenceFiles(Array.from(e.target.files || []))}
                  className="mt-1 w-full text-sm text-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Comprobantes</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setReceiptFiles(Array.from(e.target.files || []))}
                  className="mt-1 w-full text-sm text-gray-700"
                />
              </div>
            </div>
            <button
              onClick={uploadAttachments}
              disabled={uploadingAttachments}
              className="mt-3 inline-flex items-center rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
            >
              {uploadingAttachments ? 'Subiendo...' : 'Subir adjuntos'}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md border border-gray-200 p-3">
            <h4 className="mb-2 text-sm font-semibold text-gray-800">Evidencias ({evidenceAttachments.length})</h4>
            {evidenceAttachments.length === 0 ? (
              <p className="text-sm text-gray-500">Sin evidencias adjuntas.</p>
            ) : (
              <div className="space-y-2">
                {evidenceAttachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => openAttachment(att)}
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Evidencia #{att.id} · {att.created_at ? new Date(att.created_at).toLocaleString('es-DO') : '—'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <h4 className="mb-2 text-sm font-semibold text-emerald-900">Comprobantes ({receiptAttachments.length})</h4>
            {receiptAttachments.length === 0 ? (
              <p className="text-sm text-emerald-800">Sin comprobantes adjuntos.</p>
            ) : (
              <div className="space-y-2">
                {receiptAttachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => openAttachment(att)}
                    className="w-full rounded-md border border-emerald-300 bg-white px-3 py-2 text-left text-sm text-emerald-800 hover:bg-emerald-100"
                  >
                    Comprobante #{att.id} · {att.created_at ? new Date(att.created_at).toLocaleString('es-DO') : '—'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900">Artículos despachados ({despacho.lineas_count})</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Artículo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Serial</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cantidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Notas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {despacho.lineas.map((l) => (
              <tr key={l.id}>
                <td className="px-6 py-4 text-sm">
                  <p className="font-medium text-gray-900">{l.item_name}</p>
                  <p className="text-xs text-gray-500">{l.item_code}</p>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{l.item_kind}</td>
                <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                  {l.item_unit_serial || '—'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{l.quantity}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{l.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {despacho.status === 'cancelled' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">
            <strong>Despacho anulado</strong> el {new Date(despacho.cancelled_at).toLocaleString('es-DO')}{' '}
            por {despacho.cancelled_by_name}.
          </p>
          {despacho.cancellation_reason && (
            <p className="mt-1 text-sm text-red-600">Motivo: {despacho.cancellation_reason}</p>
          )}
        </div>
      )}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Anular despacho</h3>
            <p className="mb-3 text-sm text-gray-600">
              Esta acción revertirá el stock descontado y liberará las unidades asignadas. Debe justificar el motivo.
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Motivo de la anulación..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowCancelModal(false); setCancelReason('') }}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling || !cancelReason.trim()}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? 'Anulando...' : 'Confirmar anulación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
