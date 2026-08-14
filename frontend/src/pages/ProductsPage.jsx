import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  CubeIcon,
  TagIcon,
  MapPinIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  DocumentArrowDownIcon,
  ChevronDownIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { productApi } from '../services/productApi'
import { inventoryApi } from '../services/inventoryApi'
import RemoteEntityPicker from '../components/RemoteEntityPicker'
import { downloadBlob } from '../utils/download'
import { useAuth } from '../context/AuthContext'
import { hasPermission } from '../utils/permissions'

const kindBadge = {
  consumible:  { label: 'Consumible',  cls: 'bg-blue-100 text-blue-800' },
  herramienta: { label: 'Herramienta', cls: 'bg-purple-100 text-purple-800' },
}

export default function ProductsPage() {
  const { user } = useAuth()
  const canCreate = hasPermission(user, 'products.manage', ['admin', 'almacenista'])
  const canExport = hasPermission(user, 'reports.export', ['admin', 'almacenista', 'tecnico'])

  // ── catalogs ──
  const [categories, setCategories]     = useState([])
  const [states, setStates]             = useState([])
  const [unitMeasures, setUnitMeasures] = useState([])

  // ── list ──
  const [products, setProducts]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [showReportMenu, setShowReportMenu] = useState(false)

  // ── list filters ──
  const [search,         setSearch]         = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterKind,     setFilterKind]     = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')

  // ── creation form ──
  const [saving, setSaving]       = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [showForm, setShowForm]   = useState(false)
  const [selectedCategoryEntity, setSelectedCategoryEntity] = useState(null)
  const [selectedBrandEntity, setSelectedBrandEntity] = useState(null)
  const [selectedModelEntity, setSelectedModelEntity] = useState(null)
  const [selectedLocationEntity, setSelectedLocationEntity] = useState(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryDescription, setNewCategoryDescription] = useState('')
  const [creatingCategory, setCreatingCategory] = useState(false)
  const [form, setForm] = useState({
    name: '', part_number: '', application: '',
    category: '', brand: '', product_model: '', state: '',
    location: '', kind: 'consumible', minimum_stock: 0, unit: '',
    description: '', technical_specs: '', datasheet_url: '',
    is_active: true,
  })

  const searchCategories = async (query) => {
    const { data } = await productApi.getCategories({ search: query, page_size: 50 })
    return (data.results || data || []).sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  }

  const searchBrands = async (query) => {
    const { data } = await productApi.getBrands({ search: query, is_active: true, page_size: 50 })
    return (data.results || data || []).sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  }

  const searchModels = async (query) => {
    const params = { search: query, is_active: true, page_size: 50 }
    if (form.brand) params.brand = form.brand
    const { data } = await productApi.getProductModels(params)
    return (data.results || data || []).sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  }

  const searchLocations = async (query) => {
    const { data } = await productApi.getLocations({ search: query, page_size: 50 })
    return (data.results || data || []).sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  }

  // close report dropdown on outside click
  useEffect(() => {
    if (!showReportMenu) return
    const handler = (e) => { if (!e.target.closest('[data-report-menu]')) setShowReportMenu(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showReportMenu])

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [p, c, s, u] = await Promise.all([
        productApi.getItems({ page_size: 200, is_active: '' }),
        productApi.getCategories(),
        productApi.getProductStates({ is_active: true }),
        productApi.getUnitMeasures({ is_active: true }),
      ])
      const norm = (r) => r.data.results ?? r.data
      setProducts(norm(p))
      setCategories(norm(c))
      setStates(norm(s))
      setUnitMeasures(norm(u))
    } catch {
      toast.error('No se pudieron cargar los datos de productos')
    } finally {
      setLoading(false)
    }
  }

  const fetchProducts = async (overrides = {}) => {
    setLoading(true)
    try {
      const effectiveSearch = overrides.search ?? search
      const effectiveCategory = overrides.filterCategory ?? filterCategory
      const effectiveKind = overrides.filterKind ?? filterKind
      const effectiveStatus = overrides.filterStatus ?? filterStatus

      const params = { page_size: 200 }
      if (effectiveSearch.trim())  params.search   = effectiveSearch.trim()
      if (effectiveCategory) params.category = effectiveCategory
      if (effectiveKind)     params.kind     = effectiveKind
      if (effectiveStatus)   params.is_active = effectiveStatus
      const { data } = await productApi.getItems(params)
      setProducts(data.results ?? data)
    } catch {
      toast.error('No se pudieron cargar los productos')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (format) => {
    setShowReportMenu(false)
    try {
      const response = await inventoryApi.downloadInventoryReport(format, {})
      downloadBlob(response, `productos_${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
    } catch {
      toast.error('No se pudo generar el reporte')
    }
  }

  const handleClearFilters = () => {
    const cleared = {
      search: '',
      filterCategory: '',
      filterKind: '',
      filterStatus: '',
    }
    setSearch(cleared.search)
    setFilterCategory(cleared.filterCategory)
    setFilterKind(cleared.filterKind)
    setFilterStatus(cleared.filterStatus)
    fetchProducts(cleared)
  }

  const toggleProduct = async (id, isActive) => {
    try {
      await productApi.updateItem(id, { is_active: !isActive })
      toast.success(isActive ? 'Producto deshabilitado' : 'Producto habilitado')
      loadAll()
    } catch {
      toast.error('No se pudo cambiar el estado del producto')
    }
  }

  // form helpers
  const set = (field) => (e) => {
    const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    setForm((prev) => ({
      ...prev,
      [field]: val,
      ...(field === 'brand' ? { product_model: '' } : {}),
    }))
  }

  const resetForm = () => {
    setForm({
      name: '', part_number: '', application: '',
      category: '', brand: '', product_model: '', state: '',
      location: '', kind: 'consumible', minimum_stock: 0, unit: '',
      description: '', technical_specs: '', datasheet_url: '',
      is_active: true,
    })
    setSelectedCategoryEntity(null)
    setSelectedBrandEntity(null)
    setSelectedModelEntity(null)
    setSelectedLocationEntity(null)
    setImageFile(null)
    setShowForm(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.category) { toast.error('Nombre y categoría son obligatorios'); return }
    if (!form.brand)         { toast.error('La marca es obligatoria'); return }
    if (!form.product_model) { toast.error('El modelo es obligatorio'); return }

    setSaving(true)
    try {
      const payload = new FormData()
      payload.append('name', form.name)
      payload.append('part_number', form.part_number || '')
      payload.append('category', form.category)
      payload.append('brand', form.brand)
      payload.append('product_model', form.product_model)
      if (form.state)    payload.append('state', form.state)
      if (form.location) payload.append('location', form.location)
      payload.append('kind', form.kind)
      payload.append('track_by_serial', form.kind === 'herramienta' ? 'true' : 'false')
      payload.append('quantity', 0)
      payload.append('minimum_stock', Number(form.minimum_stock || 0))
      if (form.unit) payload.append('unit', form.unit)
      payload.append('is_active', form.is_active)
      const finalDescription = [
        form.description?.trim(),
        form.technical_specs?.trim() ? `Especificaciones técnicas:\n${form.technical_specs.trim()}` : '',
        form.datasheet_url?.trim() ? `Ficha técnica: ${form.datasheet_url.trim()}` : '',
      ].filter(Boolean).join('\n\n')
      payload.append('description', finalDescription)
      payload.append('application', form.application || '')
      if (imageFile) payload.append('image', imageFile)

      await productApi.createItem(payload)
      toast.success('Producto creado')
      resetForm()
      loadAll()
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        Object.values(error.response?.data || {}).flat().join(', ') ||
        'No se pudo crear el producto'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Debe escribir el nombre de la categoría')
      return
    }

    setCreatingCategory(true)
    try {
      const payload = {
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim(),
      }
      const { data } = await productApi.createCategory(payload)
      const created = data.results || data
      const createdCategory = Array.isArray(created) ? created[0] : created

      setCategories((prev) => {
        const list = Array.isArray(prev) ? [...prev] : []
        const exists = list.some((item) => String(item.id) === String(createdCategory.id))
        if (exists) return list
        return [...list, createdCategory].sort((a, b) => a.name.localeCompare(b.name))
      })
      setForm((prev) => ({ ...prev, category: String(createdCategory.id) }))
      setSelectedCategoryEntity(createdCategory)
      setNewCategoryName('')
      setNewCategoryDescription('')
      toast.success('Categoría creada')
    } catch (error) {
      const message = error.response?.data?.detail || Object.values(error.response?.data || {}).flat().join(', ') || 'No se pudo crear la categoría'
      toast.error(message)
    } finally {
      setCreatingCategory(false)
    }
  }

  // ── RENDER ──
  // When showForm=true  → full-page creation form, list is hidden
  // When showForm=false → list view with filters

  if (showForm) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Nuevo producto</h2>
            <p className="mt-1 text-sm text-gray-600">
              Registra un nuevo artículo en el catálogo de productos del taller.
            </p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Volver al listado
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            {/* ── Left: fields ── */}
            <section className="space-y-6 xl:col-span-2">

              {/* Identificación */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <CubeIcon className="h-5 w-5 text-brand-800" />
                  <h3 className="text-lg font-semibold text-gray-900">Identificación</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombre del producto <span className="text-red-500">*</span></label>
                    <input value={form.name} onChange={set('name')} required
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Número de parte</label>
                    <input value={form.part_number} onChange={set('part_number')}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Aplicación / uso</label>
                    <input value={form.application} onChange={set('application')}
                      placeholder="Equipo o sistema donde se aplica"
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Descripción general</label>
                    <textarea value={form.description} onChange={set('description')} rows={2}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Especificaciones técnicas</label>
                    <textarea value={form.technical_specs} onChange={set('technical_specs')} rows={3}
                      placeholder="Voltaje, potencia, frecuencia, conectores, protocolo, etc."
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">URL de ficha técnica</label>
                    <input value={form.datasheet_url} onChange={set('datasheet_url')}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              {/* Catálogo */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <TagIcon className="h-5 w-5 text-brand-800" />
                  <h3 className="text-lg font-semibold text-gray-900">Catálogo</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Categoría <span className="text-red-500">*</span></label>
                    <div className="mt-1">
                      <RemoteEntityPicker
                        value={selectedCategoryEntity}
                        onChange={(row) => {
                          setSelectedCategoryEntity(row)
                          setForm((prev) => ({ ...prev, category: row ? String(row.id) : '' }))
                        }}
                        fetchOptions={searchCategories}
                        getLabel={(row) => row?.name || '—'}
                        getMeta={(row) => row?.abbreviation || 'Sin abreviatura'}
                        placeholder="Buscar categoría..."
                        minChars={1}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Nueva categoría"
                        className="rounded-md border border-gray-300 px-3 py-2 text-xs"
                      />
                      <input
                        value={newCategoryDescription}
                        onChange={(e) => setNewCategoryDescription(e.target.value)}
                        placeholder="Descripción (opcional)"
                        className="rounded-md border border-gray-300 px-3 py-2 text-xs sm:col-span-2"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateCategory}
                      disabled={creatingCategory}
                      className="mt-2 inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      {creatingCategory ? 'Creando…' : 'Crear categoría rápida'}
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Marca <span className="text-red-500">*</span></label>
                    <div className="mt-1">
                      <RemoteEntityPicker
                        value={selectedBrandEntity}
                        onChange={(row) => {
                          setSelectedBrandEntity(row)
                          setSelectedModelEntity(null)
                          setForm((prev) => ({ ...prev, brand: row ? String(row.id) : '', product_model: '' }))
                        }}
                        fetchOptions={searchBrands}
                        getLabel={(row) => row?.name || '—'}
                        getMeta={(row) => (row?.is_active ? 'Activa' : 'Inactiva')}
                        placeholder="Buscar marca..."
                        minChars={1}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Modelo <span className="text-red-500">*</span></label>
                    <div className="mt-1">
                      <RemoteEntityPicker
                        value={selectedModelEntity}
                        onChange={(row) => {
                          setSelectedModelEntity(row)
                          setForm((prev) => ({ ...prev, product_model: row ? String(row.id) : '' }))
                        }}
                        fetchOptions={searchModels}
                        getLabel={(row) => row?.name || '—'}
                        getMeta={(row) => row?.brand_name || 'Sin marca'}
                        placeholder={form.brand ? 'Buscar modelo...' : 'Seleccione marca primero...'}
                        minChars={1}
                        disabled={!form.brand}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Estado</label>
                    <select value={form.state} onChange={set('state')}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                      <option value="">Sin estado</option>
                      {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo</label>
                    <select value={form.kind} onChange={set('kind')}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                      <option value="consumible">Consumible / Repuesto</option>
                      <option value="herramienta">Herramienta / Instrumento</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Unidad de medida</label>
                    <select value={form.unit} onChange={set('unit')}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                      <option value="">Seleccione...</option>
                      {unitMeasures.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Stock mínimo</label>
                    <input type="number" min="0" value={form.minimum_stock} onChange={set('minimum_stock')}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                  </div>
                </div>
              </div>

              {/* Ubicación e imagen */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-2">
                  <MapPinIcon className="h-5 w-5 text-brand-800" />
                  <h3 className="text-lg font-semibold text-gray-900">Ubicación e imagen</h3>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Ubicación de almacenamiento</label>
                    <div className="mt-1">
                      <RemoteEntityPicker
                        value={selectedLocationEntity}
                        onChange={(row) => {
                          setSelectedLocationEntity(row)
                          setForm((prev) => ({ ...prev, location: row ? String(row.id) : '' }))
                        }}
                        fetchOptions={searchLocations}
                        getLabel={(row) => row?.breadcrumb || row?.name || '—'}
                        getMeta={(row) => row?.codigo || 'Sin código'}
                        placeholder="Buscar ubicación..."
                        minChars={1}
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Imagen del producto</label>
                    <input type="file" accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      className="mt-1 w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-brand-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-900" />
                    <p className="mt-1 text-xs text-gray-400">Máximo 2MB · JPG, PNG</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Right: summary ── */}
            <aside className="space-y-4">
              <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheckIcon className="h-5 w-5 text-brand-800" />
                  <h3 className="text-base font-semibold text-gray-900">Resumen</h3>
                </div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Nombre</dt>
                    <dd className="max-w-[140px] truncate text-right font-medium text-gray-900">
                      {form.name || <span className="text-gray-400">Sin completar</span>}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Marca</dt>
                    <dd className="font-medium text-gray-900">{selectedBrandEntity?.name || <span className="text-gray-400">—</span>}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Modelo</dt>
                    <dd className="font-medium text-gray-900">{selectedModelEntity?.name || <span className="text-gray-400">—</span>}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Tipo</dt>
                    <dd className="font-medium text-gray-900">
                      {form.kind === 'herramienta' ? 'Herramienta' : 'Consumible'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-600">Código</dt>
                    <dd className="font-mono text-xs text-gray-400">Auto-generado</dd>
                  </div>
                </dl>
                <div className="mt-5 space-y-2">
                  <button type="submit" disabled={saving}
                    className="w-full rounded-md bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50">
                    {saving ? 'Guardando...' : 'Crear producto'}
                  </button>
                  <button type="button" onClick={resetForm}
                    className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancelar
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>
    )
  }

  // ── LIST VIEW ──
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Productos electrónicos</h2>
          <p className="mt-1 text-sm text-gray-500">Catálogo de componentes, repuestos e instrumentos del taller.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <div className="relative" data-report-menu>
              <button onClick={() => setShowReportMenu((s) => !s)}
                className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <DocumentArrowDownIcon className="h-4 w-4" />
                Exportar
                <ChevronDownIcon className="h-3 w-3" />
              </button>
              {showReportMenu && (
                <div className="absolute right-0 mt-1 w-44 rounded-xl border border-gray-200 bg-white shadow-lg z-20 overflow-hidden">
                  <button onClick={() => handleDownload('pdf')} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">PDF</button>
                  <button onClick={() => handleDownload('excel')} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50">Excel</button>
                </div>
              )}
            </div>
          )}
          {canCreate && (
            <button onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">
              <PlusIcon className="h-4 w-4" />
              Nuevo producto
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-[220px] flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Nombre, código, número de parte…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
              className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-brand-700 focus:outline-none" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos los tipos</option>
            <option value="consumible">Consumibles</option>
            <option value="herramienta">Herramientas</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Todos los estados</option>
            <option value="true">Solo activos</option>
            <option value="false">Solo inactivos</option>
          </select>
          <div className="flex gap-2">
            <button onClick={fetchProducts} className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900">Filtrar</button>
            <button onClick={handleClearFilters}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Limpiar</button>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-600">Cargando…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Código</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Producto</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Marca / Modelo</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tipo</th>
                <th className="px-5 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500">Stock</th>
                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estado</th>
                {canCreate && <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {products.map((p) => {
                const badge = kindBadge[p.kind] || { label: p.kind, cls: 'bg-gray-100 text-gray-600' }
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-mono text-xs text-gray-600">{p.code || '—'}</td>
                    <td className="px-5 py-4">
                      <Link to={`/products/${p.id}`} className="font-semibold text-brand-800 hover:underline">{p.name}</Link>
                      {p.part_number && <p className="text-xs text-gray-400">P/N: {p.part_number}</p>}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-700">
                      {p.brand_name || '—'}
                      {p.product_model_name && <span className="block text-xs text-gray-400">{p.product_model_name}</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {p.track_by_serial ? (
                        <span className="text-xs text-gray-400">Por serial</span>
                      ) : (
                        <span className={`text-sm font-bold ${p.is_critical ? 'text-red-600' : 'text-gray-900'}`}>
                          {p.quantity ?? 0}
                          {p.unit_name && <span className="ml-1 text-xs font-normal text-gray-400">{p.unit_name}</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                      {p.state_name && <p className="mt-0.5 text-xs text-gray-400">{p.state_name}</p>}
                    </td>
                    {canCreate && (
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-3">
                          <Link to={`/products/${p.id}`} className="text-xs font-medium text-gray-600 hover:text-gray-900">Ver</Link>
                          <Link to={`/products/${p.id}/edit`} className="text-xs font-medium text-brand-700 hover:text-brand-900">Editar</Link>
                          <button onClick={() => toggleProduct(p.id, p.is_active)}
                            className={`text-xs font-medium ${p.is_active ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'}`}>
                            {p.is_active ? 'Deshabilitar' : 'Habilitar'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={canCreate ? 7 : 6} className="px-5 py-8 text-center text-sm text-gray-500">
                    No se encontraron productos.
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

function F({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
    </div>
  )
}
