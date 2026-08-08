import React from 'react'
import { Toaster, resolveValue, toast } from 'react-hot-toast'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'

const variants = {
  success: {
    title: 'Operación completada',
    icon: CheckCircleIcon,
    accent: 'border-l-emerald-500',
    iconColor: 'text-emerald-600',
    iconBackground: 'bg-emerald-50',
  },
  error: {
    title: 'No se pudo completar',
    icon: ExclamationCircleIcon,
    accent: 'border-l-red-500',
    iconColor: 'text-red-600',
    iconBackground: 'bg-red-50',
  },
  loading: {
    title: 'Procesando',
    icon: ArrowPathIcon,
    accent: 'border-l-brand-700',
    iconColor: 'text-brand-700',
    iconBackground: 'bg-brand-50',
  },
}

function readableMessage(value) {
  if (React.isValidElement(value) || typeof value === 'string' || typeof value === 'number') {
    return value
  }
  if (Array.isArray(value)) {
    return value.map(readableMessage).filter(Boolean).join(' ')
  }
  if (value && typeof value === 'object') {
    return Object.values(value).map(readableMessage).filter(Boolean).join(' ')
  }
  return 'Ocurrió un error inesperado. Intente nuevamente.'
}

function SystemToast({ notification }) {
  const variant = variants[notification.type] || {
    title: 'Información',
    icon: InformationCircleIcon,
    accent: 'border-l-gray-400',
    iconColor: 'text-gray-600',
    iconBackground: 'bg-gray-100',
  }
  const Icon = variant.icon
  const message = readableMessage(resolveValue(notification.message, notification))

  return (
    <div
      role={notification.type === 'error' ? 'alert' : 'status'}
      aria-live={notification.type === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex w-[calc(100vw-2rem)] max-w-md items-start gap-3 rounded-lg border border-gray-200 border-l-4 bg-white p-4 shadow-lg transition-all duration-200 ${variant.accent} ${
        notification.visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      }`}
    >
      <span className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${variant.iconBackground}`}>
        <Icon className={`h-5 w-5 ${variant.iconColor} ${notification.type === 'loading' ? 'animate-spin' : ''}`} />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-sm font-semibold text-gray-900">{variant.title}</p>
        <div className="mt-0.5 break-words text-sm leading-5 text-gray-600">{message}</div>
      </div>

      {notification.type !== 'loading' && (
        <button
          type="button"
          onClick={() => toast.dismiss(notification.id)}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-1"
          aria-label="Cerrar notificación"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  )
}

export default function SystemToaster() {
  return (
    <Toaster
      position="top-right"
      gutter={12}
      toastOptions={{
        duration: 4500,
        success: { duration: 3500 },
        error: { duration: 6000 },
      }}
    >
      {(notification) => <SystemToast notification={notification} />}
    </Toaster>
  )
}