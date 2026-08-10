import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PlusIcon, MagnifyingGlassIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline'
import { despachoApi } from '../services/workOrderApi'
import { downloadBlob } from '../utils/download'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/permissions'

const statusColors = {
  issued: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

export default function DespachosPage() {
  const { user } = useAuth()
  const canManage = hasPermission(user, 'despachos.manage', ['admin', 'almacenista'])
  const canExport = hasPermission(user, 'reports.export', ['admin', 'almacenista', 'tecnico'])

  const [despachos, setDespachos] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [solicitanteFilter, setSolicitanteFilter] = useState('')
  const [reportFrom, setReportFrom] = useState('')
  const [reportTo, setReportTo] = useState('')

  useEffect(() => {
    fetchDespachos()
  }, [])

  const fetchDespachos = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (statusFilter) params.status = statusFilter
      if (solicitanteFilter) params.solicitante = solicitanteFilter
      const { data } = await despachoApi.getDespachos(params)
      setDespachos(data.results || data)
    } catch (error) {
      toast.error('Error al cargar despachos')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadReport = async (format) => {
    try {
      const response = await despachoApi.downloadDespachosReport(format)
      const extension = format === 'pdf' ? 'pdf' : 'xlsx'
      downloadBlob(response, `despachos_${new Date().toISOString().slice(0, 10)}.${extension}`)
    } catch (error) {
      toast.error('Error al generar el reporte')
    }
  }

  const handleDownloadReceptionDispatchReport = async (format) => {
    try {
      const params = {}
      if (reportFrom) params.from = reportFrom
      if (reportTo) params.to = reportTo
      const response = await despachoApi.downloadReceptionDispatchReport(format, params)
      const extension = format === 'pdf' ? 'pdf' : 'xlsx'
      downloadBlob(response, `recepcion_vs_despacho_${new Date().toISOString().slice(0, 10)}.${extension}`)
    } catch (error) {
      toast.error('Error al generar reporte de recepción vs despacho')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Despachos</h2>
        <div className="flex items-center gap-2">
          {canExport && (
            <>
              <button
                onClick={() => handleDownloadReport('pdf')}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={() => handleDownloadReport('excel')}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <DocumentArrowDownIcon className="h-4 w-4" />
                Excel
              </button>
            </>
          )}
          {canManage && (
            <Link
              to="/despachos/new"
              className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
            >
              <PlusIcon className="h-4 w-4" />
              Nuevo Despacho
            </Link>
          )}
        </div>
      </div>

      {canExport && (
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-gray-600">Desde</label>
              <input
                type="date"
                value={reportFrom}
                onChange={(e) => setReportFrom(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Hasta</label>
              <input
                type="date"
                value={reportTo}
                onChange={(e) => setReportTo(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadReceptionDispatchReport('pdf')}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              Rec vs Desp PDF
            </button>
            <button
              onClick={() => handleDownloadReceptionDispatchReport('excel')}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <DocumentArrowDownIcon className="h-4 w-4" />
              Rec vs Desp Excel
            </button>
          </div>
        </div>
      </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por DV, solicitante, equipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchDespachos()}
            className="w-full rounded-md border border-gray-300 pl-10 pr-4 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2"
        >
          <option value="">Todos los estados</option>
          <option value="issued">Despachado</option>
          <option value="cancelled">Anulado</option>
        </select>
        <button
          onClick={fetchDespachos}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Filtrar
        </button>
      </div>

      {loading ? (
        <p className="text-gray-600">Cargando...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">DV</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Solicitante</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Unidad</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Items</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Entregado por</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {despachos.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <Link
                      to={`/despachos/${d.id}`}
                      className="font-medium text-brand-800 hover:underline"
                    >
                      {d.ot_number}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(d.issued_at).toLocaleDateString('es-DO')}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{d.solicitante_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{d.unit_name || '—'}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{d.lineas_count} ({d.total_items} und)</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{d.delivered_by_name}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[d.status] || 'bg-gray-100 text-gray-800'}`}>
                      {d.status_display}
                    </span>
                  </td>
                </tr>
              ))}
              {despachos.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No se encontraron despachos.
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
