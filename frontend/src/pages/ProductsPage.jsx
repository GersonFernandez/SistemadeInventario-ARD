import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { productApi } from '../services/productApi'

export default function ProductsPage() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [states, setStates] = useState([])
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    part_number: '',
    numero_serie: '',
    category: '',
    brand: '',
    product_model: '',
    state: '',
    description: '',
    application: '',
    location: '',
    kind: 'consumible',
    minimum_stock: 0,
    unit: 'unidad',
    is_active: true,
    technical_specs: '',
    datasheet_url: '',
  })
  const [imageFile, setImageFile] = useState(null)

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [p, c, b, m, s, l] = await Promise.all([
        productApi.getItems({ page_size: 100 }),
        productApi.getCategories(),
        productApi.getBrands({ is_active: true }),
        productApi.getProductModels({ is_active: true }),
        productApi.getProductStates({ is_active: true }),
        productApi.getLocations(),
      ])
      setProducts(p.data.results || p.data)
      setCategories(c.data.results || c.data)
      setBrands(b.data.results || b.data)
      setModels(m.data.results || m.data)
      setStates(s.data.results || s.data)
      setLocations(l.data.results || l.data)
    } catch (error) {
      toast.error('No se pudieron cargar los datos de productos')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const filteredModels = models.filter((m) => form.brand && String(m.brand) === String(form.brand))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.category) {
      toast.error('Nombre y categoría son obligatorios')
      return
    }

    setSaving(true)
    try {
      const payload = new FormData()
      payload.append('name', form.name)
      payload.append('part_number', form.part_number || '')
      payload.append('numero_serie', form.numero_serie || '')
      payload.append('category', form.category)
      if (form.brand) payload.append('brand', form.brand)
      if (form.product_model) payload.append('product_model', form.product_model)
      if (form.state) payload.append('state', form.state)
      if (form.location) payload.append('location', form.location)
      payload.append('kind', form.kind)
      payload.append('track_by_serial', form.kind === 'herramienta' ? 'true' : 'false')
      payload.append('quantity', 0)
      payload.append('minimum_stock', Number(form.minimum_stock || 0))
      payload.append('unit', form.unit || 'unidad')
      payload.append('is_active', form.is_active)

      const finalDescription = [
        form.description?.trim(),
        form.technical_specs?.trim() ? `Especificaciones técnicas:\n${form.technical_specs.trim()}` : '',
        form.datasheet_url?.trim() ? `Ficha técnica: ${form.datasheet_url.trim()}` : '',
      ]
        .filter(Boolean)
        .join('\n\n')

      payload.append('description', finalDescription)
      payload.append('application', form.application || '')

      if (imageFile) {
        payload.append('image', imageFile)
      }

      await productApi.createItem(payload)
      toast.success('Producto creado')

      setForm({
        name: '',
        part_number: '',
        numero_serie: '',
        category: '',
        brand: '',
        product_model: '',
        state: '',
        description: '',
        application: '',
        location: '',
        kind: 'consumible',
        minimum_stock: 0,
        unit: 'unidad',
        is_active: true,
        technical_specs: '',
        datasheet_url: '',
      })
      setImageFile(null)
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Productos electrónicos</h2>
        <p className="mt-1 text-sm text-gray-600">
          Registro completo de productos con marca, modelo, parte, serial, estado y especificaciones técnicas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Crear producto</h3>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input label="Nombre del producto" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <Input label="Número de parte" value={form.part_number} onChange={(v) => setForm({ ...form, part_number: v })} />
          <Input label="Número de serie" value={form.numero_serie} onChange={(v) => setForm({ ...form, numero_serie: v })} />
          <Input label="Aplicación/uso" value={form.application} onChange={(v) => setForm({ ...form, application: v })} />

          <Select
            label="Categoría"
            value={form.category}
            onChange={(v) => setForm({ ...form, category: v })}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            required
          />
          <Select
            label="Marca (catálogo)"
            value={form.brand}
            onChange={(v) => setForm({ ...form, brand: v, product_model: '' })}
            options={brands.map((b) => ({ value: b.id, label: b.name }))}
            required
          />
          <Select
            label="Modelo (catálogo)"
            value={form.product_model}
            onChange={(v) => setForm({ ...form, product_model: v })}
            options={filteredModels.map((m) => ({ value: m.id, label: `${m.brand_name} - ${m.name}` }))}
            required
            disabled={!form.brand}
          />
          <Select
            label="Estado"
            value={form.state}
            onChange={(v) => setForm({ ...form, state: v })}
            options={states.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            label="Ubicación"
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
            options={locations.map((l) => ({ value: l.id, label: l.name }))}
          />
          <Select
            label="Tipo"
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={[
              { value: 'consumible', label: 'Consumible / Repuesto' },
              { value: 'herramienta', label: 'Herramienta / Instrumento' },
            ]}
          />

          <Input
            label="Stock mínimo"
            type="number"
            value={form.minimum_stock}
            onChange={(v) => setForm({ ...form, minimum_stock: v })}
          />
          <Input label="Unidad" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Descripción general</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Especificaciones técnicas</label>
            <textarea
              rows={3}
              value={form.technical_specs}
              onChange={(e) => setForm({ ...form, technical_specs: e.target.value })}
              placeholder="Voltaje, potencia, frecuencia, conectores, protocolo, etc."
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <Input
            label="URL de ficha técnica"
            value={form.datasheet_url}
            onChange={(v) => setForm({ ...form, datasheet_url: v })}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700">Imagen del producto</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Crear producto'}
        </button>
      </form>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Productos registrados</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Código</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Producto</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Marca/Modelo</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Parte/Serial</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">Cargando...</td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">Sin productos registrados.</td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{p.code || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{p.name}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{p.brand_name || '—'} / {p.product_model_name || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{p.part_number || '—'} / {p.numero_serie || '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{p.state_name || 'Sin estado'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    <Link to={`/products/${p.id}`} className="text-brand-700 hover:text-brand-900 font-medium">
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </div>
  )
}

function Select({ label, value, onChange, options, required = false, disabled = false }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
      >
        <option value="">{disabled ? 'Seleccione marca primero...' : 'Seleccione...'}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}
