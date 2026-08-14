import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardDocumentListIcon,
  CubeIcon,
  TruckIcon,
  InboxArrowDownIcon,
  UsersIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  WrenchScrewdriverIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { inventoryApi } from '../services/inventoryApi'
import { serviceOrderApi } from '../services/serviceOrderApi'
import { despachoApi } from '../services/workOrderApi'
import { hasPermission } from '../utils/permissions'

const roleLabels = {
  admin: 'Administrador',
  almacenista: 'Encargado de Inventario',
  tecnico: 'Técnico Especialista Naval',
}

export default function AccessHubPage() {
  const { user } = useAuth()
  const isAdmin = hasPermission(user, 'users.manage', ['admin'])
  const canManageServiceOrders = hasPermission(user, 'service_orders.manage', ['admin', 'almacenista'])
  const canManageReception = hasPermission(user, 'reception.manage', ['admin', 'almacenista'])
  const canManageDespachos = hasPermission(user, 'despachos.manage', ['admin', 'almacenista'])
  const canViewInventory = hasPermission(user, 'inventory.view', ['admin', 'almacenista', 'tecnico'])
  const canViewServiceOrders = hasPermission(user, 'service_orders.view', ['admin', 'almacenista', 'tecnico'])
  const canViewReception = hasPermission(user, 'reception.view', ['admin', 'almacenista'])
  const canViewDespachos = hasPermission(user, 'despachos.view', ['admin', 'almacenista'])
  const canViewProducts = hasPermission(user, 'products.view', ['admin', 'almacenista', 'tecnico'])
  const canViewSolicitantes = hasPermission(user, 'solicitantes.view', ['admin', 'almacenista', 'tecnico'])

  const [stats, setStats]     = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const results = await Promise.allSettled([
          inventoryApi.getItems({ page_size: 1, is_active: 'true' }),
          inventoryApi.getCriticalItems({ page_size: 1, is_active: 'true' }),
          serviceOrderApi.getServiceOrders({ page_size: 1 }),
          serviceOrderApi.getServiceOrders({ status: 'en_proceso', page_size: 1 }),
          canViewDespachos ? despachoApi.getDespachos({ page_size: 1 }) : Promise.resolve(null),
        ])

        setStats({
          totalItems:     results[0].status === 'fulfilled' ? (results[0].value.data.count ?? results[0].value.data.length ?? 0) : '—',
          criticalItems:  results[1].status === 'fulfilled' ? (results[1].value.data.count ?? results[1].value.data.length ?? 0) : '—',
          totalOrders:    results[2].status === 'fulfilled' ? (results[2].value.data.count ?? results[2].value.data.length ?? 0) : '—',
          activeOrders:   results[3].status === 'fulfilled' ? (results[3].value.data.count ?? results[3].value.data.length ?? 0) : '—',
          totalDespachos: results[4].status === 'fulfilled' && results[4].value ? (results[4].value.data.count ?? results[4].value.data.length ?? 0) : '—',
        })
      } catch {
        setStats(null)
      } finally {
        setLoadingStats(false)
      }
    }
    fetchStats()
  }, [])

  const quickActions = [
    canManageServiceOrders && { label: 'Nueva orden de servicio', to: '/service-orders/new', icon: PlusIcon,           color: 'brand' },
    canManageReception && { label: 'Registrar recepción', to: '/reception/new', icon: InboxArrowDownIcon, color: 'emerald' },
    canManageDespachos && { label: 'Crear despacho', to: '/despachos/new', icon: TruckIcon,                  color: 'indigo' },
    canViewInventory && { label: 'Ver inventario', to: '/inventory', icon: ChartBarIcon, color: 'amber' },
  ].filter(Boolean)

  const moduleLinks = [
    canViewInventory && { label: 'Inventario', desc: 'Stock, cantidades y estado del inventario', to: '/inventory', icon: ChartBarIcon },
    canViewServiceOrders && { label: 'Órdenes de servicio', desc: 'Reparaciones, instalaciones y mantenimientos', to: '/service-orders', icon: WrenchScrewdriverIcon },
    canViewReception && { label: 'Recepción', desc: 'Entradas de mercancía con comprobante y firmas', to: '/reception', icon: InboxArrowDownIcon },
    canViewDespachos && { label: 'Despachos', desc: 'Salidas con trazabilidad por solicitante', to: '/despachos', icon: TruckIcon },
    canViewProducts && { label: 'Productos', desc: 'Catálogo técnico de productos base', to: '/products', icon: CubeIcon },
    canViewSolicitantes && { label: 'Solicitantes', desc: 'Registro de personal y unidades solicitantes', to: '/solicitantes', icon: UsersIcon },
    isAdmin && { label: 'Usuarios', desc: 'Gestión de cuentas, roles y contraseñas', to: '/users', icon: UsersIcon },
  ].filter(Boolean)

  const statCards = [
    { label: 'Artículos en inventario', value: stats?.totalItems,   icon: CubeIcon,                  color: 'brand'   },
    { label: 'Stock crítico',           value: stats?.criticalItems, icon: ExclamationTriangleIcon,   color: 'red',    to: '/inventory' },
    { label: 'Órdenes activas',         value: stats?.activeOrders, icon: WrenchScrewdriverIcon,     color: 'amber',  to: '/service-orders?status=en_proceso' },
    canViewDespachos && { label: 'Despachos totales', value: stats?.totalDespachos, icon: TruckIcon, color: 'indigo', to: '/despachos' },
  ].filter(Boolean)

  return (
    <div className="space-y-8">

      {/* ── Welcome banner ── */}
      <section className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 p-8 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-200">Taller de Electrónica · ARD</p>
            <h2 className="mt-2 text-3xl font-bold">
              Bienvenido, {user?.name?.split(' ')[0] === user?.name?.split(' ')[0].toUpperCase()
              ? user?.name?.split(' ').slice(1).join(' ') || user?.name
              : user?.name?.split(' ')[0] ?? 'operador'}
            </h2>
            <p className="mt-2 text-brand-100 text-sm">
              {roleLabels[user?.role] ?? user?.role} · Sistema de gestión de inventario y servicios
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => {
              const Icon = a.icon
              return (
                <Link
                  key={a.to}
                  to={a.to}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/20 transition"
                >
                  <Icon className="h-4 w-4" />
                  {a.label}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Stat cards ── */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon
          const palettes = {
            brand:   'bg-brand-50 border-brand-100 text-brand-800',
            red:     'bg-red-50 border-red-100 text-red-800',
            amber:   'bg-amber-50 border-amber-100 text-amber-800',
            indigo:  'bg-indigo-50 border-indigo-100 text-indigo-800',
          }
          const iconPalettes = {
            brand: 'text-brand-500', red: 'text-red-400', amber: 'text-amber-500', indigo: 'text-indigo-400',
          }
          const cls = palettes[card.color] || palettes.brand
          const iCls = iconPalettes[card.color] || iconPalettes.brand
          const inner = (
            <div className={`rounded-2xl border p-5 shadow-sm ${cls} ${card.to ? 'cursor-pointer hover:opacity-80 transition' : ''}`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{card.label}</p>
                <Icon className={`h-5 w-5 ${iCls}`} />
              </div>
              <p className="mt-3 text-3xl font-bold">
                {loadingStats ? <span className="text-xl opacity-50">...</span> : card.value}
              </p>
            </div>
          )
          return card.to ? <Link key={card.label} to={card.to}>{inner}</Link> : <div key={card.label}>{inner}</div>
        })}
      </section>

      {/* ── Module grid ── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Módulos disponibles</h3>
          <Link to="/catalogs" className="flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-900">
            Ver catálogos <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {moduleLinks.map((m) => {
            const Icon = m.icon
            return (
              <Link
                key={m.to}
                to={m.to}
                className="group flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-100">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{m.label}</p>
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{m.desc}</p>
                </div>
                <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-gray-300 group-hover:text-brand-500 self-center ml-auto" />
              </Link>
            )
          })}
        </div>
      </section>

    </div>
  )
}