import { useEffect, useRef, useState } from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function RemoteEntityPicker({
  value,
  onChange,
  fetchOptions,
  getLabel,
  getMeta,
  placeholder = 'Buscar...',
  disabled = false,
  minChars = 1,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [showList, setShowList] = useState(false)
  const [loading, setLoading] = useState(false)
  const [manualSearchTick, setManualSearchTick] = useState(0)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (value) {
      setQuery(getLabel(value))
    } else {
      setQuery('')
    }
  }, [value, getLabel])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!showList) return
      if (!value && (query.trim().length >= minChars || manualSearchTick > 0)) {
        setLoading(true)
        try {
          const rows = await fetchOptions(query.trim())
          setResults(Array.isArray(rows) ? rows : [])
        } finally {
          setLoading(false)
        }
      } else {
        setResults([])
        setLoading(false)
      }
    }, 250)

    return () => clearTimeout(timer)
  }, [query, showList, value, manualSearchTick, fetchOptions, minChars])

  useEffect(() => {
    function handleClick(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowList(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const selectRow = (row) => {
    onChange(row)
    setQuery(getLabel(row))
    setShowList(false)
  }

  const clearRow = () => {
    onChange(null)
    setQuery('')
    setResults([])
    setShowList(false)
  }

  const handleSearchClick = () => {
    if (disabled) return
    setShowList(true)
    setManualSearchTick((prev) => prev + 1)
  }

  return (
    <div ref={wrapperRef} className="relative">
      {value ? (
        <div className="rounded-md border border-gray-300 bg-gray-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">{getLabel(value)}</p>
              {getMeta && <p className="text-xs text-gray-500">{getMeta(value)}</p>}
            </div>
            <button
              type="button"
              onClick={clearRow}
              disabled={disabled}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div className="relative">
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
            placeholder={placeholder}
            className="w-full rounded-md border border-gray-300 px-3 py-2 pl-9 pr-10 text-sm focus:border-brand-700 focus:outline-none focus:ring-brand-700"
          />
          <button
            type="button"
            onClick={handleSearchClick}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
            title="Buscar"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {!value && showList && (query.trim().length >= minChars || manualSearchTick > 0 || loading) && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {loading && <li className="px-3 py-2 text-sm text-gray-500">Buscando...</li>}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-gray-500">No hay resultados.</li>
          )}
          {results.map((row) => (
            <li
              key={row.id}
              onClick={() => selectRow(row)}
              className="cursor-pointer border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-brand-50"
            >
              <p className="truncate font-medium text-gray-900">{getLabel(row)}</p>
              {getMeta && <p className="text-xs text-gray-500">{getMeta(row)}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
