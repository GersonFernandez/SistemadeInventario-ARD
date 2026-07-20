import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlassIcon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'
import { inventoryApi } from '../services/inventoryApi'
import { despachoApi } from '../services/workOrderApi'

const STATE_STYLES = {
  ok: 'bg-green-100 text-green-800 border-green-200',
  critico: 'bg-red-100 text-red-800 border-red-200',
  asignado: 'bg-amber-100 text-amber-800 border-amber-200',
}

const STATE_LABEL = {
  ok: 'OK',
  critico: 'Crítico',
  asignado: 'Asignado',
}

export default function ItemSelector({ onSelect, disabled = false, source = 'inventory' }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showList, setShowList] = useState(false)
  const [loading, setLoading] = useState(false)
  const [manualSearchTick, setManualSearchTick] = useState(0)
  const [selectedItem, setSelectedItem] = useState(null)
  const [units, setUnits] = useState([])
  const [loadingUnits, setLoadingUnits] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const t = setTimeout(() => {
      if (query.length >= 2 || manualSearchTick > 0) {
        setLoading(true)
        const request = source === 'dispatch'
          ? (query.length >= 2
            ? despachoApi.getDispatchableItems({ search: query, page_size: 10 })
            : despachoApi.getDispatchableItems({ page_size: 10 }))
          : (query.length >= 2
            ? inventoryApi.getItems({ search: query, is_active: true, page_size: 10 })
            : inventoryApi.getItems({ is_active: true, page_size: 10 }))

        request
          .then((r) => setResults(r.data.results || r.data))
          .finally(() => setLoading(false))
      } else {
        setResults([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, source, manualSearchTick])

  useEffect(() => {
    function handleClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowList(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelectItem = async (item) => {
    setSelectedItem(item)
    setShowList(false)
    setQuery(item.name)
    if (item.track_by_serial) {
      setLoadingUnits(true)
      try {
        const r = await inventoryApi.getItemUnits({ item: item.id, status: 'available' })
        setUnits(r.data.results || r.data)
      } finally {
        setLoadingUnits(false)
      }
    } else {
      setUnits([])
    }
  }

  const handleConfirm = (quantity, unitId) => {
    if (!selectedItem) return
    onSelect({
      item: selectedItem,
      quantity,
      item_unit_id: unitId,
    })
    setSelectedItem(null)
    setUnits([])
    setQuery('')
  }

  const handleCancel = () => {
    setSelectedItem(null)
    setUnits([])
    setQuery('')
  }

  const handleSearchClick = () => {
    if (disabled) return
    setShowList(true)
    setManualSearchTick((prev) => prev + 1)
  }

  if (selectedItem) {
    return (
      <div className="rounded-md border border-gray-300 bg-gray-50 p-3">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <p className="font-medium text-gray-900">{selectedItem.name}</p>
            <p className="text-xs text-gray-500">
              {selectedItem.code || '—'} · {selectedItem.kind_display}
            </p>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        {selectedItem.track_by_serial ? (
          <UnitSelector item={selectedItem} units={units} loading={loadingUnits} onConfirm={handleConfirm} />
        ) : (
          <QuantitySelector item={selectedItem} onConfirm={handleConfirm} />
        )}
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowList(true)
          }}
          onFocus={() => setShowList(true)}
          disabled={disabled}
          placeholder={
            source === 'dispatch'
              ? 'Buscar mercancía recibida por nombre, código o SKU...'
              : 'Buscar artículo del inventario por nombre, código o SKU...'
          }
          className="w-full rounded-md border border-gray-300 pl-9 pr-10 py-2 text-sm focus:border-brand-700 focus:outline-none focus:ring-brand-700"
        />
        <button
          type="button"
          onClick={handleSearchClick}
          disabled={disabled}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          title="Buscar productos"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
        </button>
      </div>
      {showList && (query.length >= 2 || manualSearchTick > 0 || loading) && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-gray-500">Buscando...</li>}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">No se encontraron artículos. Agregue el artículo en Inventario primero.</li>
          )}
          {results.map((item) => (
            <li
              key={item.id}
              onClick={() => handleSelectItem(item)}
              className="cursor-pointer border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-brand-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">{item.name}</p>
                  <p className="text-xs text-gray-500">
                    {item.code || '—'} · {item.kind_display}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-gray-700">
                    {item.track_by_serial
                      ? `${item.stock_available} disp. / ${item.units_count} total`
                      : `${item.quantity} ${item.unit}`}
                  </span>
                  {source === 'dispatch' && Number(item.received_quantity || 0) > 0 && (
                    <span className="text-[10px] text-gray-500">Recibido: {item.received_quantity}</span>
                  )}
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${
                      STATE_STYLES[item.availability_state] || 'bg-gray-100 text-gray-700 border-gray-200'
                    }`}
                  >
                    {STATE_LABEL[item.availability_state] || item.availability_state}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function QuantitySelector({ item, onConfirm }) {
  const [qty, setQty] = useState(1)
  const canSubmit = qty >= 1 && qty <= item.quantity

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <label className="block text-xs font-medium text-gray-700">Cantidad a despachar</label>
        <input
          type="number"
          min={1}
          max={item.quantity}
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value, 10) || 0)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">Stock disponible: {item.quantity} {item.unit}</p>
      </div>
      <button
        type="button"
        onClick={() => onConfirm(qty, null)}
        disabled={!canSubmit}
        className="inline-flex items-center gap-1 rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
      >
        <CheckIcon className="h-4 w-4" />
        Agregar
      </button>
    </div>
  )
}

function UnitSelector({ item, units, loading, onConfirm }) {
  const [unitId, setUnitId] = useState(units[0]?.id || '')

  useEffect(() => {
    if (!unitId && units.length > 0) setUnitId(units[0].id)
  }, [units, unitId])

  return (
    <div>
      <label className="block text-xs font-medium text-gray-700">Unidad específica (serial)</label>
      {loading ? (
        <p className="mt-1 text-xs text-gray-500">Cargando unidades disponibles...</p>
      ) : units.length === 0 ? (
        <p className="mt-1 text-xs text-red-600">No hay unidades disponibles para este item.</p>
      ) : (
        <>
          <select
            value={unitId}
            onChange={(e) => setUnitId(parseInt(e.target.value, 10))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.serial_number} {u.notes ? `— ${u.notes}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onConfirm(1, unitId)}
            disabled={!unitId}
            className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand-800 px-3 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
          >
            <CheckIcon className="h-4 w-4" />
            Agregar
          </button>
        </>
      )}
    </div>
  )
}
