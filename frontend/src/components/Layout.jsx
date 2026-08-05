import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ArrowRightOnRectangleIcon } from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import SessionTimeout from './SessionTimeout'
import { getVisibleNavigationItems, navigationItems } from '../config/navigation'

const roleLabels = {
  admin: 'Administrador',
  almacenista: 'Encargado de Inventario',
  tecnico: 'Técnico Especialista',
}

function usePageTitle(pathname) {
  // find the best matching nav item for the current path
  const sorted = [...navigationItems].sort((a, b) => b.path.length - a.path.length)
  const match = sorted.find((item) => pathname === item.path || pathname.startsWith(item.path + '/'))
  return match?.label ?? 'Sistema de Inventario'
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const visibleNavigation = getVisibleNavigationItems(user)
  const pageTitle = usePageTitle(location.pathname)

  return (
    <div className="min-h-screen flex">
      <SessionTimeout />

      {/* ── Sidebar ── */}
      <aside className="w-64 bg-brand-900 text-white flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-brand-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-xs font-bold text-white">ARD</div>
            <div>
              <p className="text-sm font-bold leading-tight">Taller Electrónica</p>
              <p className="text-[11px] text-brand-300 leading-tight">Armada de República Dominicana</p>
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleNavigation.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/'))
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-brand-100 hover:bg-brand-800 hover:text-white'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${isActive ? 'text-white' : 'text-brand-300'}`} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-brand-800">
          <div className="mb-3 px-3">
            <p className="text-sm font-semibold text-white leading-tight">{user?.name}</p>
            <p className="text-xs text-brand-300 mt-0.5">{roleLabels[user?.role] ?? user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-brand-200 hover:bg-brand-800 hover:text-white transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <p className="text-sm font-semibold text-gray-800">{pageTitle}</p>
          <time className="text-xs text-gray-500">
            {new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
        </header>
        <main className="flex-1 p-8 bg-gray-50 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
