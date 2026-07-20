import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  HomeIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  WrenchScrewdriverIcon,
  ArrowUpTrayIcon,
  CircleStackIcon,
  MapPinIcon,
  TagIcon,
  UsersIcon,
  InboxArrowDownIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import SessionTimeout from './SessionTimeout'

const navigation = [
  { name: 'Inicio', href: '/', icon: HomeIcon },
  { name: 'Productos', href: '/products', icon: CubeIcon },
  { name: 'Órdenes de servicio', href: '/service-orders', icon: ClipboardDocumentListIcon },
  { name: 'Reparaciones', href: '/repairs', icon: WrenchScrewdriverIcon },
  { name: 'Instalaciones', href: '/installations', icon: ArrowUpTrayIcon },
  { name: 'Recepción de mercancías', href: '/reception', icon: InboxArrowDownIcon },
  { name: 'Despacho de mercancías', href: '/despachos', icon: ClipboardDocumentListIcon },
  { name: 'Solicitantes', href: '/solicitantes', icon: UsersIcon },
  { name: 'Catálogos', href: '/product-catalogs', icon: CircleStackIcon },
  { name: 'Ubicaciones', href: '/locations', icon: MapPinIcon },
  { name: 'Categorías', href: '/categories', icon: TagIcon },
  { name: 'Usuarios', href: '/users', icon: UsersIcon, adminOnly: true },
]

export default function Layout({ children }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isAdmin = user?.role === 'admin'
  return (
    <div className="min-h-screen flex">
      <SessionTimeout />
      <aside className="w-64 bg-brand-900 text-white flex flex-col">
        <div className="p-6 border-b border-brand-800">
          <h1 className="text-lg font-bold">Taller Electrónica</h1>
          <p className="text-xs text-gray-400">Armada RD</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navigation.map((item) => {
            if (item.adminOnly && !isAdmin) return null
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.href}
                className="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium hover:bg-brand-800 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {item.name}
                </div>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-brand-800">
          <div className="mb-3 text-sm">
            <p className="font-medium">{user?.name}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-brand-800 transition-colors"
          >
            <ArrowRightOnRectangleIcon className="h-5 w-5" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
          <div className="text-sm font-medium text-gray-700">Módulo de acceso y usuarios</div>
          <div className="text-sm text-gray-600">
            {new Date().toLocaleDateString('es-DO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </header>
        <main className="flex-1 p-8 bg-gray-50 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
