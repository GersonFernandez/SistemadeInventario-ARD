import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { serviceOrderApi } from '../services/serviceOrderApi'
import { productApi } from '../services/productApi'
import { userApi } from '../services/userApi'
import { useAuth } from '../context/AuthContext'
import { downloadBlob } from '../utils/download'
import ProductPickerField from '../components/ProductPickerField'

const serviceTypeOptions = [
  { value: 'reparacion', label: 'Reparación' },
  { value: 'instalacion', label: 'Instalación' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
]

const statusOptions = [
  { value: 'recibido', label: 'Recibido' },
  { value: 'en_diagnostico', label: 'En diagnóstico' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'pendiente_repuesto', label: 'Pendiente repuesto' },
  { value: 'completado', label: 'Completado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
]

const emptyLine = {
  item: '',
  item_search: '',
  serial_number: '',
  description: '',
  equipment_condition: 'usado',
}

export default function ServiceOrdersPage() {
  const { user } = useAuth()
  const canCreate = user?.role === 'admin' || user?.role === 'almacenista'

  const [orders, setOrders] = useState([])
  const [items, setItems] = useState([])
  const [locations, setLocations] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusDrafts, setStatusDrafts] = useState({})
  const [loadErrors, setLoadErrors] = useState({
    orders: '',
    catalogs: '',
  })
  const [lineSearch, setLineSearch] = useState('')
  const [lineSort, setLineSort] = useState({ key: 'index', direction: 'asc' })
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
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    setLoadErrors({ orders: '', catalogs: '' })
    try {
      const ordersRes = await serviceOrderApi.getServiceOrders()
      setOrders(ordersRes.data.results || ordersRes.data)

      try {
        const [itemsRes, usersRes, locationsRes] = await Promise.all([
          productApi.getItems({ page_size: 300 }),
          userApi.getUsers(),
          productApi.getLocations({ page_size: 200 }),
        ])

        const users = usersRes.data.results || usersRes.data
        const loadedItems = itemsRes.data.results || itemsRes.data
        setItems(loadedItems.filter((item) => item.is_active !== false && item.is_base_product !== false))
        setLocations(locationsRes.data.results || locationsRes.data)
        setTechnicians(users.filter((u) => u.role === 'tecnico' && u.is_active))
      } catch (error) {
        toast.error('No se pudieron cargar productos, ubicaciones o técnicos')
        setLoadErrors((prev) => ({
          ...prev,
          catalogs: 'No se pudieron cargar productos, ubicaciones o técnicos.',
        }))
        console.error(error)
      }
    } catch (error) {
      toast.error('No se pudieron cargar las órdenes de servicio')
      setLoadErrors((prev) => ({
        ...prev,
        orders: 'No se pudieron cargar las órdenes de servicio.',
      }))
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const canOperateOrder = (order) => {
    if (user?.role === 'admin' || user?.role === 'almacenista') return true
    return user?.role === 'tecnico' && order.assigned_technician === user?.id
  }

  const addLine = () => {
    setForm((prev) => ({ ...prev, write_items: [...prev.write_items, { ...emptyLine }] }))
  }

  const removeLine = (index) => {
    setForm((prev) => {
      if (prev.write_items.length === 1) return prev
      return {
        ...prev,
        write_items: prev.write_items.filter((_, idx) => idx !== index),
      }
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

  const getItemOptionLabel = (item) => {
    const code = item.code || item.part_number || 'sin-codigo'
    return `${item.name} | ${item.marca || item.brand_name || 'Sin marca'} | ${item.modelo || item.product_model_name || 'Sin modelo'} | ${code}`
  }


  const toggleLineSort = (key) => {
    setLineSort((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { key, direction: 'asc' }
    })
  }

  const sortedFilteredLines = useMemo(() => {
    const q = lineSearch.trim().toLowerCase()
    const decorated = form.write_items.map((line, index) => ({ ...line, originalIndex: index }))

    const filtered = q
      ? decorated.filter((line) => {
        const productText = getItemDisplay(line.item).toLowerCase()
        return (
          productText.includes(q)
          || (line.serial_number || '').toLowerCase().includes(q)
          || (line.description || '').toLowerCase().includes(q)
          || (line.equipment_condition || '').toLowerCase().includes(q)
        )
      })
      : decorated

    const dir = lineSort.direction === 'asc' ? 1 : -1
    return filtered.sort((a, b) => {
      if (lineSort.key === 'index') return (a.originalIndex - b.originalIndex) * dir
      if (lineSort.key === 'product') return getItemDisplay(a.item).localeCompare(getItemDisplay(b.item)) * dir
      if (lineSort.key === 'serial') return (a.serial_number || '').localeCompare(b.serial_number || '') * dir
      if (lineSort.key === 'state') return (a.equipment_condition || '').localeCompare(b.equipment_condition || '') * dir
      if (lineSort.key === 'description') return (a.description || '').localeCompare(b.description || '') * dir
      return 0
    })
  }, [form.write_items, items, lineSearch, lineSort])

  const handleTransition = async (order) => {
    const newStatus = statusDrafts[order.id] || order.status
    const note = window.prompt('Nota de transición (opcional):', '') || ''
    try {
      await serviceOrderApi.transitionServiceOrder(order.id, newStatus, note)
      toast.success('Estado actualizado')
      loadAll()
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo actualizar el estado')
    }
  }

  const handleDownloadCompletionReceipt = async (order, format = 'pdf') => {
    try {
      const response = await serviceOrderApi.downloadCompletionReceipt(order.id, format)
      const extension = format === 'pdf' ? 'pdf' : 'xlsx'
      downloadBlob(response, `cierre_${order.service_number}.${extension}`)
      toast.success('Comprobante de cierre descargado')
    } catch (error) {
      toast.error(error.response?.data?.detail || 'No se pudo descargar el comprobante de cierre')
    }
  }

  const submit = async (e) => {
    e.preventDefault()

    const invalidLine = form.write_items.find((line) => !line.item || !line.serial_number.trim())
    if (invalidLine) {
      toast.error('Cada línea debe tener producto y serial')
      return
    }

    const seenKeys = new Set()
    for (const line of form.write_items) {
      const duplicateKey = `${line.item}-${line.serial_number.trim().toLowerCase()}`
      if (seenKeys.has(duplicateKey)) {
        toast.error('No se permite repetir el mismo producto y serial en la orden')
        return
      }
      seenKeys.add(duplicateKey)
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

      await serviceOrderApi.createServiceOrder(payload)
      toast.success('Orden de servicio creada')
      setForm({
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
      loadAll()
    } catch (error) {
      const message = error.response?.data?.detail || 'No se pudo crear la orden de servicio'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Órdenes de servicio</h2>
        <p className="mt-1 text-sm text-gray-600">
          Gestión de servicios de reparación, instalación y mantenimiento agrupando varios productos por orden.
        </p>
      </div>

      {(loadErrors.orders || loadErrors.catalogs) && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-semibold">Se detectaron problemas de carga:</p>
          {loadErrors.orders && <p>• {loadErrors.orders}</p>}
          {loadErrors.catalogs && <p>• {loadErrors.catalogs}</p>}
        </div>
      )}

      {canCreate && (
        <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Nueva orden de servicio</h3>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tipo de servicio</label>
              <select
                value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {serviceTypeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Técnico asignado</label>
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
              <label className="block text-sm font-medium text-gray-700">Unidad solicitante</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700">Nombre (opcional)</label>
              <input
                value={form.recipient_first_name}
                onChange={(e) => setForm({ ...form, recipient_first_name: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Nombre"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Apellido (opcional)</label>
              <input
                value={form.recipient_last_name}
                onChange={(e) => setForm({ ...form, recipient_last_name: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Apellido"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Cédula (opcional)</label>
              <input
                value={form.recipient_id_card}
                onChange={(e) => setForm({ ...form, recipient_id_card: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Cédula"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Rango/Cargo (opcional)</label>
              <input
                value={form.recipient_rank_position}
                onChange={(e) => setForm({ ...form, recipient_rank_position: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder="Rango o cargo"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Notas generales</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800">Productos de la orden</h4>
              <div className="flex items-center gap-2">
                <input
                  value={lineSearch}
                  onChange={(e) => setLineSearch(e.target.value)}
                  placeholder="Buscar producto, serial o descripción"
                  className="w-64 rounded-md border border-gray-300 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={addLine}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Agregar producto
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                      <button type="button" onClick={() => toggleLineSort('index')}>#</button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                      <button type="button" onClick={() => toggleLineSort('product')}>Producto</button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                      <button type="button" onClick={() => toggleLineSort('serial')}>Serial</button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                      <button type="button" onClick={() => toggleLineSort('state')}>Estado</button>
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">
                      <button type="button" onClick={() => toggleLineSort('description')}>Descripción</button>
                    </th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {sortedFilteredLines.map((line, visibleIndex) => (
                    <tr key={`line-${line.originalIndex}`}>
                      <td className="px-3 py-2 text-xs font-medium text-gray-600">{visibleIndex + 1}</td>
                      <td className="px-3 py-2">
                        <ProductPickerField
                          items={items}
                          line={line}
                          onPatch={(patch) => updateLine(line.originalIndex, patch)}
                          modalTitle="Buscar producto"
                          modalSubtitle="Seleccione un producto para agregarlo a la orden de servicio."
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={line.serial_number}
                          onChange={(e) => updateLine(line.originalIndex, { serial_number: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                          placeholder="Número de serie"
                          required
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={line.equipment_condition}
                          onChange={(e) => updateLine(line.originalIndex, { equipment_condition: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                        >
                          <option value="nuevo">Nuevo</option>
                          <option value="usado">Usado</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={line.description}
                          onChange={(e) => updateLine(line.originalIndex, { description: e.target.value })}
                          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
                          placeholder="Descripción del producto"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeLine(line.originalIndex)}
                          disabled={form.write_items.length === 1}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {sortedFilteredLines.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-xs text-gray-500">No hay filas que coincidan con la búsqueda.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear orden de servicio'}
          </button>
        </form>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Núm.</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Servicio</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Productos agrupados</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Técnico</th>
              <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
              <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">Cargando...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">Sin órdenes registradas.</td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">{order.service_number}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{order.service_type_display}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {order.grouped_items && order.grouped_items.length > 0 ? (
                      <ul className="space-y-1">
                        {order.grouped_items.map((entry, idx) => (
                          <li key={`${order.id}-group-${idx}`} className="rounded bg-gray-50 px-2 py-1">
                            <div className="font-medium">{entry.product}</div>
                            <div>Serial: {entry.serial || '—'}</div>
                            <div>Descripción: {entry.description || '—'}</div>
                            <div>Estado: {entry.state_display}</div>
                            {entry.count > 1 && <div>Cantidad agrupada: {entry.count}</div>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div>
                        <div className="font-medium">{order.equipment_name_snapshot || order.equipment_name}</div>
                        <div>Serial: {order.equipment_serial_number || '—'}</div>
                        <div>Descripción: {order.equipment_description_snapshot || '—'}</div>
                        <div>Estado: {order.equipment_condition === 'nuevo' ? 'Nuevo' : 'Usado'}</div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{order.assigned_technician_name || 'Sin asignar'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    <div>{order.status_display}</div>
                    {canOperateOrder(order) && (
                      <select
                        value={statusDrafts[order.id] || order.status}
                        onChange={(e) => setStatusDrafts((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                      >
                        {statusOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-sm">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/service-orders/${order.id}`}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Ver detalle
                      </Link>
                      {(order.status === 'completado' || order.status === 'entregado') && (
                        <button
                          type="button"
                          onClick={() => handleDownloadCompletionReceipt(order, 'pdf')}
                          className="rounded-md border border-indigo-300 px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50"
                        >
                          Comprobante PDF
                        </button>
                      )}
                    </div>
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
