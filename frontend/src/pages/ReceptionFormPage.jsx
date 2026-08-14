import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  InboxArrowDownIcon,
  UserCircleIcon,
  MapPinIcon,
  ClipboardDocumentListIcon,
  PaperClipIcon,
} from '@heroicons/react/24/outline'
import { inventoryApi, getMediaUrl } from '../services/inventoryApi'
import ProductPickerField from '../components/ProductPickerField'
import { DOMINICAN_CEDULA_ERROR, formatDominicanCedula, isValidDominicanCedula } from '../utils/dominicanCedula'

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

export default function ReceptionFormPage() {
  const navigate = useNavigate()

  const [fechaRecepcion, setFechaRecepcion] = useState(new Date().toISOString().slice(0, 16))
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState([{ ...emptyLine }])
  const [entregadoPorNombre, setEntregadoPorNombre] = useState('')
  const [entregadoPorApellido, setEntregadoPorApellido] = useState('')
  const [entregadoPorCedula, setEntregadoPorCedula] = useState('')
  const [cedulaError, setCedulaError] = useState('')
  const [entregadoPorRangoCargo, setEntregadoPorRangoCargo] = useState('')
  const [photos, setPhotos] = useState([])
  const [documents, setDocuments] = useState([])
  const [signedReceipt, setSignedReceipt] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [locations, setLocations] = useState([])
  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [saving, setSaving] = useState(false)
  const [lastSavedId, setLastSavedId] = useState(null)
  const [signedReceiptFiles, setSignedReceiptFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadedSignedAttachments, setUploadedSignedAttachments] = useState([])

  useEffect(() => {
    loadCatalogs()
  }, [])

  useEffect(() => {
    if (!selectedLocation && locations.length) {
      setSelectedLocation(String(locations[0].id))
    }
  }, [locations, selectedLocation])

  const loadCatalogs = async () => {
    const requests = [
      ['productos', inventoryApi.getItems({ is_active: true, is_base_product: true, for_reception: true, page_size: 300 }), setProducts],
      ['marcas', inventoryApi.getBrands({ is_active: true }), setBrands],
      ['modelos', inventoryApi.getProductModels({ is_active: true }), setModels],
      ['categorías', inventoryApi.getCategories(), setCategories],
      ['ubicaciones', inventoryApi.getLocations({ page_size: 200 }), setLocations],
    ]
    const results = await Promise.allSettled(requests.map(([, req]) => req))
    results.forEach((result, idx) => {
      const [, , setData] = requests[idx]
      if (result.status === 'fulfilled') {
        setData(result.value.data.results || result.value.data)
      } else {
        setData([])
      }
    })
  }

  const addLine = () => setLineas((prev) => [...prev, { ...emptyLine }])

  const updateLine = (index, patch) => {
    setLineas((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  const removeLine = (index) => {
    setLineas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
  }

  const parseSeriales = (text) => text
    .split(/[\n,;]/)
    .map((s) => s.trim())
    .filter(Boolean)

  const hydrateLineFromProduct = (line) => {
    const p = products.find((item) => String(item.id) === String(line.item))
    if (!p) return line
    return {
      ...line,
      marca: line.marca || p.brand || '',
      modelo: line.modelo || p.product_model || '',
      categoria: line.categoria || p.category || '',
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

  const uploadSignedReceiptOnly = async () => {
    if (!signedReceiptFiles.length) {
      toast.error('Seleccione al menos un comprobante firmado')
      return
    }
    setUploading(true)
    try {
      const { data } = await inventoryApi.uploadSignedReceipt(lastSavedId, signedReceiptFiles)
      toast.success('Comprobante firmado cargado')
      setSignedReceiptFiles([])
      const uploaded = (data?.adjuntos || []).filter((a) => a.attachment_type === 'comprobante_firmado')
      setUploadedSignedAttachments((prev) => [...uploaded, ...prev])
    } catch {
      toast.error('No se pudo subir el comprobante firmado')
    } finally {
      setUploading(false)
    }
  }

  const loadSignedAttachments = async (receptionId) => {
    try {
      const { data } = await inventoryApi.getProductEntryAttachments(receptionId, { attachment_type: 'comprobante_firmado' })
      setUploadedSignedAttachments(data?.adjuntos || [])
    } catch {
      setUploadedSignedAttachments([])
    }
  }

  const downloadSignedAttachment = (attachment) => {
    const filePath = attachment.file_url || attachment.file
    if (!filePath) {
      toast.error('El archivo firmado no es descargable')
      return
    }
    const anchor = document.createElement('a')
    anchor.href = getMediaUrl(filePath)
    anchor.target = '_blank'
    anchor.rel = 'noopener noreferrer'
    anchor.download = `comprobante_firmado_${lastSavedId || 'recepcion'}_${attachment.id}`
    anchor.click()
  }

  const submit = async () => {
    if (!entregadoPorNombre || !entregadoPorApellido || !entregadoPorCedula || !entregadoPorRangoCargo) {
      toast.error('Complete los datos de quien entrega')
      return
    }
    if (!isValidDominicanCedula(entregadoPorCedula)) {
      setCedulaError(DOMINICAN_CEDULA_ERROR)
      toast.error(DOMINICAN_CEDULA_ERROR)
      return
    }
    if (!selectedLocation) {
      toast.error('Seleccione una ubicación de almacenamiento')
      return
    }

    const hydratedLines = lineas.map(hydrateLineFromProduct)
    setLineas(hydratedLines)

    for (const [idx, line] of hydratedLines.entries()) {
      if (!line.item || !line.cantidad) {
        toast.error(`Complete los campos obligatorios en la línea ${idx + 1}`)
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
      const { data } = await inventoryApi.createProductEntryBatch(payload, { photos, documents, signedReceipt })
      toast.success(`Recepción registrada: ${data.reception_id}`)
      setLastSavedId(data.reception_id)

      // Las acciones posteriores no deben marcar la recepción como fallida.
      try {
        await downloadReceipt(data.reception_id)
      } catch {
        toast.error('La recepción se guardó, pero no se pudo descargar el comprobante')
      }

      try {
        await loadSignedAttachments(data.reception_id)
      } catch {
        // Si no se pueden leer adjuntos, mantenemos el guardado exitoso.
      }

      setFechaRecepcion(new Date().toISOString().slice(0, 16))
      setObservaciones('')
      setEntregadoPorNombre('')
      setEntregadoPorApellido('')
      setEntregadoPorCedula('')
      setCedulaError('')
      setEntregadoPorRangoCargo('')
      setLineas([{ ...emptyLine }])
      setPhotos([])
      setDocuments([])
      setSignedReceipt([])
    } catch (error) {
      const apiCedulaError = error.response?.data?.entregado_por_cedula?.[0]
      if (apiCedulaError) setCedulaError(apiCedulaError)
      toast.error(apiCedulaError || error.response?.data?.detail || 'No se pudo guardar la recepción')
    } finally {
      setSaving(false)
    }
  }

  const totalLineas = lineas.length
  const totalUnidades = lineas.reduce((s, l) => s + Number(l.cantidad || 0), 0)

  return (
    <div className="space-y-6">
      {/* ── Header (mismo patrón que DespachoFormPage) ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nueva recepción de mercancía</h2>
          <p className="mt-1 text-sm text-gray-600">
            Registre la entrada de mercancía al inventario con trazabilidad por quien entrega, líneas y seriales.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/reception')}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Volver al listado
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ── Columna principal ── */}
        <section className="space-y-6 xl:col-span-2">

          {/* Datos de quien entrega */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Datos de quien entrega</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombre</label>
                <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={entregadoPorNombre} onChange={(e) => setEntregadoPorNombre(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Apellido</label>
                <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={entregadoPorApellido} onChange={(e) => setEntregadoPorApellido(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cédula</label>
                <input
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={13}
                  placeholder="000-0000000-0"
                  value={entregadoPorCedula}
                  onChange={(e) => {
                    setEntregadoPorCedula(formatDominicanCedula(e.target.value))
                    setCedulaError('')
                  }}
                  onBlur={() => entregadoPorCedula && !isValidDominicanCedula(entregadoPorCedula) && setCedulaError(DOMINICAN_CEDULA_ERROR)}
                  aria-invalid={Boolean(cedulaError)}
                  aria-describedby={cedulaError ? 'reception-cedula-error' : undefined}
                  className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 ${cedulaError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'}`}
                  required
                />
                {cedulaError && <p id="reception-cedula-error" className="mt-1.5 text-sm text-red-600">{cedulaError}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Rango / Cargo</label>
                <input className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" value={entregadoPorRangoCargo} onChange={(e) => setEntregadoPorRangoCargo(e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Detalle de recepción */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <MapPinIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Detalle de recepción</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Fecha de recepción</label>
                <input type="datetime-local" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Ubicación de almacenamiento</label>
                <select value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required>
                  <option value="">Seleccione una ubicación</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.breadcrumb || loc.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Observaciones generales</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3} placeholder="Comentarios generales de la recepción..." className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          {/* Productos recibidos */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Mercancía a recibir</h3>
            </div>

            <p className="mb-3 text-xs text-gray-600">
              Seleccione los productos del catálogo e indique cantidades, tipo y seriales para cada línea.
            </p>

            {lineas.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Agregue productos usando el botón de abajo.
              </div>
            ) : (
              <div className="space-y-3">
                {lineas.map((line, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Producto</label>
                        <div className="mt-1">
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
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Quitar
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo</label>
                        <select value={line.tipo} onChange={(e) => updateLine(index, { tipo: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                          <option value="nuevo">Nuevo</option>
                          <option value="usado">Usado / Reparación</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cantidad</label>
                        <input type="number" min={1} value={line.cantidad} onChange={(e) => updateLine(index, { cantidad: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" required />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Seriales</label>
                        <input value={line.seriales_text} onChange={(e) => updateLine(index, { seriales_text: e.target.value })} placeholder={line.tipo === 'usado' ? 'Obligatorio' : 'Opcional'} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nota de línea</label>
                        <input value={line.observaciones} onChange={(e) => updateLine(index, { observaciones: e.target.value })} placeholder="Ej: Viene en garantía" className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={addLine}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <PlusIcon className="h-4 w-4" />
              Agregar producto
            </button>
          </div>

          {/* Adjuntos */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <PaperClipIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Adjuntos</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Foto (evidencia visual)</label>
                <input type="file" multiple accept="image/*" onChange={(e) => setPhotos(Array.from(e.target.files || []))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Documento (factura, guía…)</label>
                <input type="file" multiple onChange={(e) => setDocuments(Array.from(e.target.files || []))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Comprobante firmado (opcional)</label>
                <input type="file" multiple accept="application/pdf,image/*" onChange={(e) => setSignedReceipt(Array.from(e.target.files || []))} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

        </section>

        {/* ── Aside: resumen + botones (mismo patrón que DespachoFormPage) ── */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-base font-semibold text-gray-900">Resumen de recepción</h3>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Quién entrega</dt>
                <dd className="text-right font-medium text-gray-900">
                  {entregadoPorNombre || entregadoPorApellido
                    ? `${entregadoPorNombre} ${entregadoPorApellido}`.trim()
                    : <span className="text-gray-400">Sin completar</span>}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Ubicación</dt>
                <dd className="text-right font-medium text-gray-900">
                  {selectedLocation
                    ? (locations.find((l) => String(l.id) === selectedLocation)?.breadcrumb
                      || locations.find((l) => String(l.id) === selectedLocation)?.name
                      || '—')
                    : <span className="text-gray-400">Sin seleccionar</span>}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Líneas</dt>
                <dd className="font-medium text-gray-900">{totalLineas}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Unidades</dt>
                <dd className="font-medium text-gray-900">{totalUnidades}</dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="w-full rounded-md bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {saving ? 'Guardando recepción…' : 'Confirmar recepción'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/reception')}
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>

          {/* Post-guardado: comprobante firmado */}
          {lastSavedId && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
              <p className="text-sm font-semibold text-emerald-800">Recepción guardada: {lastSavedId}</p>
              <p className="text-xs text-emerald-700">
                Descargue el comprobante, fírmelo y súbalo aquí.
              </p>
              <button
                type="button"
                onClick={() => downloadReceipt(lastSavedId)}
                className="w-full rounded-md bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
              >
                Descargar comprobante PDF
              </button>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-emerald-800">Subir comprobante firmado</label>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  onChange={(e) => setSignedReceiptFiles(Array.from(e.target.files || []))}
                  className="mt-1 w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                onClick={uploadSignedReceiptOnly}
                disabled={uploading}
                className="w-full rounded-md border border-emerald-600 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
              >
                {uploading ? 'Subiendo…' : 'Subir firmado'}
              </button>
              {uploadedSignedAttachments.length > 0 && (
                <div className="space-y-1 rounded-md border border-emerald-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Comprobantes firmados cargados</p>
                  {uploadedSignedAttachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      onClick={() => downloadSignedAttachment(attachment)}
                      className="block w-full text-left text-xs font-medium text-emerald-700 hover:text-emerald-900"
                    >
                      Descargar firmado #{attachment.id}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
