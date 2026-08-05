import {
  HomeIcon,
  CubeIcon,
  ClipboardDocumentListIcon,
  CircleStackIcon,
  MapPinIcon,
  UsersIcon,
  InboxArrowDownIcon,
  TruckIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

export const navigationItems = [
  { label: 'Inicio',                  path: '/',               icon: HomeIcon,                 allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { label: 'Inventario',             path: '/inventory',      icon: ChartBarIcon,             allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { label: 'Productos',              path: '/products',       icon: CubeIcon,                 allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { label: 'Órdenes de servicio',     path: '/service-orders', icon: ClipboardDocumentListIcon, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { label: 'Recepción',              path: '/reception',      icon: InboxArrowDownIcon,       allowedRoles: ['admin', 'almacenista'] },
  { label: 'Despachos',              path: '/despachos',      icon: TruckIcon,                allowedRoles: ['admin', 'almacenista'] },
  { label: 'Solicitantes',           path: '/solicitantes',   icon: UsersIcon,                allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { label: 'Catálogos',              path: '/product-catalogs', icon: CircleStackIcon,          allowedRoles: ['admin', 'almacenista'] },
  { label: 'Ubicaciones',            path: '/locations',      icon: MapPinIcon,               allowedRoles: ['admin', 'almacenista'] },
  { label: 'Usuarios',               path: '/users',          icon: UsersIcon,                allowedRoles: ['admin'], adminOnly: true },
]

export function getVisibleNavigationItems(user) {
  if (!user) return []
  return navigationItems.filter((item) => {
    if (item.adminOnly && user.role !== 'admin') return false
    return item.allowedRoles.includes(user.role)
  })
}
