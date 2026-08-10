import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'
import { solicitanteApi } from '../services/workOrderApi'
import { inventoryApi } from '../services/inventoryApi'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/permissions'

const PAGE_SIZE = 25

export default function SolicitantesPage() {
  const { user } = useAuth()
  const navigate  = useNavigate()
  const canManage = hasPermission(user, 'solicitantes.manage', ['admin', 'almacenista'])

  const [solicitantes, setSolicitantes] = useState([])
  const [locations, setLocations]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [totalCount, setTotalCount]     = useState(0)
  const [page, setPage]                 = useState(1)

  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('true')
  const [unitFilter,   setUnitFilter]   = useState('')
  const [rankFilter,   setRankFilter]   = useState('')

  const totalPages  = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const rankOptions = useMemo(() => {
    const set = new Set(solicitantes.map((s) => (s.rank || '').trim()).filter(Boolean))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [solicitantes])

  useEffect(() => {
    inventoryApi.getLocations({ page_size: 300 })
      .then((r) => setLocations(r.data.results || r.data))
      .catch(() => {})
  }, [])

  useEffect(() => { setPage(1); load(1) }, [statusFilter, unitFilter, rankFilter])

  const load = async (p = page) => {
    setLoading(true)
    try {
      const params = { page: p, page_size: PAGE_SIZE }
      if (search.trim())  params.search    = search.trim()
      if (statusFilter !== '') params.is_active = statusFilter
      if (unitFilter)     params.unit      = unitFilter
      if (rankFilter)     params.rank      = rankFilter
      const { data } = await solicitanteApi.list(params)
      const list = data.results ?? data
      setSolicitantes(list)
      setTotalCount(data.count ?? list.length)
    } catch {
      toast.error('No se pudieron cargar los solicitantes')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => { setPage(1); load(1) }

  const handleReset = () => {
    setSearch(''); setStatusFilter('true'); setUnitFilter(''); setRankFilter('')
    setPage(1); load(1)
  }

  const handlePage = (dir) => {
    const next = page + dir
    if (next < 1 || next > totalPages) return
    setPage(next); load(next)
  }

  const handleDisable = async (sol) => {
    try {
      await solicitanteApi.disable(sol.id)
      toast.success('Solicitante deshabilitado')
      load(page)
    } catch { toast.error('No se pudo deshabilitar') }
  }

  const handleReactivate = async (sol) => {
    try {
      await solicitanteApi.partialUpdate(sol.id, { is_active: true })
      toast.success('Solicitante reactivado')
      load(page)
    } catch { toast.error('No se pudo reactivar') }
  }

  const activeCount   = solicitantes.filter((s) => s.is_active).length
  const inactiveCount = solicitantes.filter((s) => !s.is_active).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Solicitantes</h2>
          <p className="mt-1 text-sm text-gray-500">
            Personal y unidades que solicitan mercancía o servicios al taller.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => navigate('/solicitantes/new')}
            className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo solicitante
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total',    value: totalCount,    color: 'bg-brand-50 border-brand-100 text-brand-800' },
          { label: 'Activos',  value: activeCount,   color: 'bg-emerald-50 border-emerald-100 text-emerald-800' },
          { label: 'Inactivos',value: inactiveCount, color: 'bg-gray-50 border-gray-200 text-gray-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`rounded-2xl border p-4 shadow-sm ${color}`}>
            <p className="text-xs font-semibold uppercase opacity-70">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Nombre, rango, cédula dominicana…"
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
          <select value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todas las unidades</option>
            {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.breadcrumb || loc.name}</option>)}
          </select>
          <select value={rankFilter} onChange={(e) => setRankFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos los rangos</option>
            {rankOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
            <option value="">Todos</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleSearch} className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">Filtrar</button>
            <button onClick={handleReset} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <ArrowPathIcon className="h-4 w-4" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-600">Cargando…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
            <p className="text-sm font-semibold text-gray-700">{totalCount} solicitantes</p>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Pág. {page} / {totalPages}</span>
              <button onClick={() => handlePage(-1)} disabled={page <= 1} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40">‹</button>
              <button onClick={() => handlePage(1)} disabled={page >= totalPages} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40">›</button>
            </div>
          </div>

          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Solicitante</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Unidad / Base</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Cédula dominicana</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                {canManage && <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {solicitantes.map((sol) => (
                <tr key={sol.id} className={`hover:bg-gray-50 ${!sol.is_active ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                        <UserCircleIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">
                          {sol.rank ? <span className="text-gray-500">{sol.rank} </span> : null}
                          {sol.name}
                        </p>
                        {sol.notes && <p className="text-xs text-gray-400">{sol.notes}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-700">{sol.unit_name || '—'}</td>
                  <td className="px-5 py-4 font-mono text-xs text-gray-600">{sol.agent_id || '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${sol.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {sol.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button onClick={() => navigate(`/solicitantes/${sol.id}/edit`)}
                          className="text-xs font-medium text-brand-700 hover:text-brand-900">Editar</button>
                        {sol.is_active ? (
                          <button onClick={() => handleDisable(sol)}
                            className="text-xs font-medium text-red-600 hover:text-red-800">Deshabilitar</button>
                        ) : (
                          <button onClick={() => handleReactivate(sol)}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-800">Reactivar</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {solicitantes.length === 0 && (
                <tr>
                  <td colSpan={canManage ? 5 : 4} className="px-5 py-8 text-center text-sm text-gray-500">
                    No se encontraron solicitantes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Bottom pagination */}
          <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
            <p className="text-xs text-gray-500">{PAGE_SIZE} por página</p>
            <div className="flex items-center gap-2">
              <button onClick={() => handlePage(-1)} disabled={page <= 1} className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">Anterior</button>
              <span className="text-sm text-gray-500">Página {page} de {totalPages}</span>
              <button onClick={() => handlePage(1)} disabled={page >= totalPages} className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}