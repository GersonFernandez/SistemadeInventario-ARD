import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { inventoryApi, getMediaUrl } from '../services/inventoryApi'
import { productApi } from '../services/productApi'

const documentTypes = [
  { value: 'oficio', label: 'Oficio' },
  { value: 'conduce', label: 'Conduce' },
  { value: 'factura', label: 'Factura' },
  { value: 'directo', label: 'Directo' },
  { value: 'legado', label: 'Legado' },
]

export default function ItemFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [categories, setCategories]     = useState([])
  const [brands, setBrands]             = useState([])
  const [models, setModels]             = useState([])
  const [states, setStates]             = useState([])
  const [unitMeasures, setUnitMeasures] = useState([])
  const [locations, setLocations]       = useState([])
  const [loading, setLoading]           = useState(isEditing)
  const [saving, setSaving]             = useState(false)
  const [imageFile, setImageFile]       = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  const [form, setForm] = useState({
    name: '',
    part_number: '',
    category: '',
    brand: '',
    product_model: '',
    state: '',
    description: '',
    technical_specs: '',
    datasheet_url: '',
    application: '',
    location: '',
    kind: 'consumible',
    minimum_stock: 0,
    unit: '',
    is_active: true,
  })

  const [initialStock, setInitialStock] = useState({
    quantity: 0,
    document_type: 'directo',
    document_number: '',
    notes: '',
    document_file: null,
  })

  const filteredModels = models.filter(
    (m) => !form.brand || String(m.brand) === String(form.brand),
  )

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [c, b, s, u, l] = await Promise.all([
          productApi.getCategories(),
          productApi.getBrands({ is_active: true }),
          productApi.getProductStates({ is_active: true }),
          productApi.getUnitMeasures({ is_active: true }),
          productApi.getLocations({ page_size: 200 }),
        ])
        const norm = (r) => r.data.results ?? r.data
        setCategories(norm(c))
        setBrands(norm(b))
        setStates(norm(s))
        setUnitMeasures(norm(u))
        setLocations(norm(l))
      } catch {
        toast.error('No se pudieron cargar los catálogos')
      }
    }
    loadCatalogs()
  }, [])

  useEffect(() => {
    if (!form.brand) { setModels([]); return }
    productApi.getProductModels({ is_active: true, brand: form.brand })
      .then((r) => setModels(r.data.results ?? r.data))
      .catch(() => setModels([]))
  }, [form.brand])

  useEffect(() => {
    if (isEditing) fetchItem()
  }, [id])

  const fetchItem = async () => {
    try {
      const { data } = await inventoryApi.getItem(id)
      setForm({
        name: data.name || '',
        part_number: data.part_number || '',
        category: data.category || '',
        brand: data.brand || '',
        product_model: data.product_model || '',
        state: data.state || '',
        description: data.description || '',
        technical_specs: '',
        datasheet_url: '',
        application: data.application || '',
        location: data.location || '',
        kind: data.kind || 'consumible',
        minimum_stock: data.minimum_stock ?? 0,
        unit: data.unit || '',
        is_active: data.is_active,
      })
      if (data.image_url) setImagePreview(getMediaUrl(data.image_url))
    } catch {
      toast.error('Error al cargar el artículo')
      navigate('/products')
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

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('La imagen no debe superar los 2MB'); e.target.value = ''; return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.category) {
      toast.error('Nombre y categoría son obligatorios')
      return
    }
    if (!form.brand)          { toast.error('La marca es obligatoria'); return }
    if (!form.product_model)  { toast.error('El modelo es obligatorio'); return }

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

      let itemId = id
      if (isEditing) {
        await productApi.updateItem(id, payload)
        toast.success('Producto actualizado')
      } else {
        const { data } = await productApi.createItem(payload)
        itemId = data.id
        toast.success('Producto creado')

        if (form.kind === 'consumible' && Number(initialStock.quantity) > 0) {
          const mov = new FormData()
          mov.append('item', itemId)
          mov.append('movement_type', 'entry')
          mov.append('quantity', Number(initialStock.quantity))
          mov.append('document_type', initialStock.document_type)
          mov.append('document_number', initialStock.document_number || '')
          mov.append('notes', initialStock.notes || '')
          if (initialStock.document_file) mov.append('document_file', initialStock.document_file)
          await inventoryApi.createStockMovement(mov)
        }
      }

      navigate('/products')
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        Object.values(error.response?.data || {}).flat().join(', ') ||
        'No se pudo guardar el producto'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-gray-600">Cargando…</p>

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar producto' : 'Nuevo producto'}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Registro completo con marca, modelo, estado y especificaciones técnicas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/products')}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-5">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre del producto" required>
            <input value={form.name} onChange={set('name')} required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </Field>

          <Field label="Número de parte">
            <input value={form.part_number} onChange={set('part_number')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </Field>

          <Field label="Aplicación / uso">
            <input value={form.application} onChange={set('application')}
              placeholder="Equipo o sistema donde se aplica"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </Field>

          <Field label="Categoría" required>
            <div className="mt-1 flex gap-2">
              <select value={form.category} onChange={set('category')} required
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="">Seleccione…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Link to="/categories"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                title="Gestionar categorías">⚙</Link>
            </div>
          </Field>

          <Field label="Marca" required>
            <select value={form.brand} onChange={set('brand')} required
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Seleccione…</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>

          <Field label="Modelo" required>
            <select value={form.product_model} onChange={set('product_model')} required
              disabled={!form.brand}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500">
              <option value="">{form.brand ? 'Seleccione…' : 'Seleccione marca primero…'}</option>
              {filteredModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>

          <Field label="Estado">
            <select value={form.state} onChange={set('state')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Sin estado</option>
              {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>

          <Field label="Ubicación">
            <select value={form.location} onChange={set('location')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Sin ubicación</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.breadcrumb || l.name}</option>)}
            </select>
          </Field>

          <Field label="Tipo">
            <select value={form.kind} onChange={set('kind')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="consumible">Consumible / Repuesto</option>
              <option value="herramienta">Herramienta / Instrumento</option>
            </select>
          </Field>

          <Field label="Stock mínimo">
            <input type="number" min="0" value={form.minimum_stock} onChange={set('minimum_stock')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </Field>

          <Field label="Unidad de medida">
            <select value={form.unit} onChange={set('unit')}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="">Seleccione…</option>
              {unitMeasures.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Descripción general">
          <textarea value={form.description} onChange={set('description')} rows={2}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </Field>

        <Field label="Especificaciones técnicas">
          <textarea value={form.technical_specs} onChange={set('technical_specs')} rows={3}
            placeholder="Voltaje, potencia, frecuencia, conectores, protocolo, etc."
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </Field>

        <Field label="URL de ficha técnica">
          <input value={form.datasheet_url} onChange={set('datasheet_url')}
            placeholder="https://..."
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </Field>

        <Field label="Imagen del producto">
          <input type="file" accept="image/*" onChange={handleImageChange}
            className="mt-1 w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-brand-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-900" />
          <p className="mt-1 text-xs text-gray-400">Máximo 2MB · JPG, PNG</p>
          {imagePreview && (
            <img src={imagePreview} alt="Vista previa"
              className="mt-3 h-40 w-40 rounded-lg object-cover border border-gray-200" />
          )}
        </Field>

        {/* Entrada inicial de stock (solo creación, consumible) */}
        {!isEditing && form.kind === 'consumible' && (
          <div className="border-t border-gray-200 pt-5">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Entrada inicial de stock</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Cantidad">
                <input type="number" min="0" value={initialStock.quantity}
                  onChange={(e) => setInitialStock((p) => ({ ...p, quantity: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Tipo de documento">
                <select value={initialStock.document_type}
                  onChange={(e) => setInitialStock((p) => ({ ...p, document_type: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  {documentTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
              <Field label="Número de documento">
                <input value={initialStock.document_number}
                  onChange={(e) => setInitialStock((p) => ({ ...p, document_number: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </Field>
              <Field label="Notas">
                <input value={initialStock.notes}
                  onChange={(e) => setInitialStock((p) => ({ ...p, notes: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </Field>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50">
            {saving ? 'Guardando…' : isEditing ? 'Guardar cambios' : 'Crear producto'}
          </button>
          <button type="button" onClick={() => navigate('/products')}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}