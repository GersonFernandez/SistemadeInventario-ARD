import React, { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const WARNING_TIME = 60 * 1000 // 1 minute warning

export default function SessionTimeout() {
  const { logout, isAuthenticated } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const timeoutRef = useRef(null)
  const warningRef = useRef(null)

  const getSessionTimeoutMs = () => {
    const minutes = Number(localStorage.getItem('sessionTimeoutMinutes') || 15)
    return Math.max(5, minutes) * 60 * 1000
  }

  const resetTimer = () => {
    if (!isAuthenticated) return
    const sessionTimeout = getSessionTimeoutMs()

    clearTimeout(timeoutRef.current)
    clearTimeout(warningRef.current)
    setShowWarning(false)

    warningRef.current = setTimeout(() => {
      setShowWarning(true)
    }, Math.max(sessionTimeout - WARNING_TIME, 1000))

    timeoutRef.current = setTimeout(() => {
      logout()
      toast.error('Su sesión ha expirado por inactividad')
    }, sessionTimeout)
  }

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimeout(timeoutRef.current)
      clearTimeout(warningRef.current)
      setShowWarning(false)
      return
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, resetTimer))

    resetTimer()

    return () => {
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      clearTimeout(timeoutRef.current)
      clearTimeout(warningRef.current)
    }
  }, [isAuthenticated])

  const handleStayLoggedIn = () => {
    resetTimer()
  }

  if (!showWarning) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-medium text-gray-900">Su sesión está por expirar</h3>
        <p className="mt-2 text-sm text-gray-600">
          Ha estado inactivo por un tiempo. Su sesión se cerrará en 1 minuto por seguridad.
        </p>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={() => {
              setShowWarning(false)
              logout()
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
          <button
            onClick={handleStayLoggedIn}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Continuar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
