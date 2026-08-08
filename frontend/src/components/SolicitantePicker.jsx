import { useEffect, useRef, useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { solicitanteApi } from '../services/workOrderApi'

export default function SolicitantePicker({ value, onChange, disabled = false }) {
  const [solicitantes, setSolicitantes] = useState([])
  const [query, setQuery] = useState('')
  const [showList, setShowList] = useState(false)
  const [loading, setLoading] = useState(false)
  const [manualSearchTick, setManualSearchTick] = useState(0)
  const wrapperRef = useRef(null)

  const currentValue = value && typeof value === 'object' ? value : null

  useEffect(() => {
    if (currentValue) {
      setQuery(currentValue.full_name || currentValue.name || '')
    } else {
      setQuery('')
    }
  }, [currentValue])

  useEffect(() => {
    const t = setTimeout(() => {
      if (showList && (query.length >= 2 || manualSearchTick > 0) && !currentValue) {
        setLoading(true)
        const request = query.length >= 2
          ? solicitanteApi.search(query)
          : solicitanteApi.list({ is_active: true })

        request
          .then((response) => setSolicitantes(response.data.results || response.data || []))
          .finally(() => setLoading(false))
      } else {
        setSolicitantes([])
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(t)
  }, [query, showList, currentValue, manualSearchTick])

  useEffect(() => {
    function handleClick(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowList(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (solicitante) => {
    onChange(solicitante)
    setQuery(solicitante.full_name || solicitante.name || '')
    setShowList(false)
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    setSolicitantes([])
    setShowList(false)
  }

  const handleSearchClick = () => {
    if (disabled) return
    setShowList(true)
    setManualSearchTick((prev) => prev + 1)
  }

  const displayUnit = (solicitante) => {
    if (solicitante.unit_name) return solicitante.unit_name
    if (solicitante.unit && typeof solicitante.unit === 'object') return solicitante.unit.name || 'Sin unidad'
    if (solicitante.unit) return String(solicitante.unit)
    return 'Sin unidad'
  }

  return (
    <div ref={wrapperRef} className="relative">
      {currentValue ? (
        <div className="rounded-md border border-gray-300 bg-gray-50 p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{currentValue.full_name || currentValue.name}</p>
              <p className="text-xs text-gray-500">{displayUnit(currentValue)}</p>
            </div>
            <button
              type="button"
              onClick={handleClear}
              disabled={disabled}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid gap-2 text-xs text-gray-600 sm:grid-cols-2">
            <div>
              <span className="font-medium text-gray-700">Rango:</span> {currentValue.rank || 'No indicado'}
            </div>
            <div>
              <span className="font-medium text-gray-700">Cédula dominicana:</span> {currentValue.agent_id || 'No indicado'}
            </div>
            <div className="sm:col-span-2">
              <span className="font-medium text-gray-700">Estado:</span>{' '}
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${currentValue.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}
              >
                {currentValue.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            {currentValue.notes ? (
              <div className="sm:col-span-2 text-gray-500">
                <span className="font-medium text-gray-700">Notas:</span> {currentValue.notes}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setShowList(true)
                if (!event.target.value) onChange(null)
              }}
              onFocus={() => setShowList(true)}
              disabled={disabled}
              placeholder="Buscar por nombre, rango, cédula dominicana o unidad..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 pl-9 pr-10 text-sm focus:border-brand-700 focus:outline-none focus:ring-brand-700"
            />
            <button
              type="button"
              onClick={handleSearchClick}
              disabled={disabled}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              title="Buscar solicitantes"
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {!currentValue && showList && (query.length >= 2 || manualSearchTick > 0 || loading) && (
        <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-gray-500">Buscando...</li>}
          {!loading && solicitantes.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">No se encontraron solicitantes.</li>
          )}
          {solicitantes.map((solicitante) => (
            <li
              key={solicitante.id}
              onClick={() => handleSelect(solicitante)}
              className="cursor-pointer border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-brand-50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900">
                    {solicitante.full_name || `${solicitante.rank ? `${solicitante.rank} ` : ''}${solicitante.name}`}
                  </p>
                  <p className="text-xs text-gray-500">
                    {displayUnit(solicitante)}
                    {solicitante.agent_id ? ` · ${solicitante.agent_id}` : ''}
                  </p>
                  {solicitante.notes ? <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{solicitante.notes}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${solicitante.is_active ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
                  >
                    {solicitante.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                  <span className="text-[10px] text-gray-400">Seleccionar</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

    </div>
  )
}
