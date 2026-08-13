import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { MagnifyingGlassIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { productApi } from '../services/productApi'

const catalogConfig = {
  brand: { label: 'Marcas', title: 'Marcas', accent: 'brand', entityType: 'brand', subtitleKey: null },
  model: { label: 'Modelos', title: 'Modelos', accent: 'indigo', entityType: 'model', subtitleKey: 'brand_name' },
  state: { label: 'Estados', title: 'Estados', accent: 'emerald', entityType: 'state', subtitleKey: 'code' },
  unit: { label: 'Unidades', title: 'Unidades', accent: 'amber', entityType: 'unit', subtitleKey: 'code' },
}

const initialCatalogState = {
  items: [],
  loading: false,
  page: 1,
  totalPages: 1,
  totalItems: 0,
  totalActive: 0,
  totalInactive: 0,
  search: '',
  filterStatus: '',   // '' | 'active' | 'inactive'
  filterBrand: '',    // brand id (models only)
}

export default function ProductCatalogsPage() {
  const searchDebounceTimers = useRef({})
  const [activeCatalog, setActiveCatalog] = useState('brand')
  const [catalogs, setCatalogs] = useState({
    brand: { ...initialCatalogState },
    model: { ...initialCatalogState },
    state: { ...initialCatalogState },
    unit: { ...initialCatalogState },
  })
  const [brandForm, setBrandForm] = useState({ name: '', description: '' })
  const [modelForm, setModelForm] = useState({ brand: '', name: '', description: '' })
  const [stateForm, setStateForm] = useState({ code: '', name: '', description: '' })
  const [unitForm, setUnitForm] = useState({ code: '', name: '', description: '' })
  const [editingId, setEditingId] = useState(null)
  const [editingType, setEditingType] = useState(null)
  const [editingData, setEditingData] = useState({})

  useEffect(() => {
    loadCatalog('brand', 1)
    loadCatalog('model', 1)
    loadCatalog('state', 1)
    loadCatalog('unit', 1)
    return () => {
      Object.values(searchDebounceTimers.current).forEach((timerId) => clearTimeout(timerId))
    }
  }, [])

  const updateCatalogState = (type, patch) => {
    setCatalogs((prev) => ({
      ...prev,
      [type]: { ...prev[type], ...patch },
    }))
  }

  const loadCatalog = async (type, page = 1, overrides = {}) => {
    const pageSize = 8
    const state = catalogs[type] ?? initialCatalogState
    const currentSearch = overrides.search ?? state.search ?? ''
    const currentStatus = overrides.filterStatus ?? state.filterStatus ?? ''
    const currentBrand  = overrides.filterBrand ?? state.filterBrand ?? ''

    updateCatalogState(type, { loading: true })

    try {
      let response
      const params = { page, page_size: pageSize }
      if (currentSearch.trim()) params.search   = currentSearch.trim()
      if (currentStatus === 'active')   params.is_active = 'true'
      if (currentStatus === 'inactive') params.is_active = 'false'
      if (type === 'model' && currentBrand) params.brand = currentBrand

      if (type === 'brand') response = await productApi.getBrands(params)
      if (type === 'model') response = await productApi.getProductModels(params)
      if (type === 'state') response = await productApi.getProductStates(params)
      if (type === 'unit')  response = await productApi.getUnitMeasures(params)

      const payload    = response?.data ?? {}
      const items      = Array.isArray(payload) ? payload : payload.results ?? []
      const totalItems = payload.count ?? items.length ?? 0
      const totalPages = payload.results ? Math.max(1, Math.ceil(totalItems / pageSize)) : 1

      // count active / inactive for badge display (only when no status filter)
      const activeCount   = items.filter((i) => i.is_active).length
      const inactiveCount = items.filter((i) => !i.is_active).length

      updateCatalogState(type, {
        items,
        loading: false,
        page,
        totalPages,
        totalItems,
        totalActive:   currentStatus ? state.totalActive   : activeCount,
        totalInactive: currentStatus ? state.totalInactive : inactiveCount,
        search:       currentSearch,
        filterStatus: currentStatus,
        filterBrand:  currentBrand,
      })
    } catch {
      updateCatalogState(type, { loading: false })
      toast.error('No se pudo cargar el catálogo solicitado')
    }
  }

  const refreshCatalogs = async () => {
    await Promise.all([
      loadCatalog('brand', 1),
      loadCatalog('model', 1),
      loadCatalog('state', 1),
      loadCatalog('unit', 1),
    ])
  }

  const createBrand = async (e) => {
    e.preventDefault()
    try {
      await productApi.createBrand(brandForm)
      setBrandForm({ name: '', description: '' })
      toast.success('Marca creada')
      await refreshCatalogs()
    } catch {
      toast.error('No se pudo crear la marca')
    }
  }

  const createModel = async (e) => {
    e.preventDefault()
    try {
      await productApi.createProductModel(modelForm)
      setModelForm({ brand: '', name: '', description: '' })
      toast.success('Modelo creado')
      await refreshCatalogs()
    } catch {
      toast.error('No se pudo crear el modelo')
    }
  }

  const createState = async (e) => {
    e.preventDefault()
    try {
      await productApi.createProductState(stateForm)
      setStateForm({ code: '', name: '', description: '' })
      toast.success('Estado creado')
      await refreshCatalogs()
    } catch {
      toast.error('No se pudo crear el estado')
    }
  }

  const createUnitMeasure = async (e) => {
    e.preventDefault()
    try {
      await productApi.createUnitMeasure(unitForm)
      setUnitForm({ code: '', name: '', description: '' })
      toast.success('Unidad creada')
      await refreshCatalogs()
    } catch {
      toast.error('No se pudo crear la unidad de medida')
    }
  }

  const toggleEntity = async (type, id, isActive) => {
    try {
      if (type === 'brand') {
        if (isActive) await productApi.deleteBrand(id)
        else await productApi.reactivateBrand(id)
      }
      if (type === 'model') {
        if (isActive) await productApi.deleteProductModel(id)
        else await productApi.reactivateProductModel(id)
      }
      if (type === 'state') {
        if (isActive) await productApi.deleteProductState(id)
        else await productApi.reactivateProductState(id)
      }
      if (type === 'unit') {
        if (isActive) await productApi.deleteUnitMeasure(id)
        else await productApi.reactivateUnitMeasure(id)
      }
      toast.success(isActive ? 'Registro deshabilitado' : 'Registro habilitado')
      await loadCatalog(type, catalogs[type].page)
      if (type === 'brand') await loadCatalog('model', catalogs.model.page)
    } catch {
      toast.error(isActive ? 'No se pudo deshabilitar' : 'No se pudo habilitar')
    }
  }

  const startEditing = (type, item) => {
    setEditingType(type)
    setEditingId(item.id)
    setEditingData({
      name: item.name || '',
      code: item.code || '',
      description: item.description || '',
      brand: item.brand ?? item.brand_id ?? '',
    })
  }

  const cancelEditing = () => {
    setEditingType(null)
    setEditingId(null)
    setEditingData({})
  }

  const saveEditing = async () => {
    try {
      const payload = {
        name: editingData.name?.trim(),
        description: editingData.description?.trim(),
      }
      if (editingType === 'state' || editingType === 'unit') {
        payload.code = editingData.code?.trim()
      }
      if (editingType === 'model') {
        payload.brand = editingData.brand
      }
      if (!payload.name) {
        toast.error('El nombre es obligatorio')
        return
      }
      if ((editingType === 'state' || editingType === 'unit') && !payload.code) {
        toast.error('El código es obligatorio')
        return
      }
      if (editingType === 'brand') await productApi.updateBrand(editingId, payload)
      if (editingType === 'model') await productApi.updateProductModel(editingId, payload)
      if (editingType === 'state') await productApi.updateProductState(editingId, payload)
      if (editingType === 'unit') await productApi.updateUnitMeasure(editingId, payload)
      toast.success('Registro actualizado')
      cancelEditing()
      await refreshCatalogs()
    } catch {
      toast.error('No se pudo actualizar el registro')
    }
  }

  const activeCatalogConfig = catalogConfig[activeCatalog]
  const activeCatalogState = catalogs[activeCatalog]
  const brandOptions = catalogs.brand.items.filter((brand) => brand.is_active)

  const applyCatalogFilters = (type, patch, page = 1) => {
    const current = catalogs[type] ?? initialCatalogState
    const merged = {
      search: patch.search ?? current.search ?? '',
      filterStatus: patch.filterStatus ?? current.filterStatus ?? '',
      filterBrand: patch.filterBrand ?? current.filterBrand ?? '',
    }
    updateCatalogState(type, merged)
    loadCatalog(type, page, merged)
  }

  const handleSearchChange = (value) => {
    const current = catalogs[activeCatalog] ?? initialCatalogState
    const merged = {
      search: value,
      filterStatus: current.filterStatus ?? '',
      filterBrand: current.filterBrand ?? '',
    }

    updateCatalogState(activeCatalog, { search: value })

    if (searchDebounceTimers.current[activeCatalog]) {
      clearTimeout(searchDebounceTimers.current[activeCatalog])
    }

    searchDebounceTimers.current[activeCatalog] = setTimeout(() => {
      loadCatalog(activeCatalog, 1, merged)
    }, 350)
  }

  const handleStatusFilterChange = (value) => {
    applyCatalogFilters(activeCatalog, { filterStatus: value }, 1)
  }

  const handleBrandFilterChange = (value) => {
    applyCatalogFilters(activeCatalog, { filterBrand: value }, 1)
  }

  const handleClearFilters = () => {
    applyCatalogFilters(activeCatalog, { search: '', filterStatus: '', filterBrand: '' }, 1)
  }

  const handlePageChange = (direction) => {
    const nextPage = activeCatalogState.page + direction
    if (nextPage < 1 || nextPage > activeCatalogState.totalPages) return
    loadCatalog(activeCatalog, nextPage)
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-100">Gestión operativa</p>
            <h2 className="mt-1 text-2xl font-bold">Catálogos de productos</h2>
            <p className="mt-2 max-w-2xl text-sm text-brand-50">
              El módulo está ahora preparado para crecer: carga por sección, paginación y búsqueda focalizada para no saturar la pantalla.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <p className="font-semibold">{Object.values(catalogs).reduce((total, section) => total + section.totalItems, 0)} registros indexados</p>
            <p className="text-brand-100">Paginación y búsqueda por catálogo</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <FormCard title="Nueva marca" description="Registra la marca del fabricante" onSubmit={createBrand}>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Nombre" value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} required />
          <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Descripción" value={brandForm.description} onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })} rows={3} />
          <button className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">Agregar marca</button>
        </FormCard>

        <FormCard title="Nuevo modelo" description="Asocia un modelo a una marca" onSubmit={createModel}>
          <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" value={modelForm.brand} onChange={(e) => setModelForm({ ...modelForm, brand: e.target.value })} required>
            <option value="">Seleccione marca</option>
            {brandOptions.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Nombre del modelo" value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} required />
          <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Descripción" value={modelForm.description} onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })} rows={3} />
          <button className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">Agregar modelo</button>
        </FormCard>

        <FormCard title="Nuevo estado" description="Define un estado para productos o equipos" onSubmit={createState}>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Código (ej: instalado)" value={stateForm.code} onChange={(e) => setStateForm({ ...stateForm, code: e.target.value })} required />
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Nombre" value={stateForm.name} onChange={(e) => setStateForm({ ...stateForm, name: e.target.value })} required />
          <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Descripción" value={stateForm.description} onChange={(e) => setStateForm({ ...stateForm, description: e.target.value })} rows={3} />
          <button className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">Agregar estado</button>
        </FormCard>

        <FormCard title="Nueva unidad" description="Agrega una unidad de medida" onSubmit={createUnitMeasure}>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Código (ej: und)" value={unitForm.code} onChange={(e) => setUnitForm({ ...unitForm, code: e.target.value })} required />
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Nombre" value={unitForm.name} onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })} required />
          <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100" placeholder="Descripción" value={unitForm.description} onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })} rows={3} />
          <button className="rounded-lg bg-brand-800 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">Agregar unidad</button>
        </FormCard>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Catálogos disponibles</h3>
            <p className="text-sm text-gray-500">Cada catálogo se gestiona por separado para sostener mejor el crecimiento del negocio.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(catalogConfig).map(([key, config]) => {
              const total = catalogs[key]?.totalItems ?? 0
              return (
                <button
                  key={key}
                  onClick={() => setActiveCatalog(key)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    activeCatalog === key ? 'bg-brand-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {config.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    activeCatalog === key ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>{total}</span>
                </button>
              )
            })}
          </div>
        </div>

        <CatalogTable
          title={activeCatalogConfig.title}
          rows={activeCatalogState.items}
          loading={activeCatalogState.loading}
          searchValue={activeCatalogState.search}
          onSearchChange={handleSearchChange}
          filterStatus={activeCatalogState.filterStatus}
          onStatusChange={handleStatusFilterChange}
          filterBrand={activeCatalogState.filterBrand}
          onBrandChange={handleBrandFilterChange}
          onClearFilters={handleClearFilters}
          page={activeCatalogState.page}
          totalPages={activeCatalogState.totalPages}
          onPageChange={handlePageChange}
          toggle={(id, isActive) => toggleEntity(activeCatalogConfig.entityType, id, isActive)}
          subtitleKey={activeCatalogConfig.subtitleKey}
          accent={activeCatalogConfig.accent}
          editingType={editingType}
          editingId={editingId}
          editingData={editingData}
          setEditingData={setEditingData}
          startEditing={(item) => startEditing(activeCatalogConfig.entityType, item)}
          cancelEditing={cancelEditing}
          saveEditing={saveEditing}
          entityType={activeCatalogConfig.entityType}
          brandOptions={brandOptions}
        />
      </div>
    </div>
  )
}

function FormCard({ title, description, onSubmit, children }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </form>
  )
}

function CatalogTable({
  title,
  rows,
  loading,
  searchValue,
  onSearchChange,
  filterStatus,
  onStatusChange,
  filterBrand,
  onBrandChange,
  onClearFilters,
  page,
  totalPages,
  onPageChange,
  toggle,
  subtitleKey,
  accent,
  editingType,
  editingId,
  editingData,
  setEditingData,
  startEditing,
  cancelEditing,
  saveEditing,
  entityType,
  brandOptions = [],
}) {
  const accentClasses = {
    brand: 'border-brand-200 bg-brand-50 text-brand-700',
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
  }

  const hasActiveFilters = searchValue || filterStatus || (entityType === 'model' && filterBrand)

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre o código…"
            className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
          />
          {searchValue && (
            <button type="button" onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Todos los estados</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>

        {/* Brand filter (models only) */}
        {entityType === 'model' && (
          <select
            value={filterBrand}
            onChange={(e) => onBrandChange(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Todas las marcas</option>
            {brandOptions.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}

        {/* Clear button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Limpiar
          </button>
        )}
      </div>

      {/* Stats row */}
      <div className={`mb-3 flex items-center justify-between text-xs ${accentClasses[accent] || accentClasses.brand} rounded-lg px-3 py-2`}>
        <span className="font-medium">Pág. {page} de {totalPages}</span>
        <span>{rows.length} registros visibles</span>
      </div>

      <div className="space-y-2 max-h-[28rem] overflow-auto pr-1">
        {loading ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
            Cargando catálogo...
          </div>
        ) : rows.map((r) => {
          const isEditing = editingType === entityType && editingId === r.id
          return (
            <div key={r.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3">
              {isEditing ? (
                <div className="space-y-2">
                  {(entityType === 'state' || entityType === 'unit') && (
                    <input
                      value={editingData.code || ''}
                      onChange={(e) => setEditingData({ ...editingData, code: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                      placeholder="Código"
                    />
                  )}
                  <input
                    value={editingData.name || ''}
                    onChange={(e) => setEditingData({ ...editingData, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                    placeholder="Nombre"
                  />
                  {entityType === 'model' && (
                    <select
                      value={editingData.brand || ''}
                      onChange={(e) => setEditingData({ ...editingData, brand: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                    >
                      <option value="">Seleccione marca</option>
                      {brandOptions.filter((brand) => brand.is_active).map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <textarea
                    value={editingData.description || ''}
                    onChange={(e) => setEditingData({ ...editingData, description: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-2 py-2 text-sm"
                    rows={2}
                    placeholder="Descripción"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={saveEditing} className="rounded bg-brand-800 px-2 py-1.5 text-xs font-semibold text-white">Guardar</button>
                    <button type="button" onClick={cancelEditing} className="rounded border border-gray-300 px-2 py-1.5 text-xs">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                    {subtitleKey && <p className="text-xs text-gray-500">{r[subtitleKey]}</p>}
                    <p className={`mt-1 text-xs font-medium ${r.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {r.is_active ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button" onClick={() => startEditing(r)} className="text-xs font-medium text-brand-700 hover:text-brand-900">
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => toggle(r.id, r.is_active)}
                      className={`text-xs font-medium ${r.is_active ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'}`}
                    >
                      {r.is_active ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!loading && rows.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-sm text-gray-500">Sin registros.</p>}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onPageChange(-1)}
          disabled={page <= 1}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Anterior
        </button>
        <span className="text-sm text-gray-500">Página {page}</span>
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={page >= totalPages}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}
