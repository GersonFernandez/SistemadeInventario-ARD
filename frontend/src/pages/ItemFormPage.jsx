import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { inventoryApi, getMediaUrl } from '../services/inventoryApi'

const documentTypes = [
  { value: 'oficio', label: 'Oficio' },
  { value: 'conduce', label: 'Conduce' },
  { value: 'factura', label: 'Factura' },
  { value: 'directo', label: 'Directo' },
  { value: 'legado', label: 'Legado' },
]

const locationTypes = [
  { value: 'taller', label: 'Taller de Electrónica' },
  { value: 'base_naval', label: 'Base Naval' },
  { value: 'unidad_naval', label: 'Unidad Naval' },
  { value: 'comandancia', label: 'Comandancia / Capitanía' },
  { value: 'destacamento', label: 'Destacamento / Puesto' },
]

export default function ItemFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isEditing = Boolean(id)

  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(isEditing)
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    part_number: '',
    marca: '',
    modelo: '',
    numero_serie: '',
    category: '',
    kind: 'consumible',
    description: '',
    application: '',
    location: '',
    quantity: 0,
    minimum_stock: 0,
    unit: 'unidad',
    is_active: true,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [initialStock, setInitialStock] = useState({
    quantity: 0,
    document_type: 'directo',
    document_number: '',
    notes: '',
    document_file: null,
  })
  const [locations, setLocations] = useState([])
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [newLocation, setNewLocation] = useState({ name: '', codigo: '', location_type: 'taller' })
  const [savingLocation, setSavingLocation] = useState(false)

  useEffect(() => {
    fetchCategories()
    fetchLocations()
    if (isEditing) {
      fetchItem()
    }
  }, [id])

  const fetchCategories = async () => {
    try {
      const { data } = await inventoryApi.getCategories()
      setCategories(data.results || data)
    } catch {
      toast.error('Error al cargar categorías')
    }
  }

  const fetchLocations = async () => {
    try {
      const { data } = await inventoryApi.getLocations()
      setLocations(data.results || data)
    } catch {
      console.error('Error fetching locations')
    }
  }

  const fetchItem = async () => {
    try {
      const { data } = await inventoryApi.getItem(id)
      setFormData({
        name: data.name,
        sku: data.sku || '',
        part_number: data.part_number || '',
        marca: data.marca || '',
        modelo: data.modelo || '',
        numero_serie: data.numero_serie || '',
        category: data.category,
        kind: data.kind || 'consumible',
        description: data.description || '',
        application: data.application || '',
        location: data.location || '',
        quantity: data.quantity || 0,
        minimum_stock: data.minimum_stock,
        unit: data.unit,
        is_active: data.is_active,
      })
      if (data.image_url) {
        setImagePreview(getMediaUrl(data.image_url))
      }
    } catch {
      toast.error('Error al cargar el artículo')
      navigate('/products')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleLocationChange = (e) => {
    setFormData((prev) => ({ ...prev, location: e.target.value }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('La imagen no debe superar los 2MB')
        e.target.value = ''
        return
      }
      setImageFile(file)
      setImagePreview(URL.createObjectURL(file))
    }
  }

  const handleStockChange = (e) => {
    const { name, value } = e.target
    setInitialStock((prev) => ({ ...prev, [name]: value }))
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El archivo no debe superar los 5MB')
        e.target.value = ''
        return
      }
      setInitialStock((prev) => ({ ...prev, document_file: file }))
    }
  }

  const handleSaveLocation = async (e) => {
    e.preventDefault()
    if (!newLocation.name.trim()) {
      toast.error('El nombre es obligatorio')
      return
    }

    setSavingLocation(true)
    try {
      const payload = {
        name: newLocation.name,
        codigo: newLocation.codigo || '',
        location_type: newLocation.location_type,
      }
      const { data } = await inventoryApi.createLocation(payload)
      toast.success('Ubicación creada')
      setLocationModalOpen(false)
      setNewLocation({ name: '', codigo: '', location_type: 'taller' })
      fetchLocations()
      setFormData((prev) => ({ ...prev, location: data.id }))
    } catch (error) {
      const msg = error.response?.data?.name?.[0]
        || error.response?.data?.detail
        || 'Error al crear la ubicación'
      toast.error(msg)
    } finally {
      setSavingLocation(false)
    }
  }

  const buildFormData = () => {
    const data = new FormData()
    data.append('name', formData.name)
    data.append('sku', formData.sku || '')
    data.append('part_number', formData.part_number || '')
    data.append('marca', formData.marca || '')
    data.append('modelo', formData.modelo || '')
    data.append('numero_serie', formData.numero_serie || '')
    data.append('category', formData.category)
    data.append('kind', formData.kind)
    if (formData.kind === 'herramienta') {
      data.append('track_by_serial', 'true')
      data.append('quantity', 0)
    } else {
      data.append('track_by_serial', 'false')
      data.append('quantity', Number(formData.quantity || 0))
    }
    data.append('description', formData.description || '')
    data.append('application', formData.application || '')
    if (formData.location) {
      data.append('location', formData.location)
    }
    data.append('minimum_stock', Number(formData.minimum_stock))
    data.append('unit', formData.unit)
    data.append('is_active', formData.is_active)
    if (imageFile) {
      data.append('image', imageFile)
    }
    return data
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = buildFormData()

      let itemId = id
      if (isEditing) {
        await inventoryApi.updateItem(id, payload)
        toast.success('Artículo actualizado')
      } else {
        const { data } = await inventoryApi.createItem(payload)
        itemId = data.id
        toast.success('Artículo creado')

        if (Number(initialStock.quantity) > 0) {
          const movementData = new FormData()
          movementData.append('item', itemId)
          movementData.append('movement_type', 'entry')
          movementData.append('quantity', Number(initialStock.quantity))
          movementData.append('document_type', initialStock.document_type)
          movementData.append('document_number', initialStock.document_number)
          movementData.append('notes', initialStock.notes)
          if (initialStock.document_file) {
            movementData.append('document_file', initialStock.document_file)
          }
          await inventoryApi.createStockMovement(movementData)
        }
      }

      navigate('/products')
    } catch (error) {
      const message =
        error.response?.data?.detail ||
        Object.values(error.response?.data || {}).flat().join(', ') ||
        'Error al guardar el artículo'
      toast.error(message)
    }
  }

  if (loading) {
    return <p className="text-gray-600">Cargando...</p>
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        {isEditing ? 'Editar artículo' : 'Nuevo artículo'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Código</label>
            <input
              value={isEditing ? formData.sku || '' : 'Auto-generado'}
              disabled
              className="mt-1 block w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-gray-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-400">Se genera automáticamente al guardar</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">SKU (legado)</label>
            <input
              name="sku"
              value={formData.sku}
              onChange={handleChange}
              placeholder="Código del sistema anterior"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Número de parte</label>
            <input
              name="part_number"
              value={formData.part_number}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Marca</label>
            <input
              name="marca"
              value={formData.marca}
              onChange={handleChange}
              placeholder="Ej: Motorola, Harris"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Modelo</label>
            <input
              name="modelo"
              value={formData.modelo}
              onChange={handleChange}
              placeholder="Modelo del fabricante"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Número de serie</label>
            <input
              name="numero_serie"
              value={formData.numero_serie}
              onChange={handleChange}
              placeholder="Para equipos con serial único"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700 font-mono"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Categoría</label>
            <div className="mt-1 flex gap-2">
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
                className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
              >
                <option value="">Seleccione...</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <Link
                to="/categories"
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="Gestionar categorías"
              >
                ⚙️
              </Link>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo de usabilidad *</label>
            <div className="mt-1 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="kind"
                  value="consumible"
                  checked={formData.kind === 'consumible'}
                  onChange={handleChange}
                  className="h-4 w-4 text-brand-800 focus:ring-brand-700"
                />
                <span className="text-sm text-gray-700">Consumibles / Repuestos</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="kind"
                  value="herramienta"
                  checked={formData.kind === 'herramienta'}
                  onChange={handleChange}
                  className="h-4 w-4 text-brand-800 focus:ring-brand-700"
                />
                <span className="text-sm text-gray-700">Herramientas / Instrumentos</span>
              </label>
            </div>
            {formData.kind === 'herramienta' && (
              <p className="mt-1 text-xs text-gray-500">
                El stock se mide por unidades físicas con serial. La cantidad inicial siempre es 0.
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Ubicación</label>
            <div className="mt-1 flex gap-2">
              <select
                name="location"
                value={formData.location}
                onChange={handleLocationChange}
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
              >
                <option value="">Sin ubicación asignada</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.type_display ? `${loc.type_display}: ` : ''}{loc.name}
                    {loc.codigo ? ` (${loc.codigo})` : ''}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                title="Crear nueva ubicación"
              >
                +
              </button>
            </div>
          </div>

          {formData.kind === 'consumible' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700">Unidad</label>
                <input
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Stock mínimo</label>
                <input
                  name="minimum_stock"
                  type="number"
                  min="0"
                  value={formData.minimum_stock}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>
            </>
          )}

          <div className="flex items-center h-full pt-6">
            <label className="flex items-center gap-2">
              <input
                name="is_active"
                type="checkbox"
                checked={formData.is_active}
                onChange={handleChange}
                className="h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-700"
              />
              <span className="text-sm text-gray-700">Activo</span>
            </label>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Aplicación</label>
            <input
              name="application"
              value={formData.application}
              onChange={handleChange}
              placeholder="Equipo o sistema donde se aplica"
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Descripción</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Foto del activo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="mt-1 block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-brand-800 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-brand-900"
            />
            <p className="mt-1 text-xs text-gray-500">Máximo 2MB. JPG, PNG, GIF.</p>
            {imagePreview && (
              <div className="mt-3">
                <img src={imagePreview} alt="Vista previa" className="h-40 w-40 rounded-lg object-cover border border-gray-200" />
              </div>
            )}
          </div>
        </div>

        {!isEditing && formData.kind === 'consumible' && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Entrada inicial de stock</h3>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Cantidad</label>
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  value={initialStock.quantity}
                  onChange={handleStockChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Tipo de documento</label>
                <select
                  name="document_type"
                  value={initialStock.document_type}
                  onChange={handleStockChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                >
                  {documentTypes.map((type) => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Número de documento</label>
                <input
                  name="document_number"
                  value={initialStock.document_number}
                  onChange={handleStockChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Archivo (opcional)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
                />
                <p className="mt-1 text-xs text-gray-500">PDF, JPG, PNG — máximo 5MB</p>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Notas</label>
                <input
                  name="notes"
                  value={initialStock.notes}
                  onChange={handleStockChange}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            {isEditing ? 'Guardar cambios' : 'Crear artículo'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/products')}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </form>

      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nueva ubicación</h3>
            <form onSubmit={handleSaveLocation} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={newLocation.location_type}
                  onChange={(e) => setNewLocation({ ...newLocation, location_type: e.target.value })}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                >
                  {locationTypes.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  value={newLocation.name}
                  onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                  required
                  autoFocus
                  placeholder="Ej: Base Naval 27 de Febrero"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código interno
                </label>
                <input
                  value={newLocation.codigo}
                  onChange={(e) => setNewLocation({ ...newLocation, codigo: e.target.value })}
                  placeholder="Opcional"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700 font-mono"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(false)}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingLocation}
                  className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
                >
                  {savingLocation ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
