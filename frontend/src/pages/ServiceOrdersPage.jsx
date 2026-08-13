import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { serviceOrderApi } from '../services/serviceOrderApi'
import { useAuth } from '../context/AuthContext'
import { downloadBlob } from '../utils/download'
import { hasPermission } from '../utils/permissions'

const statusColors = {
  recibido:           'bg-blue-100 text-blue-800',
  en_diagnostico:     'bg-yellow-100 text-yellow-800',
  en_proceso:         'bg-orange-100 text-orange-800',
  pendiente_repuesto: 'bg-red-100 text-red-800',
  completado:         'bg-emerald-100 text-emerald-800',
  entregado:          'bg-green-100 text-green-800',
  cancelado:          'bg-gray-100 text-gray-600',
}

const serviceTypeLabels = {
  reparacion:    'Reparación',
  instalacion:   'Instalación',
  mantenimiento: 'Mantenimiento',
}

export default function ServiceOrdersPage() {
  const { user } = useAuth()
  const canCreate = hasPermission(user, 'service_orders.manage', ['admin', 'almacenista'])
  const canExport = hasPermission(user, 'reports.export', ['admin', 'almacenista', 'tecnico'])

  const [orders, setOrders]             = useState([])
  const [loading, setLoading]           = useState(true)
  const [showReportMenu, setShowReportMenu] = useState(false)

  const [search,          setSearch]          = useState('')
  const [statusFilter,    setStatusFilter]    = useState('')
  const [typeFilter,      setTypeFilter]      = useState('')
  const [dateFrom,        setDateFrom]        = useState('')
  const [dateTo,          setDateTo]          = useState('')

  useEffect(() => {
    fetchOrders()
  }, [])

  useEffect(() => {
    if (!showReportMenu) return
    const handler = (e) => { if (!e.target.closest('[data-report-menu]')) setShowReportMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showReportMenu])

  const fetchOrders = async (overrides = {}) => {
    setLoading(true)
    try {
      const effectiveSearch = overrides.search ?? search
      const effectiveStatus = overrides.statusFilter ?? statusFilter
      const effectiveType = overrides.typeFilter ?? typeFilter
      const effectiveDateFrom = overrides.dateFrom ?? dateFrom
      const effectiveDateTo = overrides.dateTo ?? dateTo

      const params = {}
      if (effectiveSearch.trim()) params.search = effectiveSearch.trim()
      if (effectiveStatus) params.status = effectiveStatus
      if (effectiveType) params.service_type = effectiveType
      if (effectiveDateFrom) params.from = effectiveDateFrom
      if (effectiveDateTo) params.to = effectiveDateTo
      const { data } = await serviceOrderApi.getServiceOrders(params)
      setOrders(data.results || data)
    } catch {
      toast.error('No se pudieron cargar las órdenes de servicio')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadReport = async (format) => {
    try {
      const params = {}
      if (statusFilter) params.status       = statusFilter
      if (typeFilter)   params.service_type = typeFilter
      if (dateFrom)     params.from         = dateFrom
      if (dateTo)       params.to           = dateTo
      const response = await serviceOrderApi.downloadReport(format, params)
      const suffix = typeFilter ? `_${typeFilter}` : ''
      downloadBlob(response, `ordenes_servicio${suffix}_${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      toast.success('Reporte generado')
    } catch {
      toast.error('No se pudo generar el reporte')
    } finally {
      setShowReportMenu(false)
    }
  }

  const handleClearFilters = () => {
    const cleared = {
      search: '',
      statusFilter: '',
      typeFilter: '',
      dateFrom: '',
      dateTo: '',
    }
    setSearch(cleared.search)
    setTypeFilter(cleared.typeFilter)
    setStatusFilter(cleared.statusFilter)
    setDateFrom(cleared.dateFrom)
    setDateTo(cleared.dateTo)
    fetchOrders(cleared)
  }

  const handleDownloadCompletionReceipt = async (order, format = 'pdf') => {
    try {
      const response = await serviceOrderApi.downloadCompletionReceipt(order.id, format)
      downloadBlob(response, `cierre_${order.service_number}.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      toast.success('Comprobante de cierre descargado')
    } catch {
      toast.error('No se pudo descargar el comprobante de cierre')
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Órdenes de servicio</h2>
          <p className="mt-1 text-sm text-gray-500">Reparaciones, instalaciones y mantenimientos del taller.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Report dropdown */}
          {canExport && (
            <div className="relative" data-report-menu>
              <button
                onClick={() => setShowReportMenu((s) => !s)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Exportar
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              {showReportMenu && (
                <div className="absolute right-0 mt-1 w-52 rounded-xl border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
                  <p className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 border-b border-gray-100">
                    {typeFilter ? serviceTypeLabels[typeFilter] : 'Todos los tipos'}
                    {statusFilter ? ` · ${statusFilter}` : ''}
                  </p>
                  <button onClick={() => handleDownloadReport('pdf')} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">
                    PDF
                  </button>
                  <button onClick={() => handleDownloadReport('excel')} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">
                    Excel
                  </button>
                </div>
              )}
            </div>
          )}

          {canCreate && (
            <Link
              to="/service-orders/new"
              className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
            >
              <PlusIcon className="h-4 w-4" />
              Nueva orden
            </Link>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Número, técnico, equipo, serial…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>

          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos los tipos</option>
            <option value="reparacion">Reparación</option>
            <option value="instalacion">Instalación</option>
            <option value="mantenimiento">Mantenimiento</option>
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            <option value="recibido">Recibido</option>
            <option value="en_diagnostico">En diagnóstico</option>
            <option value="en_proceso">En proceso</option>
            <option value="pendiente_repuesto">Pendiente repuesto</option>
            <option value="completado">Completado</option>
            <option value="entregado">Entregado</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <div className="flex items-end gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-500">Desde</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500">Hasta</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={fetchOrders} className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">
              Filtrar
            </button>
            <button
              onClick={handleClearFilters}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <p className="text-gray-600">Cargando…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Número</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Equipos</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Técnico</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Unidad</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Recibida</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <Link to={`/service-orders/${order.id}`} className="font-medium text-brand-800 hover:underline">
                      {order.service_number}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                      {order.service_type_display}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700 max-w-xs">
                    {order.grouped_items && order.grouped_items.length > 0 ? (
                      <ul className="space-y-0.5">
                        {order.grouped_items.map((entry, idx) => (
                          <li key={idx} className="text-xs">
                            <span className="font-medium">{entry.product}</span>
                            {entry.serial ? <span className="text-gray-400"> · {entry.serial}</span> : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-xs">
                        {order.equipment_name_snapshot || order.equipment_name || '—'}
                        {order.equipment_serial_number ? <span className="text-gray-400"> · {order.equipment_serial_number}</span> : ''}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-700">{order.assigned_technician_name || 'Sin asignar'}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{order.unit_name || '—'}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {order.received_at ? new Date(order.received_at).toLocaleDateString('es-DO') : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                      {order.status_display}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/service-orders/${order.id}`}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Ver detalle
                      </Link>
                      {(order.status === 'completado' || order.status === 'entregado') && (
                        <button
                          type="button"
                          onClick={() => handleDownloadCompletionReceipt(order, 'pdf')}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-300 px-3 py-1.5 text-xs text-indigo-700 hover:bg-indigo-50"
                        >
                          <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                          Comprobante
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-sm text-gray-500">
                    No se encontraron órdenes de servicio.
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