import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  EyeIcon,
  EyeSlashIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  ClipboardDocumentListIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'

const features = [
  { icon: CubeIcon,                    label: 'Control de inventario',        desc: 'Stock, repuestos y herramientas' },
  { icon: WrenchScrewdriverIcon,       label: 'Órdenes de servicio',          desc: 'Reparaciones e instalaciones' },
  { icon: ClipboardDocumentListIcon,   label: 'Trazabilidad completa',        desc: 'Despachos y recepciones' },
  { icon: ChartBarIcon,                label: 'Reportes operativos',          desc: 'PDF y Excel en tiempo real' },
]

export default function LoginPage() {
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPass, setShowPass]         = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors]             = useState({})
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
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[55%] bg-gradient-to-br from-brand-900 to-brand-800 flex-col justify-between p-12 text-white">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-sm font-bold tracking-tight">
            ARD
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">Taller de Electrónica</p>
            <p className="text-xs text-brand-100 leading-tight">Armada de República Dominicana</p>
          </div>
        </div>

        {/* Main copy */}
        <div className="max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">
            Sistema de Gestión<br />
            <span className="text-brand-100">Operativa del Taller</span>
          </h1>
          <p className="mt-4 text-base text-brand-100 leading-relaxed">
            Plataforma integral para el control de inventario, servicios técnicos
            y trazabilidad de equipos electrónicos de la flota naval.
          </p>

          {/* Feature grid */}
          <div className="mt-10 grid grid-cols-2 gap-4">
            {features.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 rounded-xl bg-white/5 p-4 backdrop-blur-sm border border-white/10">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-700/60">
                  <Icon className="h-5 w-5 text-brand-100" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="text-xs text-blue-200 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-blue-200">
          Uso exclusivo del personal autorizado · Acceso restringido
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="mb-8 text-center lg:hidden">
            <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-800 text-sm font-bold text-white">
              ARD
            </div>
            <p className="text-lg font-bold text-brand-900">Taller de Electrónica</p>
            <p className="text-sm text-gray-500">Armada de República Dominicana</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900">Iniciar sesión</h2>
            <p className="mt-1 text-sm text-gray-500">Ingrese sus credenciales de acceso.</p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
              <div>
                <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Correo electrónico
                </label>
                <input
                  id="email" type="email" autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: undefined })) }}
                  placeholder="nombre@armada.mil.do"
                  className={`mt-1.5 block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                    errors.email ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'
                  }`}
                />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>

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
                    onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: undefined })) }}
                    placeholder="••••••••"
                    className={`block w-full rounded-lg border pr-10 px-3 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 ${
                      errors.password ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'
                    }`}
                  />
                  <button type="button" tabIndex={-1}
                    onClick={() => setShowPass((s) => !s)}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600">
                    {showPass ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
              </div>

              <button
                type="submit" disabled={isSubmitting}
                className="mt-2 w-full rounded-lg bg-brand-800 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Verificando...' : 'Ingresar al sistema'}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Si olvidó su contraseña, solicite asistencia al administrador del sistema.
          </p>
        </div>
      </div>
    </div>
  )
}