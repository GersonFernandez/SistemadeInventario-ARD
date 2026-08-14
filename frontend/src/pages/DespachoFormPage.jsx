import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  CubeIcon,
  TrashIcon,
  UserCircleIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { despachoApi } from '../services/workOrderApi'
import { inventoryApi } from '../services/inventoryApi'
import SolicitantePicker from '../components/SolicitantePicker'
import ItemSelector from '../components/ItemSelector'
import RemoteEntityPicker from '../components/RemoteEntityPicker'
import { useAuth } from '../context/AuthContext'

function buildLineKey(itemId, unitId) {
  return `${itemId}-${unitId || 'stock'}`
}

export default function DespachoFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [solicitante, setSolicitante] = useState(null)
  const [unit, setUnit] = useState('')
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [equipmentReference, setEquipmentReference] = useState('')
  const [notes, setNotes] = useState('')
  const [lineas, setLineas] = useState([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!solicitante || unit) return
    if (solicitante.unit) {
      setUnit(String(solicitante.unit))
      setSelectedUnit({
        id: solicitante.unit,
        name: solicitante.unit_name || `Unidad ${solicitante.unit}`,
        breadcrumb: solicitante.unit_name || null,
      })
    }
  }, [solicitante, unit])

  const searchLocations = async (query) => {
    const { data } = await inventoryApi.getLocations({
      search: query,
      page_size: 50,
    })
    const rows = data.results || data || []
    return rows.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  }

  const totalLineas = lineas.length
  const totalUnidades = useMemo(
    () => lineas.reduce((acc, line) => acc + Number(line.quantity || 0), 0),
    [lineas],
  )

  const resumenSolicitante = useMemo(() => {
    if (!solicitante) return 'Sin seleccionar'
    const rank = solicitante.rank ? `${solicitante.rank} ` : ''
    return `${rank}${solicitante.name}`
  }, [solicitante])

  const handleAddItem = ({ item, quantity, item_unit_id }) => {
    const key = buildLineKey(item.id, item_unit_id)
    const alreadyExists = lineas.some((line) => line.key === key)

    if (alreadyExists) {
      toast.error('Esta mercancía ya fue agregada al despacho')
      return
    }

    const normalizedQty = Number(quantity || 0)
    if (normalizedQty < 1) {
      toast.error('Cantidad inválida para la línea seleccionada')
      return
    }

    setLineas((prev) => [
      ...prev,
      {
        key,
        item,
        quantity: normalizedQty,
        item_unit_id: item_unit_id || null,
        notes: '',
      },
    ])

    toast.success('Mercancía agregada al despacho')
  }

  const handleRemoveLine = (lineKey) => {
    setLineas((prev) => prev.filter((line) => line.key !== lineKey))
  }

  const handleChangeQty = (lineKey, value) => {
    setLineas((prev) => prev.map((line) => {
      if (line.key !== lineKey) return line
      if (line.item.track_by_serial) return line

      const parsed = Number(value)
      if (Number.isNaN(parsed)) return { ...line, quantity: 0 }
      return { ...line, quantity: parsed }
    }))
  }

  const handleChangeLineNote = (lineKey, value) => {
    setLineas((prev) => prev.map((line) => (line.key === lineKey ? { ...line, notes: value } : line)))
  }

  const validateBeforeSubmit = () => {
    if (!solicitante) {
      toast.error('Debe seleccionar un solicitante')
      return false
    }

    if (!lineas.length) {
      toast.error('Debe agregar al menos una mercancía al despacho')
      return false
    }

    for (const [idx, line] of lineas.entries()) {
      const qty = Number(line.quantity || 0)
      if (qty < 1) {
        toast.error(`La línea ${idx + 1} tiene una cantidad inválida`)
        return false
      }

      if (!line.item.track_by_serial) {
        const max = Number(line.item.quantity || 0)
        if (qty > max) {
          toast.error(`La línea ${idx + 1} supera el stock disponible (${max})`)
          return false
        }
      }
    }

    return true
  }

  const handleSubmit = async () => {
    if (!validateBeforeSubmit()) return

    setSubmitting(true)
    try {
      const payload = {
        solicitante_id: solicitante.id,
        unit_id: unit ? Number(unit) : null,
        equipment_reference: equipmentReference,
        notes,
        items: lineas.map((line) => ({
          item_id: line.item.id,
          quantity: Number(line.quantity),
          item_unit_id: line.item_unit_id,
          notes: line.notes || '',
        })),
      }

      const { data } = await despachoApi.createDespacho(payload)
      toast.success(`Despacho ${data.ot_number} creado correctamente`)
      navigate(`/despachos/${data.id}`)
    } catch (error) {
      const detail = error.response?.data
      const message = typeof detail?.detail === 'string'
        ? detail.detail
        : Object.values(detail || {}).flat().join(', ')

      toast.error(message || 'No se pudo crear el despacho')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nuevo Despacho de Mercancía</h2>
          <p className="mt-1 text-sm text-gray-600">
            Registre la salida de mercancía del inventario con trazabilidad por solicitante, líneas y seriales.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/despachos')}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Volver al listado
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="space-y-6 xl:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Datos de entrega</h3>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Solicitante</label>
                <div className="mt-1">
                  <SolicitantePicker value={solicitante} onChange={setSolicitante} allowCreate={false} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Unidad / Base destino</label>
                <div className="mt-1">
                  <RemoteEntityPicker
                    value={selectedUnit}
                    onChange={(loc) => {
                      setSelectedUnit(loc)
                      setUnit(loc ? String(loc.id) : '')
                    }}
                    fetchOptions={searchLocations}
                    getLabel={(loc) => loc?.breadcrumb || loc?.name || '—'}
                    getMeta={(loc) => loc?.codigo ? `Código: ${loc.codigo}` : 'Sin código'}
                    placeholder="Buscar unidad/base por nombre o código..."
                    minChars={1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Entregado por</label>
                <input
                  type="text"
                  value={user?.name || ''}
                  disabled
                  className="mt-1 w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Referencia operativa</label>
                <input
                  type="text"
                  value={equipmentReference}
                  onChange={(e) => setEquipmentReference(e.target.value)}
                  placeholder="Ej: Reposición para estación de radio"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Observaciones del despacho</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Comentarios generales del despacho..."
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <CubeIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Mercancía a despachar</h3>
            </div>

            <p className="mb-3 text-xs text-gray-600">
              Busque artículos directamente del inventario y valide cuánto stock quedará antes de confirmar.
            </p>

            <ItemSelector onSelect={handleAddItem} source="inventory" />

            {lineas.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Agregue mercancías desde el buscador para construir el despacho.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {lineas.map((line, index) => {
                  const isSerial = !!line.item.track_by_serial
                  return (
                    <div key={line.key} className="rounded-lg border border-gray-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{index + 1}. {line.item.name}</p>
                          <p className="mt-1 text-xs text-gray-500">
                            Codigo: {line.item.code || line.item.sku || '—'} · Tipo: {line.item.kind_display || line.item.kind || '—'}
                          </p>
                          {line.item_unit_id ? (
                            <p className="mt-1 text-xs font-medium text-brand-800">Unidad serial seleccionada: #{line.item_unit_id}</p>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveLine(line.key)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                          Quitar
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cantidad</label>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            disabled={isSerial}
                            onChange={(e) => handleChangeQty(line.key, e.target.value)}
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                          />
                          <p className="mt-1 text-[11px] text-gray-500">
                            Disponible: {isSerial ? line.item.stock_available : `${line.item.quantity} ${line.item.unit || ''}`}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            Quedará: {isSerial
                              ? Math.max(0, Number(line.item.stock_available || 0) - Number(line.quantity || 0))
                              : `${Math.max(0, Number(line.item.quantity || 0) - Number(line.quantity || 0))} ${line.item.unit || ''}`}
                          </p>
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nota de línea</label>
                          <input
                            type="text"
                            value={line.notes}
                            onChange={(e) => handleChangeLineNote(line.key, e.target.value)}
                            placeholder="Ej: Entrega para mantenimiento preventivo"
                            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-base font-semibold text-gray-900">Resumen del despacho</h3>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Solicitante</dt>
                <dd className="text-right font-medium text-gray-900">{resumenSolicitante}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Líneas</dt>
                <dd className="font-medium text-gray-900">{totalLineas}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Unidades</dt>
                <dd className="font-medium text-gray-900">{totalUnidades}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Control de origen</dt>
                <dd className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  Inventario general
                </dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full rounded-md bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {submitting ? 'Registrando despacho...' : 'Confirmar despacho'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/despachos')}
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
