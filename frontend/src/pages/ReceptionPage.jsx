import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { inventoryApi } from '../services/inventoryApi'

const emptyLine = {
  tipo: 'nuevo',
  marca: '',
  modelo: '',
  categoria: '',
  cantidad: 1,
  seriales_text: '',
  observaciones: '',
}

export default function ReceptionPage() {
  const [fechaRecepcion, setFechaRecepcion] = useState(new Date().toISOString().slice(0, 16))
  const [ubicacion, setUbicacion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState([{ ...emptyLine }])
  const [attachments, setAttachments] = useState([])

  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [categories, setCategories] = useState([])
  const [locations, setLocations] = useState([])

  const [history, setHistory] = useState([])
  const [filters, setFilters] = useState({ tipo: '', marca: '', modelo: '', from: '', to: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadCatalogs()
    loadHistory()
  }, [])

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

  const loadCatalogs = async () => {
    try {
      const [b, m, c, l] = await Promise.all([
        inventoryApi.getBrands({ is_active: true }),
        inventoryApi.getProductModels({ is_active: true }),
        inventoryApi.getCategories(),
        inventoryApi.getLocations(),
      ])
      setBrands(b.data.results || b.data)
      setModels(m.data.results || m.data)
      setCategories(c.data.results || c.data)
      setLocations(l.data.results || l.data)
    } catch {
      toast.error('No se pudieron cargar catálogos de recepción')
    }
  }

  const loadHistory = async () => {
    try {
      const params = {}
      if (filters.tipo) params.tipo = filters.tipo
      if (filters.marca) params.marca = filters.marca
      if (filters.modelo) params.modelo = filters.modelo
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

  const submit = async (e) => {
    e.preventDefault()
    if (!ubicacion) {
      toast.error('Debe seleccionar ubicación destino')
      return
    }
    for (const [index, line] of lineas.entries()) {
      if (!line.marca || !line.modelo || !line.categoria || !line.cantidad) {
        toast.error(`Complete los campos obligatorios en la línea ${index + 1}`)
        return
      }
    }

    const payload = {
      fecha_recepcion: new Date(fechaRecepcion).toISOString(),
      ubicacion: Number(ubicacion),
      observaciones,
      lineas: lineas.map((line) => ({
        tipo: line.tipo,
        marca: Number(line.marca),
        modelo: Number(line.modelo),
        categoria: Number(line.categoria),
        cantidad: Number(line.cantidad),
        seriales: parseSeriales(line.seriales_text),
        observaciones: line.observaciones,
      })),
    }

    setSaving(true)
    try {
      const { data } = await inventoryApi.createProductEntryBatch(payload, attachments)
      toast.success(`Recepción registrada: ${data.reception_id}`)
      setFechaRecepcion(new Date().toISOString().slice(0, 16))
      setUbicacion('')
      setObservaciones('')
      setLineas([{ ...emptyLine }])
      setAttachments([])
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Recepción de Mercancía</h2>
        <p className="text-sm text-gray-600 mt-1">Registro de artículos nuevos y usados para reparación.</p>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600">Fecha de recepción</label>
            <input type="datetime-local" value={fechaRecepcion} onChange={(e) => setFechaRecepcion(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Ubicación destino</label>
            <select value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="mt-1 w-full rounded border px-3 py-2 text-sm" required>
              <option value="">Seleccione</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.breadcrumb || l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Adjuntos</label>
            <input type="file" multiple onChange={(e) => setAttachments(Array.from(e.target.files || []))} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
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
                <th className="px-2 py-2 text-left">Tipo</th>
                <th className="px-2 py-2 text-left">Marca</th>
                <th className="px-2 py-2 text-left">Modelo</th>
                <th className="px-2 py-2 text-left">Categoría</th>
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
                    <select value={line.tipo} onChange={(e) => updateLine(index, { tipo: e.target.value })} className="w-full rounded border px-2 py-1">
                      <option value="nuevo">Nuevo</option>
                      <option value="usado">Usado/Reparación</option>
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={line.marca} onChange={(e) => updateLine(index, { marca: e.target.value, modelo: '' })} className="w-full rounded border px-2 py-1" required>
                      <option value="">Marca</option>
                      {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={line.modelo} onChange={(e) => updateLine(index, { modelo: e.target.value })} className="w-full rounded border px-2 py-1" required>
                      <option value="">Modelo</option>
                      {getModelsByBrand(line.marca).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    <select value={line.categoria} onChange={(e) => updateLine(index, { categoria: e.target.value })} className="w-full rounded border px-2 py-1" required>
                      <option value="">Categoría</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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
            Agregar línea
          </button>
          <button type="submit" disabled={saving} className="rounded bg-brand-800 px-4 py-2 text-sm text-white hover:bg-brand-900 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar recepción'}
          </button>
        </div>
      </form>

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
          <button type="button" onClick={() => { setFilters({ tipo: '', marca: '', modelo: '', from: '', to: '' }); setTimeout(loadHistory, 0) }} className="rounded border px-3 py-2 text-sm">Limpiar</button>
        </div>

        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Recepción</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Líneas</th>
                <th className="px-3 py-2 text-left">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {groupedHistory.map((group) => (
                <tr key={group.receptionId}>
                  <td className="px-3 py-2 font-medium text-gray-900">{group.receptionId}</td>
                  <td className="px-3 py-2 text-gray-700">{new Date(group.fecha).toLocaleString('es-DO')}</td>
                  <td className="px-3 py-2 text-gray-700">{group.rows.map((r) => `${r.marca_name} ${r.modelo_name} (${r.cantidad})`).join(', ')}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => downloadReceipt(group.receptionId)} className="text-brand-700 hover:text-brand-900">Comprobante PDF</button>
                  </td>
                </tr>
              ))}
              {groupedHistory.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-500">Sin registros</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
