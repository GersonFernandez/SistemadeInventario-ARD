import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { EyeIcon, EyeSlashIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPass, setShowPass]     = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors]         = useState({})
  const { login } = useAuth()
  const navigate = useNavigate()

  const validate = () => {
    const e = {}
    if (!email.trim())    e.email    = 'El correo es obligatorio'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Formato de correo inválido'
    if (!password)        e.password = 'La contraseña es obligatoria'
    else if (password.length < 6) e.password = 'Mínimo 6 caracteres'
    return e
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const fieldErrors = validate()
    if (Object.keys(fieldErrors).length) { setErrors(fieldErrors); return }
    setErrors({})
    setIsSubmitting(true)
    try {
      await login(email.trim(), password)
      toast.success('Bienvenido al sistema')
      navigate('/')
    } catch (error) {
      const message = error.response?.data?.detail || 'Credenciales inválidas. Verifique su correo y contraseña.'
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex-col items-center justify-center p-12 text-white">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <ShieldCheckIcon className="h-9 w-9 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold">Taller de Electrónica</h1>
          <p className="mt-2 text-lg font-medium text-brand-200">Armada de República Dominicana</p>
          <p className="mt-6 text-sm text-brand-100 leading-relaxed">
            Sistema de gestión de inventario, órdenes de servicio y trazabilidad operativa
            para el taller de electrónica de la flota.
          </p>
          <div className="mt-10 flex justify-center gap-6 text-xs text-brand-300">
            <span>Acceso seguro con JWT</span>
            <span>·</span>
            <span>Sesión de 15 minutos</span>
            <span>·</span>
            <span>Control por rol</span>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile brand */}
          <div className="mb-8 text-center lg:hidden">
            <p className="text-xl font-bold text-brand-900">Taller de Electrónica</p>
            <p className="text-sm text-gray-500">Armada de República Dominicana</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-gray-500">Ingrese sus credenciales de acceso al sistema.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((prev) => ({ ...prev, email: undefined })) }}
                  className={`mt-1.5 block w-full rounded-md border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                    errors.email
                      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                      : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'
                  }`}
                  placeholder="nombre@armada.mil.do"
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Contraseña
                </label>
                <div className="relative mt-1.5">
                  <input
                    id="password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setErrors((prev) => ({ ...prev, password: undefined })) }}
                    className={`block w-full rounded-md border pr-10 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                      errors.password
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
                        : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 w-full rounded-md bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Verificando...' : 'Ingresar al sistema'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Acceso restringido al personal autorizado de la Armada RD.
            Si olvidó su contraseña, solicite asistencia al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  )
}