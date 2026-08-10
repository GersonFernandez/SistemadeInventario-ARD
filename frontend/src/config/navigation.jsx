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
import { hasPermission } from '../utils/permissions'

export const navigationItems = [
  { label: 'Inicio',                  path: '/',                  icon: HomeIcon,                   allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { label: 'Inventario',              path: '/inventory',         icon: ChartBarIcon,               allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'inventory.view' },
  { label: 'Productos',               path: '/products',          icon: CubeIcon,                   allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'products.view' },
  { label: 'Órdenes de servicio',     path: '/service-orders',    icon: ClipboardDocumentListIcon,  allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'service_orders.view' },
  { label: 'Recepción',               path: '/reception',         icon: InboxArrowDownIcon,         allowedRoles: ['admin', 'almacenista'], permissionKey: 'reception.view' },
  { label: 'Despachos',               path: '/despachos',         icon: TruckIcon,                  allowedRoles: ['admin', 'almacenista'], permissionKey: 'despachos.view' },
  { label: 'Solicitantes',            path: '/solicitantes',      icon: UsersIcon,                  allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'solicitantes.view' },
  { label: 'Catálogos',               path: '/product-catalogs',  icon: CircleStackIcon,            allowedRoles: ['admin', 'almacenista'], permissionKey: 'catalogs.view' },
  { label: 'Ubicaciones',             path: '/locations',         icon: MapPinIcon,                 allowedRoles: ['admin', 'almacenista'], permissionKey: 'locations.view' },
  { label: 'Usuarios',                path: '/users',             icon: UsersIcon,                  allowedRoles: ['admin'], adminOnly: true, permissionKey: 'users.manage' },
  { label: 'Roles y permisos',        path: '/roles-permissions', icon: UsersIcon,                  allowedRoles: ['admin'], adminOnly: true, permissionKey: 'roles.manage' },
]

export function getVisibleNavigationItems(user) {
  if (!user) return []
  return navigationItems.filter((item) => {
    if (item.adminOnly && user.role !== 'admin') return false
    return hasPermission(user, item.permissionKey, item.allowedRoles || [])
  })
}
