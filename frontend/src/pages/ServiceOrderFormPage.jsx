import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ArrowLeftIcon,
  TrashIcon,
  UserCircleIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { serviceOrderApi } from '../services/serviceOrderApi'
import { productApi } from '../services/productApi'
import { userApi } from '../services/userApi'
import ProductPickerField from '../components/ProductPickerField'

const serviceTypeOptions = [
  { value: 'reparacion', label: 'Reparación' },
  { value: 'instalacion', label: 'Instalación' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
]

const emptyLine = {
  item: '',
  item_search: '',
  serial_number: '',
  description: '',
  equipment_condition: 'usado',
}

export default function ServiceOrderFormPage() {
  const navigate = useNavigate()

  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    service_type: 'reparacion',
    assigned_technician: '',
    unit: '',
    recipient_first_name: '',
    recipient_last_name: '',
    recipient_id_card: '',
    recipient_rank_position: '',
    notes: '',
    write_items: [{ ...emptyLine }],
  })

  useEffect(() => {
    const loadCatalogs = async () => {
      try {
        const [itemsRes, usersRes, locationsRes] = await Promise.all([
          productApi.getItems({ page_size: 300 }),
          userApi.getUsers(),
          productApi.getLocations({ page_size: 200 }),
        ])
        const users = usersRes.data.results || usersRes.data
        const loadedItems = itemsRes.data.results || itemsRes.data
        setItems(loadedItems.filter((i) => i.is_active !== false && i.is_base_product !== false))
        setLocations(locationsRes.data.results || locationsRes.data)
        setTechnicians(users.filter((u) => u.role === 'tecnico' && u.is_active))
      } catch {
        toast.error('No se pudieron cargar productos, ubicaciones o técnicos')
      }
    }
    loadCatalogs()
  }, [])

  const addLine = () => setForm((prev) => ({ ...prev, write_items: [...prev.write_items, { ...emptyLine }] }))

  const removeLine = (index) => {
    setForm((prev) => {
      if (prev.write_items.length === 1) return prev
      return { ...prev, write_items: prev.write_items.filter((_, idx) => idx !== index) }
    })
  }

  const updateLine = (index, patch) => {
    setForm((prev) => ({
      ...prev,
      write_items: prev.write_items.map((line, idx) => (idx === index ? { ...line, ...patch } : line)),
    }))
  }

  const getItemDisplay = (itemId) => {
    const found = items.find((item) => String(item.id) === String(itemId))
    if (!found) return ''
    return `${found.name} ${found.marca || found.brand_name || ''} ${found.modelo || found.product_model_name || ''}`.trim()
  }

  const totalLineas = form.write_items.length

  const recipientSummary = useMemo(() => {
    const parts = [form.recipient_first_name, form.recipient_last_name].filter(Boolean)
    if (!parts.length) return null
    return parts.join(' ')
  }, [form.recipient_first_name, form.recipient_last_name])

  const handleSubmit = async () => {
    const invalidLine = form.write_items.find((line) => !line.item)
    if (invalidLine) {
      toast.error('Cada línea debe tener un producto seleccionado')
      return
    }

    const seenKeys = new Set()
    for (const line of form.write_items) {
      const key = `${line.item}-${(line.serial_number || '').trim().toLowerCase()}`
      if (seenKeys.has(key)) {
        toast.error('No se permite repetir el mismo producto y serial en la orden')
        return
      }
      seenKeys.add(key)
    }

    setSaving(true)
    try {
      const payload = {
        service_type: form.service_type,
        assigned_technician: form.assigned_technician ? Number(form.assigned_technician) : null,
        unit: form.unit ? Number(form.unit) : null,
        recipient_first_name: form.recipient_first_name.trim(),
        recipient_last_name: form.recipient_last_name.trim(),
        recipient_id_card: form.recipient_id_card.trim(),
        recipient_rank_position: form.recipient_rank_position.trim(),
        notes: form.notes,
        write_items: form.write_items.map((line) => ({
          item: Number(line.item),
          serial_number: line.serial_number.trim(),
          description: line.description,
          equipment_condition: line.equipment_condition,
        })),
      }

      const { data } = await serviceOrderApi.createServiceOrder(payload)
      toast.success(`Orden ${data.service_number} creada correctamente`)
      navigate(`/service-orders/${data.id}`)
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo crear la orden de servicio')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-brand-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Nueva orden de servicio</h2>
          <p className="mt-1 text-sm text-gray-600">
            Registre equipos que ingresan al taller para reparación, instalación o mantenimiento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/service-orders')}
          className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Volver al listado
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* ── Columna principal ── */}
        <section className="space-y-6 xl:col-span-2">

          {/* Tipo de servicio y técnico */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <WrenchScrewdriverIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Datos del servicio</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Tipo de servicio</label>
                <select
                  value={form.service_type}
                  onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {serviceTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Técnico asignado</label>
                <select
                  value={form.assigned_technician}
                  onChange={(e) => setForm({ ...form, assigned_technician: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin asignar</option>
                  {technicians.map((tech) => (
                    <option key={tech.id} value={tech.id}>{tech.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Unidad solicitante</label>
                <select
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">Sin unidad</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.breadcrumb || loc.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Observaciones generales</label>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Comentarios sobre la orden..."
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Destinatario */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Datos del destinatario</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Nombre (opcional)</label>
                <input
                  value={form.recipient_first_name}
                  onChange={(e) => setForm({ ...form, recipient_first_name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Nombre"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Apellido (opcional)</label>
                <input
                  value={form.recipient_last_name}
                  onChange={(e) => setForm({ ...form, recipient_last_name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Apellido"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Cédula (opcional)</label>
                <input
                  value={form.recipient_id_card}
                  onChange={(e) => setForm({ ...form, recipient_id_card: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Cédula"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Rango / Cargo (opcional)</label>
                <input
                  value={form.recipient_rank_position}
                  onChange={(e) => setForm({ ...form, recipient_rank_position: e.target.value })}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Rango o cargo"
                />
              </div>
            </div>
          </div>

          {/* Equipos / líneas */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-lg font-semibold text-gray-900">Equipos a atender</h3>
            </div>

            <p className="mb-3 text-xs text-gray-600">
              Busque artículos del catálogo de productos y complete el serial y la descripción para cada equipo.
            </p>

            {form.write_items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
                Agregue equipos usando el botón de abajo.
              </div>
            ) : (
              <div className="space-y-3">
                {form.write_items.map((line, index) => (
                  <div key={index} className="rounded-lg border border-gray-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Producto</label>
                        <div className="mt-1">
                          <ProductPickerField
                            items={items}
                            line={line}
                            onPatch={(patch) => updateLine(index, patch)}
                            modalTitle="Buscar producto"
                            modalSubtitle="Seleccione un producto para agregarlo a la orden de servicio."
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeLine(index)}
                        disabled={form.write_items.length === 1}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Quitar
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Serial</label>
                        <input
                          value={line.serial_number}
                          onChange={(e) => updateLine(index, { serial_number: e.target.value })}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                          placeholder="Número de serie"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Estado del equipo</label>
                        <select
                          value={line.equipment_condition}
                          onChange={(e) => updateLine(index, { equipment_condition: e.target.value })}
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="usado">Usado</option>
                          <option value="nuevo">Nuevo</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wide text-gray-600">Descripción del problema</label>
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(index, { description: e.target.value })}
                          placeholder="Ej: No enciende"
                          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                        />
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
              Agregar equipo
            </button>
          </div>

        </section>

        {/* ── Aside: resumen ── */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ClipboardDocumentListIcon className="h-5 w-5 text-brand-800" />
              <h3 className="text-base font-semibold text-gray-900">Resumen de la orden</h3>
            </div>

            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Tipo de servicio</dt>
                <dd className="font-medium text-gray-900">
                  {serviceTypeOptions.find((o) => o.value === form.service_type)?.label || '—'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Destinatario</dt>
                <dd className="text-right font-medium text-gray-900">
                  {recipientSummary || <span className="text-gray-400">Sin completar</span>}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Equipos</dt>
                <dd className="font-medium text-gray-900">{totalLineas}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Técnico</dt>
                <dd className="text-right font-medium text-gray-900">
                  {form.assigned_technician
                    ? (technicians.find((t) => String(t.id) === form.assigned_technician)?.name || '—')
                    : <span className="text-gray-400">Sin asignar</span>}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-gray-600">Control de origen</dt>
                <dd className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  <ShieldCheckIcon className="h-3.5 w-3.5" />
                  Taller electrónica
                </dd>
              </div>
            </dl>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="w-full rounded-md bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-50"
              >
                {saving ? 'Creando orden...' : 'Confirmar orden de servicio'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/service-orders')}
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
