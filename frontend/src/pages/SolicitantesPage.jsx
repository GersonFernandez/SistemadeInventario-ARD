import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { PlusIcon, PencilSquareIcon } from '@heroicons/react/24/outline'
import { solicitanteApi } from '../services/workOrderApi'
import { inventoryApi } from '../services/inventoryApi'
import { useAuth } from '../context/AuthContext'

export default function SolicitantesPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const canManage = user?.role === 'admin' || user?.role === 'almacenista'

  const [solicitantes, setSolicitantes] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('true')
  const [unitFilter, setUnitFilter] = useState('all')
  const [rankFilter, setRankFilter] = useState('all')

  useEffect(() => {
    loadLocations()
  }, [])

  useEffect(() => {
    loadSolicitantes()
  }, [statusFilter])

  const locationMap = useMemo(() => {
    const map = {}
    locations.forEach((loc) => {
      map[String(loc.id)] = loc.breadcrumb || loc.name
    })
    return map
  }, [locations])

  const rankOptions = useMemo(() => {
    const set = new Set(
      solicitantes
        .map((sol) => (sol.rank || '').trim())
        .filter(Boolean),
    )
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
  }, [solicitantes])

  const filteredSolicitantes = useMemo(() => {
    return solicitantes.filter((sol) => {
      if (unitFilter !== 'all' && String(sol.unit || '') !== unitFilter) return false
      if (rankFilter !== 'all' && (sol.rank || '').trim() !== rankFilter) return false
      return true
    })
  }, [solicitantes, unitFilter, rankFilter])

  const loadLocations = async () => {
    try {
      const { data } = await inventoryApi.getLocations({ page_size: 300 })
      setLocations(data.results || data)
    } catch {
      toast.error('No se pudieron cargar las ubicaciones')
    }
  }

  const loadSolicitantes = async (overrideSearch = search) => {
    setLoading(true)
    try {
      const params = {}
      if (overrideSearch?.trim()) params.search = overrideSearch.trim()
      if (statusFilter !== 'all') params.is_active = statusFilter
      const { data } = await solicitanteApi.list(params)
      setSolicitantes(data.results || data)
    } catch {
      toast.error('No se pudieron cargar los solicitantes')
    } finally {
      setLoading(false)
    }
  }

  const handleDisable = async (sol) => {
    if (!window.confirm(`¿Desea deshabilitar a ${sol.rank ? `${sol.rank} ` : ''}${sol.name}?`)) return
    try {
      await solicitanteApi.disable(sol.id)
      toast.success('Solicitante deshabilitado')
      await loadSolicitantes()
    } catch (error) {
      const message = error.response?.data?.detail || 'No se pudo deshabilitar el solicitante'
      toast.error(message)
    }
  }

  const handleReactivate = async (sol) => {
    if (!window.confirm(`¿Desea reactivar a ${sol.rank ? `${sol.rank} ` : ''}${sol.name}?`)) return
    try {
      await solicitanteApi.partialUpdate(sol.id, { is_active: true })
      toast.success('Solicitante reactivado')
      await loadSolicitantes()
    } catch (error) {
      const message = error.response?.data?.detail || 'No se pudo reactivar el solicitante'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Solicitantes</h2>
          <p className="mt-1 text-sm text-gray-600">
            Administración de personal o unidades que reciben mercancía en despachos.
          </p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => navigate('/solicitantes/new')}
            className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            <PlusIcon className="h-4 w-4" />
            Nuevo solicitante
          </button>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadSolicitantes(e.currentTarget.value)}
            placeholder="Buscar por nombre, rango o cédula"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm md:col-span-2"
          />
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">Todas las unidades</option>
            {locations.map((loc) => (
              <option key={loc.id} value={String(loc.id)}>{loc.breadcrumb || loc.name}</option>
            ))}
          </select>
          <select
            value={rankFilter}
            onChange={(e) => setRankFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">Todos los rangos</option>
            {rankOptions.map((rank) => (
              <option key={rank} value={rank}>{rank}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="true">Activos</option>
            <option value="false">Inactivos</option>
            <option value="all">Todos</option>
          </select>
          <button
            type="button"
            onClick={() => loadSolicitantes()}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Filtrar
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-600">Cargando solicitantes...</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Solicitante</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Unidad</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Cédula / ID</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-gray-500">Estado</th>
                <th className="px-4 py-3 text-right font-medium uppercase tracking-wide text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredSolicitantes.map((sol) => (
                <tr key={sol.id}>
                  <td className="px-4 py-3 text-gray-900">
                    <p className="font-medium">{sol.full_name || `${sol.rank ? `${sol.rank} ` : ''}${sol.name}`}</p>
                    {sol.notes ? <p className="mt-0.5 text-xs text-gray-500">{sol.notes}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{sol.unit_name || locationMap[String(sol.unit)] || 'Sin unidad'}</td>
                  <td className="px-4 py-3 text-gray-700">{sol.agent_id || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${sol.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                      {sol.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage ? (
                      <div className="inline-flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => navigate(`/solicitantes/${sol.id}/edit`)}
                          className="inline-flex items-center gap-1 text-brand-700 hover:text-brand-900"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                          Editar
                        </button>
                        {sol.is_active && (
                          <button
                            type="button"
                            onClick={() => handleDisable(sol)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Deshabilitar
                          </button>
                        )}
                        {!sol.is_active && (
                          <button
                            type="button"
                            onClick={() => handleReactivate(sol)}
                            className="text-emerald-700 hover:text-emerald-900"
                          >
                            Reactivar
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Sin permisos</span>
                    )}
                  </td>
                </tr>
              ))}

              {filteredSolicitantes.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">
                    No se encontraron solicitantes para los filtros seleccionados.
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
