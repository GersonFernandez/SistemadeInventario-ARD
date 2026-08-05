import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { productApi } from '../services/productApi'
import { inventoryApi } from '../services/inventoryApi'
import { downloadBlob } from '../utils/download'
import { useAuth } from '../context/AuthContext'

export default function ProductsPage() {
  const { user } = useAuth()
  const canCreate = user?.role === 'admin' || user?.role === 'almacenista'

  // ── catalogs ──
  const [categories, setCategories]   = useState([])
  const [brands, setBrands]           = useState([])
  const [allModels, setAllModels]     = useState([])
  const [states, setStates]           = useState([])
  const [unitMeasures, setUnitMeasures] = useState([])
  const [locations, setLocations]     = useState([])

  // ── products list ──
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)

  // ── form ──
  const [saving, setSaving]       = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [form, setForm] = useState({
    name: '', part_number: '', numero_serie: '', application: '',
    category: '', brand: '', product_model: '', state: '',
    location: '', kind: 'consumible', minimum_stock: 0, unit: '',
    description: '', technical_specs: '', datasheet_url: '',
    is_active: true,
  })

  const filteredModels = allModels.filter(
    (m) => !form.brand || String(m.brand) === String(form.brand)
  )

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [p, c, b, m, s, u, l] = await Promise.all([
        productApi.getItems({ page_size: 200 }),
        productApi.getCategories(),
        productApi.getBrands({ is_active: true }),
        productApi.getProductModels({ is_active: true }),
        productApi.getProductStates({ is_active: true }),
        productApi.getUnitMeasures({ is_active: true }),
        productApi.getLocations({ page_size: 200 }),
      ])
      const norm = (r) => r.data.results ?? r.data
      setProducts(norm(p))
      setCategories(norm(c))
      setBrands(norm(b))
      setAllModels(norm(m))
      setStates(norm(s))
      setUnitMeasures(norm(u))
      setLocations(norm(l))
    } catch {
      toast.error('No se pudieron cargar los datos de productos')
    } finally {
      setLoading(false)
    }
  }

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
      name: '', part_number: '', numero_serie: '', application: '',
      category: '', brand: '', product_model: '', state: '',
      location: '', kind: 'consumible', minimum_stock: 0, unit: '',
      description: '', technical_specs: '', datasheet_url: '',
      is_active: true,
    })
    setImageFile(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.category) {
      toast.error('Nombre y categoría son obligatorios')
      return
    }
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

  const toggleProduct = async (id, isActive) => {
    try {
      if (isActive) {
        await productApi.deleteItem(id)
        toast.success('Producto deshabilitado')
      } else {
        await productApi.updateItem(id, { is_active: true })
        toast.success('Producto habilitado')
      }
      loadAll()
    } catch {
      toast.error('No se pudo cambiar el estado del producto')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Productos electrónicos</h2>
        <p className="mt-1 text-sm text-gray-600">
          Registro completo de productos con marca, modelo, parte, serial, estado y especificaciones técnicas.
        </p>
      </div>

      {/* ── Creation form ── */}
      {canCreate && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Crear producto</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <F label="Nombre del producto">
              <input value={form.name} onChange={set('name')} required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </F>
            <F label="Número de parte">
              <input value={form.part_number} onChange={set('part_number')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </F>
            <F label="Número de serie">
              <input value={form.numero_serie} onChange={set('numero_serie')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </F>
            <F label="Aplicación/uso">
              <input value={form.application} onChange={set('application')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </F>
            <F label="Categoría">
              <select value={form.category} onChange={set('category')} required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Seleccione...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </F>
            <F label="Marca (catálogo)">
              <select value={form.brand} onChange={set('brand')} required
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Seleccione...</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </F>
            <F label="Modelo (catálogo)">
              <select value={form.product_model} onChange={set('product_model')} required
                disabled={!form.brand}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500">
                <option value="">{form.brand ? 'Seleccione...' : 'Seleccione marca primero...'}</option>
                {filteredModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </F>
            <F label="Estado">
              <select value={form.state} onChange={set('state')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Seleccione...</option>
                {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </F>
            <F label="Ubicación">
              <select value={form.location} onChange={set('location')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Seleccione...</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.breadcrumb || l.name}</option>)}
              </select>
            </F>
            <F label="Tipo">
              <select value={form.kind} onChange={set('kind')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="consumible">Consumible / Repuesto</option>
                <option value="herramienta">Herramienta / Instrumento</option>
              </select>
            </F>
            <F label="Stock mínimo">
              <input type="number" min="0" value={form.minimum_stock} onChange={set('minimum_stock')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </F>
            <F label="Unidad">
              <select value={form.unit} onChange={set('unit')}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Seleccione...</option>
                {unitMeasures.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </F>
          </div>

          <F label="Descripción general">
            <textarea value={form.description} onChange={set('description')} rows={2}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </F>
          <F label="Especificaciones técnicas">
            <textarea value={form.technical_specs} onChange={set('technical_specs')} rows={3}
              placeholder="Voltaje, potencia, frecuencia, conectores, protocolo, etc."
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </F>
          <F label="URL de ficha técnica">
            <input value={form.datasheet_url} onChange={set('datasheet_url')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </F>
          <F label="Imagen del producto">
            <input type="file" accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </F>

          <button type="submit" disabled={saving}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50">
            {saving ? 'Guardando...' : 'Crear producto'}
          </button>
        </form>
      )}

      {/* ── Products list ── */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Productos registrados</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Código</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Producto</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Marca / Modelo</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Parte</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">Cargando...</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">Sin productos registrados.</td></tr>
            ) : products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.code || '—'}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{p.name}</td>
                <td className="px-4 py-2 text-sm text-gray-700">
                  {p.brand_name || '—'} / {p.product_model_name || '—'}
                </td>
                <td className="px-4 py-2 text-sm text-gray-700">{p.part_number || '—'}</td>
                <td className="px-4 py-2 text-sm text-gray-700">
                  <span className={`inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold ${p.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'}`}>
                    {p.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="ml-1 text-xs text-gray-500">{p.state_name || ''}</span>
                </td>
                <td className="px-4 py-2 text-sm">
                  <div className="flex flex-col gap-1">
                    <Link to={`/products/${p.id}`} className="font-medium text-brand-700 hover:text-brand-900">
                      Ver detalle
                    </Link>
                    {canCreate && (
                      <button
                        onClick={() => toggleProduct(p.id, p.is_active)}
                        className={`text-left text-xs font-medium ${p.is_active ? 'text-red-600 hover:text-red-800' : 'text-emerald-600 hover:text-emerald-800'}`}
                      >
                        {p.is_active ? 'Deshabilitar' : 'Habilitar'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

const kindBadge = {
  consumible: { label: 'Consumible', cls: 'bg-blue-100 text-blue-700' },
  herramienta: { label: 'Herramienta', cls: 'bg-purple-100 text-purple-700' },
}