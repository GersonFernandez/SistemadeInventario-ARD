import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getMediaUrl } from '../services/inventoryApi'

function buildSearchBucket(item) {
  return [
    item.name,
    item.brand_name,
    item.marca,
    item.product_model_name,
    item.modelo,
    item.category_name,
    item.code,
    item.part_number,
    item.application,
    item.sku,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function getOptionLabel(item) {
  const brand = item.brand_name || item.marca || 'Sin marca'
  const model = item.product_model_name || item.modelo || 'Sin modelo'
  const code = item.code || item.part_number || 'sin-codigo'
  return `${item.name} | ${brand} | ${model} | ${code}`
}

export default function ProductPickerField({
  items,
  line,
  onPatch,
  onSelectExtraPatch,
  onClearExtraPatch,
  placeholder = 'Buscar producto por nombre, marca, modelo o codigo',
  modalTitle = 'Buscar producto',
  modalSubtitle = 'Seleccione un producto para agregar.',
  required = true,
}) {
  const [showInlineResults, setShowInlineResults] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')

  const selectedItem = useMemo(
    () => items.find((item) => String(item.id) === String(line.item)) || null,
    [items, line.item],
  )

  const inlineResults = useMemo(() => {
    const q = (line.item_search || '').trim().toLowerCase()
    if (!q) return []
    return items.filter((item) => buildSearchBucket(item).includes(q)).slice(0, 8)
  }, [items, line.item_search])

  const modalResults = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase()
    const filtered = q
      ? items.filter((item) => buildSearchBucket(item).includes(q))
      : items
    return filtered.slice(0, 40)
  }, [items, pickerQuery])

  const selectItem = (item) => {
    onPatch({
      item: String(item.id),
      item_search: getOptionLabel(item),
      ...(onSelectExtraPatch ? onSelectExtraPatch(item) : {}),
    })
    setShowInlineResults(false)
  }

  const clearOnTyping = (value) => {
    onPatch({
      item_search: value,
      item: '',
      ...(onClearExtraPatch ? onClearExtraPatch() : {}),
    })
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={line.item_search || ''}
          onFocus={() => setShowInlineResults(true)}
          onBlur={() => {
            if (!line.item) {
              onPatch({ item_search: '', ...(onClearExtraPatch ? onClearExtraPatch() : {}) })
            }
            setTimeout(() => setShowInlineResults(false), 120)
          }}
          onChange={(e) => clearOnTyping(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-2 py-2 text-sm"
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          onClick={() => {
            setPickerQuery('')
            setPickerOpen(true)
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-gray-300 px-2 text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          title="Buscar producto"
        >
          <MagnifyingGlassIcon className="h-4 w-4" />
        </button>
      </div>

      {selectedItem && (
        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Producto seleccionado</p>
          <p className="mt-1 text-sm font-medium text-gray-900">{selectedItem.name}</p>
          <div className="mt-2 grid grid-cols-1 gap-2 text-[11px] text-gray-600 md:grid-cols-2">
            <p><span className="font-semibold text-gray-700">Codigo:</span> {selectedItem.code || selectedItem.part_number || '—'}</p>
            <p><span className="font-semibold text-gray-700">Marca:</span> {selectedItem.brand_name || selectedItem.marca || '—'}</p>
            <p><span className="font-semibold text-gray-700">Modelo:</span> {selectedItem.product_model_name || selectedItem.modelo || '—'}</p>
            <p><span className="font-semibold text-gray-700">Categoria:</span> {selectedItem.category_name || '—'}</p>
            <p><span className="font-semibold text-gray-700">Unidad:</span> {selectedItem.unit || '—'}</p>
            <p><span className="font-semibold text-gray-700">Stock actual:</span> {selectedItem.quantity ?? '—'}</p>
          </div>
          {selectedItem.application && (
            <p className="mt-2 text-[11px] text-gray-600">
              <span className="font-semibold text-gray-700">Aplicacion:</span> {selectedItem.application}
            </p>
          )}
          {selectedItem.image_url && (
            <img
              src={getMediaUrl(selectedItem.image_url)}
              alt={selectedItem.name}
              className="mt-3 h-20 w-20 rounded-md border border-gray-200 object-cover"
            />
          )}
        </div>
      )}

      {showInlineResults && inlineResults.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-44 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {inlineResults.map((item) => (
            <button
              key={item.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                selectItem(item)
              }}
              className="block w-full border-b border-gray-100 px-2 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
            >
              {getOptionLabel(item)}
            </button>
          ))}
        </div>
      )}

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{modalTitle}</h3>
                <p className="text-sm text-gray-500">{modalSubtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="relative">
                <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Filtrar por nombre, marca, modelo, codigo o parte"
                  className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm"
                  autoFocus
                />
              </div>

              <div className="max-h-[28rem] overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Producto</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Marca / Modelo</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Categoria</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-500">Codigo</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-500">Accion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {modalResults.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{item.name}</td>
                        <td className="px-3 py-2 text-gray-700">{item.brand_name || item.marca || '—'} / {item.product_model_name || item.modelo || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{item.category_name || '—'}</td>
                        <td className="px-3 py-2 text-gray-700">{item.code || item.part_number || '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              selectItem(item)
                              setPickerOpen(false)
                            }}
                            className="rounded-md border border-brand-200 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}
                    {modalResults.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No hay productos que coincidan con la busqueda.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}