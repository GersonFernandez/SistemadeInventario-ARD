import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeftIcon, PrinterIcon } from '@heroicons/react/24/outline'
import { inventoryApi, getMediaUrl } from '../services/inventoryApi'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/permissions'

export default function ReceptionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = hasPermission(user, 'reception.manage', ['admin', 'almacenista'])
  const canExport = hasPermission(user, 'reports.export', ['admin', 'almacenista', 'tecnico'])

  const [loading, setLoading] = useState(true)
  const [lines, setLines] = useState([])
  const [attachments, setAttachments] = useState([])
  const [photoFiles, setPhotoFiles] = useState([])
  const [documentFiles, setDocumentFiles] = useState([])
  const [signedFiles, setSignedFiles] = useState([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)

  useEffect(() => {
    fetchReceptionDetail()
  }, [id])

  const fetchReceptionDetail = async () => {
    setLoading(true)
    try {
      const [entriesRes, attachmentsRes] = await Promise.all([
        inventoryApi.getProductEntries({ reception_id: id }),
        inventoryApi.getProductEntryAttachments(id),
      ])
      const rows = entriesRes.data.results || entriesRes.data || []
      setLines(rows)
      setAttachments(attachmentsRes.data?.adjuntos || [])
    } catch (err) {
      toast.error('No se pudo cargar la recepción')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const summary = useMemo(() => {
    if (!lines.length) return null
    const first = lines[0]
    return {
      receptionId: first.reception_id,
      fecha: first.fecha_recepcion,
      ubicacion: first.ubicacion_breadcrumb || first.ubicacion_name || '—',
      entregadoPor: `${first.entregado_por_nombre || ''} ${first.entregado_por_apellido || ''}`.trim() || '—',
      cedula: first.entregado_por_cedula || '—',
      rangoCargo: first.entregado_por_rango_cargo || '—',
      recibidoPor: first.registrado_por_name || '—',
      observaciones: first.observaciones || '—',
      lineasCount: lines.length,
      totalItems: lines.reduce((sum, r) => sum + Number(r.cantidad || 0), 0),
    }
  }, [lines])

  const openAttachment = (attachment) => {
    const path = attachment.file_url || attachment.file
    if (!path) {
      toast.error('El adjunto no tiene una URL válida')
      return
    }
    const anchor = document.createElement('a')
    anchor.href = getMediaUrl(path)
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.download = `adjunto_${id}_${attachment.id}`
    anchor.click()
  }

  const attachmentTypeLabel = (type) => {
    if (type === 'foto') return 'Foto'
    if (type === 'documento') return 'Documento'
    if (type === 'comprobante_firmado') return 'Comprobante firmado'
    return 'Adjunto'
  }

  const signedAttachments = attachments.filter((a) => a.attachment_type === 'comprobante_firmado')

  const handleDownloadReceipt = async () => {
    try {
      const response = await inventoryApi.downloadProductEntryReceipt(id, 'pdf')
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comprobante_recepcion_${id}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar el comprobante')
    }
  }

  const uploadAttachments = async () => {
    if (!photoFiles.length && !documentFiles.length && !signedFiles.length) {
      toast.error('Seleccione al menos un archivo para subir')
      return
    }

    setUploadingAttachments(true)
    try {
      const { data } = await inventoryApi.uploadProductEntryAttachments(id, {
        photos: photoFiles,
        documents: documentFiles,
        signedReceipt: signedFiles,
      })
      const uploaded = data?.adjuntos || []
      setAttachments((prev) => [...uploaded, ...prev])
      setPhotoFiles([])
      setDocumentFiles([])
      setSignedFiles([])
      toast.success('Adjuntos cargados correctamente')
    } catch {
      toast.error('No se pudieron subir los adjuntos')
    } finally {
      setUploadingAttachments(false)
    }
  }

  if (loading) return <p className="text-gray-600">Cargando...</p>
  if (!summary) return <p className="text-gray-600">Recepción no encontrada.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/reception')}
            className="mb-2 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Volver
          </button>
          <h2 className="text-2xl font-bold text-gray-900">Recepción {summary.receptionId}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Registrada el {summary.fecha ? new Date(summary.fecha).toLocaleString('es-DO') : '—'}
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
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Información</h3>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-gray-500">Entregado por</dt>
            <dd className="mt-1 text-sm text-gray-900">{summary.entregadoPor}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Recibido por</dt>
            <dd className="mt-1 text-sm text-gray-900">{summary.recibidoPor}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Cédula</dt>
            <dd className="mt-1 text-sm text-gray-900">{summary.cedula}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Rango / Cargo</dt>
            <dd className="mt-1 text-sm text-gray-900">{summary.rangoCargo}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Ubicación</dt>
            <dd className="mt-1 text-sm text-gray-900">{summary.ubicacion}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-gray-500">Total líneas / unidades</dt>
            <dd className="mt-1 text-sm text-gray-900">{summary.lineasCount} / {summary.totalItems}</dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-xs font-medium text-gray-500">Observaciones</dt>
            <dd className="mt-1 text-sm text-gray-900">{summary.observaciones || '—'}</dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-medium text-gray-900">Adjuntos ({attachments.length})</h3>

        {canManage && (
          <div className="mb-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-sm font-medium text-gray-800">Subir evidencias y comprobantes</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Fotos evidencia</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setPhotoFiles(Array.from(e.target.files || []))}
                  className="mt-1 w-full text-sm text-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Documentos evidencia</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setDocumentFiles(Array.from(e.target.files || []))}
                  className="mt-1 w-full text-sm text-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Comprobante firmado</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setSignedFiles(Array.from(e.target.files || []))}
                  className="mt-1 w-full text-sm text-gray-700"
                />
              </div>
            </div>
            <button
              onClick={uploadAttachments}
              disabled={uploadingAttachments}
              className="mt-3 inline-flex items-center justify-center rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
            >
              {uploadingAttachments ? 'Subiendo...' : 'Subir adjuntos'}
            </button>
          </div>
        )}

        <div className="mb-4 rounded-md border border-emerald-100 bg-emerald-50 p-3">
          <h4 className="mb-2 text-sm font-semibold text-emerald-900">Comprobantes firmados ({signedAttachments.length})</h4>
          {signedAttachments.length === 0 ? (
            <p className="text-sm text-emerald-800">No hay comprobantes firmados todavía.</p>
          ) : (
            <div className="space-y-2">
              {signedAttachments.map((attachment) => (
                <div key={attachment.id} className="flex flex-col gap-2 rounded-md border border-emerald-200 bg-white p-2 md:flex-row md:items-center md:justify-between">
                  <p className="text-sm text-gray-800">Firmado: {attachment.created_at ? new Date(attachment.created_at).toLocaleString('es-DO') : '—'}</p>
                  <button
                    onClick={() => openAttachment(attachment)}
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-white px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                  >
                    Descargar firmado
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {attachments.length === 0 ? (
          <p className="text-sm text-gray-500">No hay archivos adjuntos en esta recepción.</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="flex flex-col gap-2 rounded-md border border-gray-100 bg-gray-50 p-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">{attachmentTypeLabel(attachment.attachment_type)}</p>
                  <p className="text-xs text-gray-500">{attachment.created_at ? new Date(attachment.created_at).toLocaleString('es-DO') : '—'}</p>
                </div>
                <button
                  onClick={() => openAttachment(attachment)}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Abrir / Descargar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900">Mercancía recibida ({summary.lineasCount})</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Producto</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Seriales</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cantidad</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Observaciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {lines.map((row) => {
              const product = row.base_product_name
                || `${row.marca_name || ''} ${row.modelo_name || ''}`.trim()
                || row.categoria_name
                || '—'
              const seriales = Array.isArray(row.seriales) && row.seriales.length > 0
                ? row.seriales.join(', ')
                : '—'

              return (
                <tr key={row.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{product}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{row.tipo || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{seriales}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{row.cantidad ?? '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{row.observaciones || '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">
        También puede volver al historial en <Link to="/reception" className="text-brand-800 hover:underline">Recepción de mercancía</Link>.
      </p>
    </div>
  )
}
