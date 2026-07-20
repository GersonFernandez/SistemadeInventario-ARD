import React from 'react'
import { Link } from 'react-router-dom'
import { UsersIcon, ShieldCheckIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'

export default function AccessHubPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const quickLinks = [
    { name: 'Órdenes de servicio', to: '/service-orders', description: 'Crear, asignar y cerrar servicios técnicos.' },
    { name: 'Reparaciones', to: '/repairs', description: 'Consultar órdenes de tipo reparación.' },
    { name: 'Instalaciones', to: '/installations', description: 'Consultar órdenes de tipo instalación.' },
    { name: 'Recepción de mercancías', to: '/reception', description: 'Registrar entradas y ver el inventario recibido.' },
    { name: 'Productos', to: '/products', description: 'Gestionar catálogo técnico de productos base.' },
    { name: 'Despacho de mercancías', to: '/despachos', description: 'Entregar mercancía recibida en almacén con trazabilidad.' },
    { name: 'Ubicaciones', to: '/locations', description: 'Organizar ubicaciones y dependencias.' },
  ]

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-brand-100 bg-gradient-to-r from-brand-900 to-brand-700 p-8 text-white shadow-sm">
        <p className="text-sm uppercase tracking-widest text-brand-100">Panel del taller</p>
        <h2 className="mt-2 text-3xl font-bold">Sistema de gestión para reparaciones e inventario</h2>
        <p className="mt-3 max-w-2xl text-brand-100">
          Controla equipos nuevos y usados, asigna servicios técnicos y administra usuarios
          con trazabilidad desde almacén hasta la ejecución del trabajo.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <LockClosedIcon className="h-7 w-7 text-brand-800" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Autenticación</h3>
          <p className="mt-2 text-sm text-gray-600">
            Sesiones con JWT, cierre de sesión seguro y expiración de inactividad configurable.
          </p>
        </article>

        <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <ShieldCheckIcon className="h-7 w-7 text-brand-800" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Control por rol</h3>
          <p className="mt-2 text-sm text-gray-600">
            Visualización y permisos guiados por rol para proteger funciones administrativas.
          </p>
        </article>

        <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <UsersIcon className="h-7 w-7 text-brand-800" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Gestión de usuarios</h3>
          <p className="mt-2 text-sm text-gray-600">
            Alta, edición, desactivación y restablecimiento de contraseña para cuentas del sistema.
          </p>
        </article>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Acción principal</h3>
        {isAdmin ? (
          <div className="mt-3">
            <p className="text-sm text-gray-600">Como administrador, puedes gestionar usuarios del sistema.</p>
            <Link
              to="/users"
              className="mt-4 inline-flex rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
            >
              Ir a usuarios
            </Link>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">
            Tu cuenta tiene acceso operativo. Si necesitas cambios de usuarios, solicita apoyo de un administrador.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">Accesos rápidos</h3>
        <p className="mt-1 text-sm text-gray-600">Abre cualquier pantalla operativa desde aquí.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="rounded-md border border-gray-200 bg-gray-50 p-4 transition hover:border-brand-300 hover:bg-brand-50"
            >
              <p className="text-sm font-semibold text-gray-900">{link.name}</p>
              <p className="mt-1 text-xs text-gray-600">{link.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
