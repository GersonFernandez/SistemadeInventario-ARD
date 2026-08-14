import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  DocumentArrowDownIcon,
  PrinterIcon,
  WrenchScrewdriverIcon,
  CubeIcon,
  FunnelIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { inventoryApi, getMediaUrl } from '../services/inventoryApi'
import { downloadBlob } from '../utils/download'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/permissions'

const PAGE_SIZE = 25

const unitStatusBadge = {
  available:   { label: 'Disponible',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  asignado:    { label: 'Asignado',      cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  maintenance: { label: 'Mantenimiento', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
  disposed:    { label: 'Dado de baja',  cls: 'bg-gray-100 text-gray-600 border-gray-300' },
}

export default function InventoryPage() {
  const { user } = useAuth()
  const canEdit = hasPermission(user, 'inventory.manage', ['admin', 'almacenista'])
  const canExport = hasPermission(user, 'reports.export', ['admin', 'almacenista', 'tecnico'])

  const [items, setItems]               = useState([])
  const [categories, setCategories]     = useState([])
  const [locations, setLocations]       = useState([])
  const [unitsByItem, setUnitsByItem]   = useState({})
  const [loading, setLoading]           = useState(true)
  const [page, setPage]                 = useState(1)
  const [totalCount, setTotalCount]     = useState(0)
  const [criticalTotalCount, setCriticalTotalCount] = useState(0)
  const [showReportMenu, setShowReportMenu] = useState(false)
  const [expandedTools, setExpandedTools]  = useState({})

  // ── Filters ──
  const [search,          setSearch]          = useState('')
  const [filterCategory,  setFilterCategory]  = useState('')
  const [filterLocation,  setFilterLocation]  = useState('')
  const [filterKind,      setFilterKind]      = useState('')
  const [filterCritical,  setFilterCritical]  = useState('')
  const [filterStatus,    setFilterStatus]    = useState('active') // active | inactive | all

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // close report dropdown on outside click
  useEffect(() => {
    if (!showReportMenu) return
    const handler = (e) => { if (!e.target.closest('[data-report-menu]')) setShowReportMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showReportMenu])

  // load catalogs once
  useEffect(() => {
    const load = async () => {
      try {
        const [c, l] = await Promise.all([inventoryApi.getCategories(), inventoryApi.getLocations()])
        setCategories(c.data.results || c.data)
        setLocations(l.data.results || l.data)
      } catch { /* non-critical */ }
    }
    load()
  }, [])

  const buildBaseFilters = useCallback(() => {
    const params = {}
    if (search.trim()) params.search = search.trim()
    if (filterCategory) params.category = filterCategory
    if (filterLocation) params.location = filterLocation
    if (filterKind) params.kind = filterKind
    if (filterStatus === 'active') params.is_active = 'true'
    if (filterStatus === 'inactive') params.is_active = 'false'
    return params
  }, [search, filterCategory, filterLocation, filterKind, filterStatus])

  const fetchItems = useCallback(async (targetPage = 1) => {
    setLoading(true)
    try {
      const params = { ...buildBaseFilters(), page: targetPage, page_size: PAGE_SIZE }
      if (filterCritical) params.critical = filterCritical

      const { data } = await inventoryApi.getItems(params)
      const list = data.results || data
      setItems(list)
      setTotalCount(data.count ?? list.length)

      const { data: criticalData } = await inventoryApi.getItems({
        ...buildBaseFilters(),
        page: 1,
        page_size: 1,
        critical: 'true',
      })
      setCriticalTotalCount(criticalData.count ?? (criticalData.results || criticalData).length ?? 0)

      // load units for tool items (track_by_serial)
      const toolIds = list.filter((i) => i.track_by_serial).map((i) => i.id)
      const unitsMap = {}
      await Promise.all(toolIds.map(async (id) => {
        try {
          const r = await inventoryApi.getItemUnits({ item: id, page_size: 50 })
          unitsMap[id] = r.data.results || r.data
        } catch {
          unitsMap[id] = []
        }
      }))
      setUnitsByItem(unitsMap)
    } catch {
      toast.error('No se pudo cargar el inventario')
    } finally {
      setLoading(false)
    }
  }, [buildBaseFilters, filterCritical])

  // re-fetch when filters change
  useEffect(() => {
    setPage(1)
    fetchItems(1)
  }, [filterCategory, filterLocation, filterKind, filterCritical, filterStatus])

  const handleSearch = () => { setPage(1); fetchItems(1) }
  const handleReset  = () => {
    setSearch(''); setFilterCategory(''); setFilterLocation('')
    setFilterKind(''); setFilterCritical(''); setFilterStatus('active')
    setPage(1); fetchItems(1)
  }
  const handlePage = (dir) => {
    const next = page + dir
    if (next < 1 || next > totalPages) return
    setPage(next); fetchItems(next)
  }

  const handleDownload = async (format, filters = {}, suffix = 'completo') => {
    try {
      const activeFilters = {}
      if (search.trim()) activeFilters.search = search.trim()
      if (filterCategory) activeFilters.category = filterCategory
      if (filterLocation) activeFilters.location = filterLocation
      if (filterKind) activeFilters.kind = filterKind
      if (filterCritical) activeFilters.critical = filterCritical
      if (filterStatus === 'active') activeFilters.is_active = 'true'
      if (filterStatus === 'inactive') activeFilters.is_active = 'false'

      const response = await inventoryApi.downloadInventoryReport(format, { ...activeFilters, ...filters })
      const ext = format === 'pdf' ? 'pdf' : 'xlsx'
      downloadBlob(response, `inventario_${suffix}_${new Date().toISOString().slice(0, 10)}.${ext}`)
    } catch {
      toast.error('No se pudo generar el reporte')
    }
  }

  const handleLocationExport = async (format) => {
    if (!filterLocation) {
      toast.error('Seleccione una ubicación para exportar su reporte.')
      return
    }
    const locationName = locations.find((l) => String(l.id) === String(filterLocation))?.name || 'ubicacion'
    await handleDownload(format, { location: filterLocation }, `ubicacion_${locationName.replace(/\s+/g, '_').toLowerCase()}`)
  }

  const handlePrintCompleteInventory = async () => {
    try {
      const response = await inventoryApi.downloadInventoryReport('pdf', {})
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')
      if (!printWindow) {
        toast.error('Habilite ventanas emergentes para imprimir el inventario.')
        return
      }
      printWindow.addEventListener('load', () => printWindow.print())
    } catch {
      toast.error('No se pudo preparar la impresión del inventario completo')
    }
  }

  const handleToggleActive = async (item) => {
    try {
      await inventoryApi.updateItem(item.id, { is_active: !item.is_active })
      toast.success(item.is_active ? 'Artículo deshabilitado' : 'Artículo habilitado')
      fetchItems(page)
    } catch {
      toast.error('No se pudo cambiar el estado')
    }
  }

  const toggleTool = (id) => setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }))

  // ── summary counts ──
  const criticalCount = criticalTotalCount
  const toolCount     = items.filter((i) => i.track_by_serial).length
  const consumCount   = items.filter((i) => !i.track_by_serial).length

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-100">Taller Electrónica · ARD</p>
            <h2 className="mt-1 text-2xl font-bold">Inventario</h2>
            <p className="mt-2 max-w-2xl text-sm text-brand-50">
              Stock de consumibles y registro de herramientas e instrumentos por serial, con filtros avanzados y exportación.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <div className="relative" data-report-menu>
                <button
                  onClick={() => setShowReportMenu((s) => !s)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
                >
                  <DocumentArrowDownIcon className="h-4 w-4" />
                  Reportes
                  <ChevronDownIcon className="h-3 w-3" />
                </button>
                {showReportMenu && (
                  <div className="absolute right-0 mt-1 w-64 rounded-xl border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
                    <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 border-b border-gray-100">Inventario completo</div>
                    <button onClick={() => { handleDownload('pdf', {}, 'completo'); setShowReportMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">PDF completo</button>
                    <button onClick={() => { handleDownload('excel', {}, 'completo'); setShowReportMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">Excel completo</button>
                    <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 border-y border-gray-100">Stock crítico</div>
                    <button onClick={() => { handleDownload('pdf', { critical: 'true' }, 'critico'); setShowReportMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50">PDF stock crítico</button>
                    <button onClick={() => { handleDownload('excel', { critical: 'true' }, 'critico'); setShowReportMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50">Excel stock crítico</button>
                    <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 border-y border-gray-100">Herramientas</div>
                    <button onClick={() => { handleDownload('pdf', { kind: 'herramienta' }, 'herramientas'); setShowReportMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">PDF herramientas</button>
                    <button onClick={() => { handleDownload('excel', { kind: 'herramienta' }, 'herramientas'); setShowReportMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">Excel herramientas</button>
                    <div className="px-3 py-2 text-xs font-semibold uppercase text-gray-500 border-y border-gray-100">Por ubicación</div>
                    <button onClick={() => { handleLocationExport('pdf'); setShowReportMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">PDF ubicación seleccionada</button>
                    <button onClick={() => { handleLocationExport('excel'); setShowReportMenu(false) }} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">Excel ubicación seleccionada</button>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={handlePrintCompleteInventory}
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20"
            >
              <PrinterIcon className="h-4 w-4" />
              Imprimir inventario completo
            </button>
          </div>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total en página" value={items.length} sub={`de ${totalCount}`} color="brand" icon={CubeIcon} />
        <StatCard label="Stock crítico" value={criticalCount} color="red" icon={ExclamationTriangleIcon} clickable onClick={() => { setFilterStatus('active'); setFilterCritical('true') }} />
        <StatCard label="Herramientas" value={toolCount} color="indigo" icon={WrenchScrewdriverIcon} clickable onClick={() => setFilterKind('herramienta')} />
        <StatCard label="Consumibles" value={consumCount} color="emerald" icon={CubeIcon} clickable onClick={() => setFilterKind('consumible')} />
      </div>

      {/* ── Filters ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[240px] flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Nombre, código, SKU, número de parte…"
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
            />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterLocation} onChange={(e) => setFilterLocation(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todas las ubicaciones</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.breadcrumb || l.name}</option>)}
          </select>
          <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos los tipos</option>
            <option value="consumible">Consumibles / Repuestos</option>
            <option value="herramienta">Herramientas / Instrumentos</option>
          </select>
          <select value={filterCritical} onChange={(e) => setFilterCritical(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos (críticos y no críticos)</option>
            <option value="true">Solo stock crítico</option>
            <option value="false">Excluir stock crítico</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="active">Solo activos</option>
            <option value="inactive">Solo inactivos</option>
            <option value="all">Todos</option>
          </select>
          <div className="flex gap-2">
            <button onClick={handleSearch} className="inline-flex items-center gap-1 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">
              <FunnelIcon className="h-4 w-4" /> Buscar
            </button>
            <button onClick={handleReset} className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <ArrowPathIcon className="h-4 w-4" /> Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* top bar */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <p className="text-sm font-semibold text-gray-700">
            {loading ? 'Cargando…' : `${totalCount} artículos`}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Pág. {page} / {totalPages}</span>
            <button onClick={() => handlePage(-1)} disabled={page <= 1} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40">‹ Ant.</button>
            <button onClick={() => handlePage(1)} disabled={page >= totalPages} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40">Sig. ›</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-14 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Foto</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Artículo</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Categoría</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Marca / Modelo</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Ubicación</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Stock</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                {canEdit && <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr><td colSpan={canEdit ? 9 : 8} className="px-5 py-10 text-center text-gray-500">Cargando inventario…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={canEdit ? 9 : 8} className="px-5 py-10 text-center text-gray-500">No se encontraron artículos con los filtros actuales.</td></tr>
              ) : items.map((item) => {
                const isTool = item.track_by_serial
                const units  = isTool ? (unitsByItem[item.id] || []) : []
                const expanded = !!expandedTools[item.id]
                return (
                  <React.Fragment key={item.id}>
                    <tr key={item.id} className={`hover:bg-gray-50 ${!item.is_active ? 'opacity-60' : ''}`}>
                      {/* foto */}
                      <td className="px-4 py-3">
                        {item.image_url ? (
                          <img src={getMediaUrl(item.image_url)} alt={item.name} className="h-10 w-10 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-300">
                            {isTool ? <WrenchScrewdriverIcon className="h-5 w-5" /> : <CubeIcon className="h-5 w-5" />}
                          </div>
                        )}
                      </td>
                      {/* artículo */}
                      <td className="px-5 py-3">
                        <Link to={`/products/${item.id}`} className="font-semibold text-brand-800 hover:underline">{item.name}</Link>
                        <p className="font-mono text-xs text-gray-400">{item.code || '—'}{item.part_number ? ` · P/N: ${item.part_number}` : ''}</p>
                        {isTool && (
                          <button onClick={() => toggleTool(item.id)} className="mt-0.5 inline-flex items-center gap-0.5 text-xs text-brand-600 hover:text-brand-800">
                            {expanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />}
                            {item.units_count ?? units.length} unidad{(item.units_count ?? units.length) !== 1 ? 'es' : ''}
                          </button>
                        )}
                      </td>
                      {/* categoría */}
                      <td className="px-5 py-3 text-gray-700">{item.category_name || '—'}</td>
                      {/* marca / modelo */}
                      <td className="px-5 py-3 text-gray-700">
                        {item.brand_name || item.marca || '—'}
                        {(item.product_model_name || item.modelo) && (
                          <span className="block text-xs text-gray-400">{item.product_model_name || item.modelo}</span>
                        )}
                      </td>
                      {/* ubicación */}
                      <td className="px-5 py-3 text-gray-700">{item.location_display || item.location_breadcrumb || '—'}</td>
                      {/* tipo */}
                      <td className="px-5 py-3 text-gray-700">{item.kind_display || item.kind || '—'}</td>
                      {/* stock */}
                      <td className="px-5 py-3 text-center">
                        {isTool ? (
                          <span className="text-sm font-semibold text-gray-700">{item.stock_available ?? 0} disp.</span>
                        ) : (
                          <div>
                            <span className={`text-sm font-bold ${item.is_critical ? 'text-red-600' : 'text-gray-900'}`}>
                              {item.stock_available ?? 0}
                            </span>
                            {item.unit_name && <span className="ml-1 text-xs text-gray-400">{item.unit_name}</span>}
                            {item.minimum_stock > 0 && (
                              <p className="text-xs text-gray-400">Mín: {item.minimum_stock}</p>
                            )}
                          </div>
                        )}
                      </td>
                      {/* estado */}
                      <td className="px-5 py-3">
                        {!isTool && item.is_critical ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            <ExclamationTriangleIcon className="h-3 w-3" /> Crítico
                          </span>
                        ) : (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {item.is_active ? 'Activo' : 'Inactivo'}
                          </span>
                        )}
                      </td>
                      {/* acciones */}
                      {canEdit && (
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-3">
                            <Link to={`/products/${item.id}/edit`} className="text-xs font-medium text-brand-700 hover:text-brand-900">Editar</Link>
                            <button
                              onClick={() => handleToggleActive(item)}
                              className={`text-xs font-medium ${item.is_active ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'}`}
                            >
                              {item.is_active ? 'Deshabilitar' : 'Habilitar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* ── expandable tool units sub-row ── */}
                    {isTool && expanded && (
                      <tr key={`${item.id}-units`} className="bg-brand-50/40">
                        <td colSpan={canEdit ? 9 : 8} className="px-8 py-3">
                          {units.length === 0 ? (
                            <p className="text-sm italic text-gray-500">Sin unidades registradas.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {units.map((u) => {
                                const badge = unitStatusBadge[u.status] || { label: u.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
                                return (
                                  <div key={u.id} className={`inline-flex flex-col rounded-lg border px-3 py-2 text-xs ${badge.cls}`}>
                                    <span className="font-mono font-semibold">{u.serial_number}</span>
                                    <span className="mt-0.5 font-medium">{badge.label}</span>
                                    {u.active_loan?.recipient?.name && (
                                      <span className="text-[11px] opacity-80">→ {u.active_loan.recipient.name}</span>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* bottom pagination */}
        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <p className="text-xs text-gray-500">{PAGE_SIZE} artículos por página</p>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePage(-1)} disabled={page <= 1} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40">Anterior</button>
            <span className="text-sm text-gray-600">Página {page} de {totalPages}</span>
            <button onClick={() => handlePage(1)} disabled={page >= totalPages} className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon: Icon, color, onClick, clickable }) {
  const palette = {
    brand:   { card: 'border-brand-100 bg-brand-50',   text: 'text-brand-800',   icon: 'text-brand-500' },
    red:     { card: 'border-red-100 bg-red-50',       text: 'text-red-800',     icon: 'text-red-400' },
    indigo:  { card: 'border-indigo-100 bg-indigo-50', text: 'text-indigo-800',  icon: 'text-indigo-400' },
    emerald: { card: 'border-emerald-100 bg-emerald-50', text: 'text-emerald-800', icon: 'text-emerald-500' },
  }
  const p = palette[color] || palette.brand
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border p-4 shadow-sm ${p.card} ${clickable ? 'cursor-pointer hover:opacity-80 transition' : ''}`}
    >
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wide opacity-70 ${p.text}`}>{label}</p>
        <Icon className={`h-5 w-5 ${p.icon}`} />
      </div>
      <p className={`mt-2 text-3xl font-bold ${p.text}`}>{value}</p>
      {sub && <p className={`mt-0.5 text-xs opacity-60 ${p.text}`}>{sub}</p>}
    </div>
  )
}

const unitStateStyle = {
  available: 'bg-green-100 text-green-800 border-green-200',
  asignado: 'bg-amber-100 text-amber-800 border-amber-200',
  maintenance: 'bg-blue-100 text-blue-800 border-blue-200',
  disposed: 'bg-gray-100 text-gray-800 border-gray-300',
}