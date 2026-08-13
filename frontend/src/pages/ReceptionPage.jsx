import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PlusIcon, MagnifyingGlassIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { inventoryApi, getMediaUrl } from '../services/inventoryApi'
import { downloadBlob } from '../utils/download'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/permissions'

export default function ReceptionPage() {
  const { user } = useAuth()
  const canManage = hasPermission(user, 'reception.manage', ['admin', 'almacenista'])
  const canExport = hasPermission(user, 'reports.export', ['admin', 'almacenista', 'tecnico'])

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ tipo: '', from: '', to: '' })

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filters.tipo) params.tipo = filters.tipo
      if (filters.from) params.fecha_recepcion_after = filters.from
      if (filters.to) params.fecha_recepcion_before = filters.to
      if (search) params.search = search
      const { data } = await inventoryApi.getProductEntries(params)
      setHistory(data.results || data)
    } catch {
      toast.error('No se pudo cargar el historial de recepciones')
    } finally {
      setLoading(false)
    }
  }

  const groupedHistory = useMemo(() => {
    const groups = {}
    history.forEach((entry) => {
      if (!groups[entry.reception_id]) groups[entry.reception_id] = []
      groups[entry.reception_id].push(entry)
    })
    return Object.entries(groups).map(([id, rows]) => ({
      receptionId: id,
      fecha: rows[0]?.fecha_recepcion,
      ubicacion: rows[0]?.ubicacion_breadcrumb || rows[0]?.ubicacion_name || '—',
      entregadoPor: `${rows[0]?.entregado_por_nombre || ''} ${rows[0]?.entregado_por_apellido || ''}`.trim() || '—',
      recibidoPor: rows[0]?.registrado_por_name || '—',
      rangoCargo: rows[0]?.entregado_por_rango_cargo || '',
      lineas: rows.length,
      totalItems: rows.reduce((s, r) => s + Number(r.cantidad || 0), 0),
      adjuntos: rows[0]?.adjuntos || [],
      comprobantesFirmados: (rows[0]?.adjuntos || []).filter((a) => a.attachment_type === 'comprobante_firmado'),
      rows,
    })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [history])

  const downloadReceipt = async (receptionId) => {
    try {
      const response = await inventoryApi.downloadProductEntryReceipt(receptionId, 'pdf')
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comprobante_recepcion_${receptionId}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar el comprobante')
    }
  }

  const downloadSignedAttachment = (attachment, receptionId) => {
    const filePath = attachment.file_url || attachment.file
    if (!filePath) {
      toast.error('El adjunto firmado no tiene una URL válida')
      return
    }

    const url = getMediaUrl(filePath)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.download = `comprobante_firmado_${receptionId}_${attachment.id}`
    anchor.click()
  }

  const downloadHistoryReport = async (format = 'pdf') => {
    try {
      const params = {}
      if (filters.tipo) params.tipo = filters.tipo
      if (filters.from) params.fecha_recepcion_after = filters.from
      if (filters.to) params.fecha_recepcion_before = filters.to
      if (search.trim()) params.search = search.trim()

      const response = await inventoryApi.downloadProductEntryHistoryReport(format, params)
      const ext = format === 'pdf' ? 'pdf' : 'xlsx'
      downloadBlob(response, `historial_recepciones_${new Date().toISOString().slice(0, 10)}.${ext}`)
    } catch {
      toast.error('No se pudo descargar el historial de recepciones')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Recepción de mercancía</h2>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <>
              <button
                onClick={() => downloadHistoryReport('pdf')}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Historial PDF
              </button>
              <button
                onClick={() => downloadHistoryReport('excel')}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Historial Excel
              </button>
            </>
          )}
          {canManage && (
            <Link
              to="/reception/new"
              className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
            >
              <PlusIcon className="h-4 w-4" />
              Nueva recepción
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por recepción, producto, quién entrega…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadHistory()}
            className="w-full rounded-md border border-gray-300 pl-10 pr-4 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
          />
        </div>
        <div>
          <label className="mr-1 text-xs font-semibold text-gray-600">Desde</label>
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mr-1 text-xs font-semibold text-gray-600">Hasta</label>
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <select
          value={filters.tipo}
          onChange={(e) => setFilters({ ...filters, tipo: e.target.value })}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="nuevo">Nuevo</option>
          <option value="usado">Usado / Reparación</option>
        </select>
        <button
          onClick={loadHistory}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Filtrar
        </button>
      </div>

      {loading ? (
        <p className="text-gray-600">Cargando…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Recepción</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ubicación</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entregado por</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Recibido por</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Líneas</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Total und</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {groupedHistory.map((g) => (
                <tr key={g.receptionId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-sm font-medium text-brand-800">{g.receptionId}</td>
                  <td className="px-3 py-2 text-sm text-gray-500">
                    {g.fecha ? new Date(g.fecha).toLocaleDateString('es-DO') : '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">{g.ubicacion}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">
                    {g.entregadoPor}
                    {g.rangoCargo && <span className="ml-1 text-xs text-gray-400">({g.rangoCargo})</span>}
                  </td>
                  <td className="px-3 py-2 text-sm text-gray-900">{g.recibidoPor}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{g.lineas}</td>
                  <td className="px-3 py-2 text-sm text-gray-900">{g.totalItems}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => downloadReceipt(g.receptionId)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900"
                      >
                        <DocumentArrowDownIcon className="h-4 w-4" />
                        Comprobante
                      </button>
                      {g.comprobantesFirmados.length > 0 && (
                        <button
                          onClick={() => downloadSignedAttachment(g.comprobantesFirmados[0], g.receptionId)}
                          className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-900"
                        >
                          <DocumentArrowDownIcon className="h-4 w-4" />
                          Firmado
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {groupedHistory.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                    No se encontraron recepciones.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}