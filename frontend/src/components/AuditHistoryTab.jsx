import React, { useEffect, useState } from 'react'
import { ClockIcon, UserIcon, PencilIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'
import { auditApi } from '../services/auditApi'

const ACTION_ICONS = {
  CREATE: PlusIcon,
  UPDATE: PencilIcon,
  DELETE: TrashIcon,
}

const ACTION_LABELS = {
  CREATE: 'Creación',
  UPDATE: 'Actualización',
  DELETE: 'Eliminación',
}

const ACTION_COLORS = {
  CREATE: 'text-green-600 bg-green-50',
  UPDATE: 'text-blue-600 bg-blue-50',
  DELETE: 'text-red-600 bg-red-50',
}

export default function AuditHistoryTab({ modelName, objectId }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLogs()
  }, [modelName, objectId])

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const { data } = await auditApi.getLogs({
        model_name: modelName,
        object_id: String(objectId),
        ordering: '-timestamp',
      })
      setLogs(data.results || data)
    } catch (error) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        setLogs([])
      } else {
        setLogs([])
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Cargando historial...</p>
  }

  if (logs.length === 0) {
    return <p className="text-sm text-gray-500">No hay registros de auditoría para este objeto.</p>
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => {
        const Icon = ACTION_ICONS[log.action] || ClockIcon
        const colorClass = ACTION_COLORS[log.action] || 'text-gray-600 bg-gray-50'
        return (
          <div key={log.id} className="flex gap-4 p-4 bg-white rounded-lg border border-gray-200">
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${colorClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  {ACTION_LABELS[log.action] || log.action_display}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(log.timestamp).toLocaleString('es-DO')}
                </p>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <UserIcon className="h-3 w-3" />
                <span>{log.user_name || log.user_email || 'Sistema'}</span>
              </div>
              {log.ip_address && (
                <p className="mt-1 text-xs text-gray-400">IP: {log.ip_address}</p>
              )}
              {log.changes && Object.keys(log.changes).length > 0 && (
                <div className="mt-2 text-xs bg-gray-50 rounded p-2">
                  <p className="font-medium text-gray-700 mb-1">Cambios:</p>
                  <ul className="space-y-1">
                    {Object.entries(log.changes).map(([field, change]) => (
                      <li key={field} className="text-gray-600">
                        <span className="font-medium">{field}:</span>{' '}
                        {formatChange(change)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatChange(change) {
  if (change && typeof change === 'object' && 'old' in change && 'new' in change) {
    return `${JSON.stringify(change.old)} → ${JSON.stringify(change.new)}`
  }
  return JSON.stringify(change)
}
