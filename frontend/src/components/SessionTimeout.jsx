import React, { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

const WARNING_BEFORE_MS = 60 * 1000 // show warning 1 minute before logout
const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

export default function SessionTimeout() {
  const { logout, isAuthenticated } = useAuth()
  const [showWarning, setShowWarning] = useState(false)
  const timeoutRef = useRef(null)
  const warningRef = useRef(null)
  // keep a stable ref to latest logout so the timeout callback never goes stale
  const logoutRef = useRef(logout)
  useEffect(() => { logoutRef.current = logout }, [logout])

  const getTimeoutMs = () => {
    const minutes = Number(localStorage.getItem('sessionTimeoutMinutes') || 15)
    return Math.max(5, minutes) * 60 * 1000
  }

  const resetTimer = useCallback(() => {
    if (!isAuthenticated) return
    clearTimeout(timeoutRef.current)
    clearTimeout(warningRef.current)
    setShowWarning(false)

    const total = getTimeoutMs()
    const warnAt = Math.max(total - WARNING_BEFORE_MS, 1000)

    warningRef.current = setTimeout(() => setShowWarning(true), warnAt)
    timeoutRef.current = setTimeout(() => {
      logoutRef.current()
      toast.error('Su sesión ha expirado por inactividad.')
    }, total)
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      clearTimeout(timeoutRef.current)
      clearTimeout(warningRef.current)
      setShowWarning(false)
      return
    }

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }))
    resetTimer()

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, resetTimer))
      clearTimeout(timeoutRef.current)
      clearTimeout(warningRef.current)
    }
  }, [isAuthenticated, resetTimer])

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
            onClick={() => { setShowWarning(false); logoutRef.current() }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
          <button
            onClick={resetTimer}
            className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Continuar sesión
          </button>
        </div>
      </div>
    </div>
  )
}
