export const moduleDefinitions = [
  {
    id: 'inventory',
    label: 'Inventario',
    description: 'Gestión de productos, stock, ubicaciones y catálogos de referencia.',
    roles: ['admin', 'almacenista'],
    primaryRoute: '/products',
    pages: [
      { label: 'Inventario', path: '/inventory', description: 'Stock, cantidades y estado de cada artículo' },
      { label: 'Productos', path: '/products', description: 'Lista y gestión del inventario' },
      { label: 'Catálogos de productos', path: '/product-catalogs', description: 'Marcas, modelos, estados y unidades' },
      { label: 'Categorías', path: '/categories', description: 'Clasificación de productos' },
      { label: 'Ubicaciones', path: '/locations', description: 'Almacenes y estantes físicos' },
    ],
  },
  {
    id: 'operations',
    label: 'Operaciones',
    description: 'Órdenes de servicio, reparaciones, instalaciones y despachos.',
    roles: ['admin', 'almacenista', 'tecnico'],
    primaryRoute: '/service-orders',
    pages: [
      { label: 'Órdenes de servicio', path: '/service-orders', description: 'Equipos en taller para reparación, instalación o mantenimiento' },
      { label: 'Despachos', path: '/despachos', description: 'Salidas de materiales' },
      { label: 'Recepción', path: '/reception', description: 'Entrada de mercancías' },
    ],
  },
  {
    id: 'administration',
    label: 'Administración',
    description: 'Usuarios, configuración y administración del sistema.',
    roles: ['admin'],
    primaryRoute: '/users',
    pages: [
      { label: 'Usuarios', path: '/users', description: 'Gestión de cuentas y roles' },
    ],
  },
  {
    id: 'reports',
    label: 'Reportes',
    description: 'Consultas y reportes operativos del negocio.',
    roles: ['admin', 'almacenista'],
    primaryRoute: '/products',
    pages: [
      { label: 'Inventario', path: '/products', description: 'Reporte de stock actual' },
      { label: 'Órdenes de servicio', path: '/service-orders', description: 'Reporte de órdenes' },
    ],
  },
]

export function getVisibleModules(user) {
  if (!user) return []
  return moduleDefinitions.filter((module) => module.roles.includes(user.role))
}
