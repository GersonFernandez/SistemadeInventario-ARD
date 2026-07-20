import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { getMediaUrl, inventoryApi } from '../services/inventoryApi'
import ProductPickerField from '../components/ProductPickerField'

const emptyLine = {
  tipo: 'nuevo',
  item: '',
  item_search: '',
  marca: '',
  modelo: '',
  categoria: '',
  cantidad: 1,
  seriales_text: '',
  observaciones: '',
}

export default function ReceptionPage() {
  const [fechaRecepcion, setFechaRecepcion] = useState(new Date().toISOString().slice(0, 16))
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState([{ ...emptyLine }])
  const [entregadoPorNombre, setEntregadoPorNombre] = useState('')
  const [entregadoPorApellido, setEntregadoPorApellido] = useState('')
  const [entregadoPorCedula, setEntregadoPorCedula] = useState('')
  const [entregadoPorRangoCargo, setEntregadoPorRangoCargo] = useState('')
  const [photos, setPhotos] = useState([])
  const [documents, setDocuments] = useState([])
  const [signedReceipt, setSignedReceipt] = useState([])

  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')

  const [history, setHistory] = useState([])
  const [filters, setFilters] = useState({ tipo: '', marca: '', modelo: '', location: '', from: '', to: '' })
  const [saving, setSaving] = useState(false)
  const [lastSavedReceptionId, setLastSavedReceptionId] = useState('')
  const [signedReceiptByReception, setSignedReceiptByReception] = useState({})
  const [uploadingByReception, setUploadingByReception] = useState({})
  const [products, setProducts] = useState([])

  useEffect(() => {
    loadCatalogs()
    loadHistory()
  }, [])

  useEffect(() => {
    if (!selectedLocation && locations.length) {
      setSelectedLocation(String(locations[0].id))
    }
  }, [locations, selectedLocation])

  const groupedHistory = useMemo(() => {
    const groups = {}
    history.forEach((entry) => {
      if (!groups[entry.reception_id]) groups[entry.reception_id] = []
      groups[entry.reception_id].push(entry)
    })
    return Object.entries(groups).map(([id, rows]) => ({
      receptionId: id,
      fecha: rows[0]?.fecha_recepcion,
      tipo: rows[0]?.tipo,
      rows,
    })).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  }, [history])

  const inventorySummary = useMemo(() => {
    const summary = {}

    history.forEach((entry) => {
      const key = [
        entry.base_product_name || `${entry.marca_name} ${entry.modelo_name}`,
        entry.ubicacion_breadcrumb || entry.ubicacion_name || 'Sin ubicación',
        entry.tipo,
      ].join(' | ')

      if (!summary[key]) {
        summary[key] = {
          product: entry.base_product_name || `${entry.marca_name} ${entry.modelo_name}`,
          location: entry.ubicacion_breadcrumb || entry.ubicacion_name || 'Sin ubicación',
          tipo: entry.tipo,
          cantidad: 0,
          seriales: [],
          ultimaRecepcion: entry.fecha_recepcion,
        }
      }

      summary[key].cantidad += Number(entry.cantidad || 0)
      summary[key].seriales = [...new Set([...summary[key].seriales, ...(entry.seriales || [])])]
      if (new Date(entry.fecha_recepcion) > new Date(summary[key].ultimaRecepcion)) {
        summary[key].ultimaRecepcion = entry.fecha_recepcion
      }
    })

    return Object.values(summary).sort((a, b) => new Date(b.ultimaRecepcion) - new Date(a.ultimaRecepcion))
  }, [history])

  const attachmentLabel = (type) => {
    if (type === 'foto') return 'Foto'
    if (type === 'documento') return 'Documento'
    if (type === 'comprobante_firmado') return 'Comprobante firmado'
    return type || 'Adjunto'
  }

  const isImageAttachment = (fileUrl = '') => /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileUrl)

  const getCatalogErrorMessage = (error) => error.response?.data?.detail
    || error.response?.data?.message
    || error.response?.data?.error
    || error.message
    || 'Error desconocido'

  const loadCatalogs = async () => {
    const requests = [
      ['productos', inventoryApi.getItems({ is_active: true, is_base_product: true, for_reception: true, page_size: 300 }), setProducts],
      ['marcas', inventoryApi.getBrands({ is_active: true }), setBrands],
      ['modelos', inventoryApi.getProductModels({ is_active: true }), setModels],
      ['categorías', inventoryApi.getCategories(), setCategories],
      ['ubicaciones', inventoryApi.getLocations({ page_size: 200 }), setLocations],
    ]

    const results = await Promise.allSettled(requests.map(([, request]) => request))
    const failures = []

    results.forEach((result, index) => {
      const [label, , setData] = requests[index]

      if (result.status === 'fulfilled') {
        const data = result.value.data.results || result.value.data
        setData(data)
        return
      }

      failures.push(`${label}: ${getCatalogErrorMessage(result.reason)}`)
      setData([])
    })

    if (failures.length === 1) {
      toast.error(`No se pudo cargar ${failures[0]}`)
    } else if (failures.length > 1) {
      toast.error(`Algunos catálogos no cargaron: ${failures.join(' · ')}`)
    }
  }

  const loadHistory = async () => {
    try {
      const params = {}
      if (filters.tipo) params.tipo = filters.tipo
      if (filters.marca) params.marca = filters.marca
      if (filters.modelo) params.modelo = filters.modelo
      if (filters.location) params.ubicacion = filters.location
      if (filters.from) params.fecha_recepcion_after = filters.from
      if (filters.to) params.fecha_recepcion_before = filters.to
      const { data } = await inventoryApi.getProductEntries(params)
      setHistory(data.results || data)
    } catch {
      toast.error('No se pudo cargar historial de recepciones')
    }
  }

  const addLine = () => setLineas((prev) => [...prev, { ...emptyLine }])

  const updateLine = (index, patch) => {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const removeLine = (index) => {
    setLineas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const getModelsByBrand = (brandId) => models.filter((m) => String(m.brand) === String(brandId))

  const parseSeriales = (text) => text
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const hydrateLineFromSelectedProduct = (line) => {
    const selectedProduct = products.find((item) => String(item.id) === String(line.item))
    if (!selectedProduct) return line

    return {
      ...line,
      marca: line.marca || selectedProduct.brand || '',
      modelo: line.modelo || selectedProduct.product_model || '',
      categoria: line.categoria || selectedProduct.category || '',
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!entregadoPorNombre || !entregadoPorApellido || !entregadoPorCedula || !entregadoPorRangoCargo) {
      toast.error('Complete los datos de quien entrega')
      return
    }
    if (!selectedLocation) {
      toast.error('No hay ubicaciones cargadas para almacenar la mercancía')
      return
    }

    const hydratedLines = lineas.map(hydrateLineFromSelectedProduct)
    setLineas(hydratedLines)

    for (const [index, line] of hydratedLines.entries()) {
      if (!line.item || !line.cantidad) {
        toast.error(`Complete los campos obligatorios en la línea ${index + 1}`)
        return
      }
    }

    const payload = {
      fecha_recepcion: new Date(fechaRecepcion).toISOString(),
      observaciones,
      ubicacion: Number(selectedLocation),
      entregado_por_nombre: entregadoPorNombre,
      entregado_por_apellido: entregadoPorApellido,
      entregado_por_cedula: entregadoPorCedula,
      entregado_por_rango_cargo: entregadoPorRangoCargo,
      lineas: hydratedLines.map((line) => ({
        item: Number(line.item),
        tipo: line.tipo,
        marca: line.marca ? Number(line.marca) : null,
        modelo: line.modelo ? Number(line.modelo) : null,
        categoria: line.categoria ? Number(line.categoria) : null,
        cantidad: Number(line.cantidad),
        seriales: parseSeriales(line.seriales_text),
        observaciones: line.observaciones,
      })),
    }

    setSaving(true)
    try {
      const { data } = await inventoryApi.createProductEntryBatch(payload, {
        photos,
        documents,
        signedReceipt,
      })
      toast.success(`Recepción registrada: ${data.reception_id}`)
      setLastSavedReceptionId(data.reception_id)
      await downloadReceipt(data.reception_id)
      setFechaRecepcion(new Date().toISOString().slice(0, 16))
      setObservaciones('')
      setEntregadoPorNombre('')
      setEntregadoPorApellido('')
      setEntregadoPorCedula('')
      setEntregadoPorRangoCargo('')
      setLineas([{ ...emptyLine }])
      setPhotos([])
      setDocuments([])
      setSignedReceipt([])
      await loadHistory()
    } catch (error) {
      const detail = error.response?.data?.detail || 'No se pudo guardar la recepción'
      toast.error(detail)
    } finally {
      setSaving(false)
    }
  }

  const downloadReceipt = async (receptionId) => {
    try {
      const response = await inventoryApi.downloadProductEntryReceipt(receptionId, 'pdf')
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `comprobante_recepcion_${receptionId}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error('No se pudo descargar el comprobante')
    }
  }

  const onSignedReceiptSelected = (receptionId, files) => {
    setSignedReceiptByReception((prev) => ({
      ...prev,
      [receptionId]: Array.from(files || []),
    }))
  }

  const uploadSignedReceiptOnly = async (receptionId) => {
    const files = signedReceiptByReception[receptionId] || []
    if (!files.length) {
      toast.error('Seleccione al menos un comprobante firmado')
      return
    }

    setUploadingByReception((prev) => ({ ...prev, [receptionId]: true }))
    try {
      await inventoryApi.uploadSignedReceipt(receptionId, files)
      toast.success('Comprobante firmado cargado')
      setSignedReceiptByReception((prev) => ({ ...prev, [receptionId]: [] }))
      await loadHistory()
    } catch (error) {
      const detail = error.response?.data?.detail || 'No se pudo subir el comprobante firmado'
      toast.error(detail)
    } finally {
      setUploadingByReception((prev) => ({ ...prev, [receptionId]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Recepción de Mercancía</h2>
        <p className="text-sm text-gray-600 mt-1">Registro de artículos nuevos y usados para reparación.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Fecha de recepción</label>
            <input type="datetime-local" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Ubicación de almacenamiento</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              required
            >
              <option value="">Seleccione una ubicación</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.breadcrumb || loc.name}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">La mercancía se almacenará y se filtrará por esta ubicación.</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Foto (evidencia visual)</label>
            <input type="file" multiple accept="image/*" onChange={(e) => setPhotos(Array.from(e.target.files || []))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Nombre (quien entrega)</label>
            <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={entregadoPorNombre} onChange={(e) => setEntregadoPorNombre(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Apellido</label>
            <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={entregadoPorApellido} onChange={(e) => setEntregadoPorApellido(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Cédula</label>
            <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={entregadoPorCedula} onChange={(e) => setEntregadoPorCedula(e.target.value)} required />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Rango/Cargo</label>
            <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={entregadoPorRangoCargo} onChange={(e) => setEntregadoPorRangoCargo(e.target.value)} required />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Documento (factura, guía de despacho, etc.)</label>
            <input type="file" multiple onChange={(e) => setDocuments(Array.from(e.target.files || []))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Comprobante firmado (opcional, escaneado)</label>
            <input type="file" multiple accept="application/pdf,image/*" onChange={(e) => setSignedReceipt(Array.from(e.target.files || []))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-600">Observaciones globales</label>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left">Producto</th>
                <th className="px-2 py-2 text-left">Tipo</th>
                <th className="px-2 py-2 text-left">Cantidad</th>
                <th className="px-2 py-2 text-left">Seriales</th>
                <th className="px-2 py-2 text-left">Obs.</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lineas.map((line, index) => (
                <tr key={index}>
                  <td className="px-2 py-2">
                    <ProductPickerField
                      items={products}
                      line={line}
                      onPatch={(patch) => updateLine(index, patch)}
                      onSelectExtraPatch={(product) => ({
                        marca: product.brand || '',
                        modelo: product.product_model || '',
                        categoria: product.category || '',
                      })}
                      onClearExtraPatch={() => ({ marca: '', modelo: '', categoria: '' })}
                      modalTitle="Buscar producto"
                      modalSubtitle="Seleccione un producto base para agregarlo a la recepción."
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select value={line.tipo} onChange={(e) => updateLine(index, { tipo: e.target.value })} className="w-full rounded border px-2 py-1">
                      <option value="nuevo">Nuevo</option>
                      <option value="usado">Usado/Reparación</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" min={1} value={line.cantidad} onChange={(e) => updateLine(index, { cantidad: e.target.value })} className="w-full rounded border px-2 py-1" required />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={line.seriales_text}
                      onChange={(e) => updateLine(index, { seriales_text: e.target.value })}
                      placeholder={line.tipo === 'usado' ? 'Obligatorio o autogenerado' : 'Opcional'}
                      className="w-full rounded border px-2 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input value={line.observaciones} onChange={(e) => updateLine(index, { observaciones: e.target.value })} className="w-full rounded border px-2 py-1" />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button type="button" onClick={() => removeLine(index)} className="text-red-600 hover:text-red-800"><TrashIcon className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={addLine} className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <PlusIcon className="h-4 w-4" />
            Agregar producto
          </button>
          <button type="submit" disabled={saving} className="rounded bg-brand-800 px-4 py-2 text-sm text-white hover:bg-brand-900 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar recepción'}
          </button>
        </div>
      </form>

      {lastSavedReceptionId ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-emerald-800">Recepción guardada: {lastSavedReceptionId}</h3>
          <p className="text-xs text-emerald-700">
            Descargue el Comprobante PDF de recepción, fírmelo y luego súbalo como comprobante firmado.
          </p>
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <button
              type="button"
              onClick={() => downloadReceipt(lastSavedReceptionId)}
              className="rounded bg-emerald-700 px-3 py-2 text-sm text-white hover:bg-emerald-800"
            >
              Descargar Comprobante PDF
            </button>
            <div className="flex-1">
              <label className="text-xs font-semibold text-emerald-800">Subir comprobante firmado (solo este tipo)</label>
              <input
                type="file"
                multiple
                accept="application/pdf,image/*"
                onChange={(e) => onSignedReceiptSelected(lastSavedReceptionId, e.target.files)}
                className="mt-1 w-full rounded border border-emerald-200 px-3 py-2 text-sm bg-white"
              />
            </div>
            <button
              type="button"
              onClick={() => uploadSignedReceiptOnly(lastSavedReceptionId)}
              disabled={!!uploadingByReception[lastSavedReceptionId]}
              className="rounded border border-emerald-600 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              {uploadingByReception[lastSavedReceptionId] ? 'Subiendo...' : 'Subir firmado'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900">Historial de entradas</h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="rounded border px-3 py-2 text-sm" />
          <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="rounded border px-3 py-2 text-sm" />
          <select value={filters.tipo} onChange={(e) => setFilters({ ...filters, tipo: e.target.value })} className="rounded border px-3 py-2 text-sm">
            <option value="">Tipo</option>
            <option value="nuevo">Nuevo</option>
            <option value="usado">Usado/Reparación</option>
          </select>
          <select value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} className="rounded border px-3 py-2 text-sm">
            <option value="">Ubicación</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.breadcrumb || loc.name}</option>
            ))}
          </select>
          <select value={filters.marca} onChange={(e) => setFilters({ ...filters, marca: e.target.value, modelo: '' })} className="rounded border px-3 py-2 text-sm">
            <option value="">Marca</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filters.modelo} onChange={(e) => setFilters({ ...filters, modelo: e.target.value })} className="rounded border px-3 py-2 text-sm">
            <option value="">Modelo</option>
            {getModelsByBrand(filters.marca).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={loadHistory} className="rounded bg-brand-800 px-3 py-2 text-sm text-white">Filtrar</button>
          <button type="button" onClick={() => { setFilters({ tipo: '', marca: '', modelo: '', location: '', from: '', to: '' }); setTimeout(loadHistory, 0) }} className="rounded border px-3 py-2 text-sm">Limpiar</button>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Producto</th>
                <th className="px-3 py-2 text-left">Ubicación</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-left">Cantidad total</th>
                <th className="px-3 py-2 text-left">Seriales</th>
                <th className="px-3 py-2 text-left">Última recepción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inventorySummary.map((row) => (
                <tr key={`${row.product}-${row.location}-${row.tipo}`}>
                  <td className="px-3 py-2 font-medium text-gray-900">{row.product}</td>
                  <td className="px-3 py-2 text-gray-700">{row.location}</td>
                  <td className="px-3 py-2 text-gray-700">{row.tipo === 'nuevo' ? 'Nuevo' : 'Usado/Reparación'}</td>
                  <td className="px-3 py-2 text-gray-700">{row.cantidad}</td>
                  <td className="px-3 py-2 text-gray-700">{row.seriales.length ? row.seriales.join(', ') : '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{new Date(row.ultimaRecepcion).toLocaleString('es-DO')}</td>
                </tr>
              ))}
              {inventorySummary.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">Sin mercancía recibida todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Recepción</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Ubicación</th>
                <th className="px-3 py-2 text-left">Entrega</th>
                <th className="px-3 py-2 text-left">Líneas</th>
                <th className="px-3 py-2 text-left">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groupedHistory.map((group) => (
                <tr key={group.receptionId}>
                  <td className="px-3 py-2 font-medium text-gray-900">{group.receptionId}</td>
                  <td className="px-3 py-2 text-gray-700">{new Date(group.fecha).toLocaleString('es-DO')}</td>
                  <td className="px-3 py-2 text-gray-700">{group.rows[0]?.ubicacion_breadcrumb || group.rows[0]?.ubicacion_name || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{`${group.rows[0]?.entregado_por_nombre || ''} ${group.rows[0]?.entregado_por_apellido || ''}`.trim() || '—'}</td>
                  <td className="px-3 py-2 text-gray-700">{group.rows.map((r) => `${r.marca_name} ${r.modelo_name} (${r.cantidad})`).join(', ')}</td>
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      <button onClick={() => downloadReceipt(group.receptionId)} className="text-brand-700 hover:text-brand-900">Comprobante PDF</button>
                      <div className="rounded border border-gray-200 p-2 bg-white space-y-2">
                        <p className="text-xs font-semibold text-gray-700">Subir comprobante firmado (solo)</p>
                        <input
                          type="file"
                          multiple
                          accept="application/pdf,image/*"
                          onChange={(e) => onSignedReceiptSelected(group.receptionId, e.target.files)}
                          className="w-full rounded border px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => uploadSignedReceiptOnly(group.receptionId)}
                          disabled={!!uploadingByReception[group.receptionId]}
                          className="text-xs rounded border border-brand-700 px-2 py-1 text-brand-700 hover:bg-brand-50 disabled:opacity-60"
                        >
                          {uploadingByReception[group.receptionId] ? 'Subiendo...' : 'Subir firmado'}
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(group.rows[0]?.adjuntos || []).length > 0 ? group.rows[0].adjuntos.map((attachment) => {
                          const attachmentUrl = getMediaUrl(attachment.file_url)
                          return (
                            <div key={attachment.id} className="rounded border border-gray-200 p-2 bg-gray-50">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold text-gray-700">{attachmentLabel(attachment.attachment_type)}</p>
                                  {attachment.description && <p className="text-[11px] text-gray-500">{attachment.description}</p>}
                                </div>
                                <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-700 hover:text-brand-900">Abrir</a>
                              </div>
                              {isImageAttachment(attachment.file_url) && (
                                <img
                                  src={attachmentUrl}
                                  alt={attachmentLabel(attachment.attachment_type)}
                                  className="mt-2 h-24 w-full rounded object-cover border border-gray-200"
                                />
                              )}
                            </div>
                          )
                        }) : <p className="text-xs text-gray-400">Sin adjuntos</p>}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {groupedHistory.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-500">Sin registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
