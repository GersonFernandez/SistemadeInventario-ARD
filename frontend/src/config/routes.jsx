import { Navigate } from 'react-router-dom'
import LoginPage from '../pages/LoginPage'
import AccessHubPage from '../pages/AccessHubPage'
import ProductsPage from '../pages/ProductsPage'
import InventoryPage from '../pages/InventoryPage'
import CategoriesPage from '../pages/CategoriesPage'
import LocationsPage from '../pages/LocationsPage'
import CatalogsPage from '../pages/CatalogsPage'
import ProductCatalogsPage from '../pages/ProductCatalogsPage'
import ReceptionPage from '../pages/ReceptionPage'
import ReceptionDetailPage from '../pages/ReceptionDetailPage'
import ItemDetailPage from '../pages/ItemDetailPage'
import ItemFormPage from '../pages/ItemFormPage'
import PrintLabelPage from '../pages/PrintLabelPage'
import DespachosPage from '../pages/DespachosPage'
import DespachoFormPage from '../pages/DespachoFormPage'
import DespachoDetailPage from '../pages/DespachoDetailPage'
import ServiceOrdersPage from '../pages/ServiceOrdersPage'
import ServiceOrderDetailPage from '../pages/ServiceOrderDetailPage'
import ServiceOrderFormPage from '../pages/ServiceOrderFormPage'
import SolicitantesPage from '../pages/SolicitantesPage'
import SolicitanteFormPage from '../pages/SolicitanteFormPage'
import UsersPage from '../pages/UsersPage'
import UserFormPage from '../pages/UserFormPage'
import ReceptionFormPage from '../pages/ReceptionFormPage'
import SecurityPage from '../pages/SecurityPage'
import RolePermissionsPage from '../pages/RolePermissionsPage'

const appRoutes = [
  { path: '/login', element: <LoginPage />, publicRoute: true },
  { path: '/', element: <AccessHubPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '/products', element: <ProductsPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'products.view' },
  { path: '/inventory', element: <InventoryPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'inventory.view' },
  { path: '/products/:id', element: <ItemDetailPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'products.view' },
  { path: '/products/:id/edit', element: <ItemFormPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'products.manage' },
  { path: '/products/:id/print-label', element: <PrintLabelPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'products.manage' },
  { path: '/categories', element: <CategoriesPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'catalogs.manage' },
  { path: '/locations', element: <LocationsPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'locations.view' },
  { path: '/catalogs', element: <CatalogsPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'catalogs.view' },
  { path: '/product-catalogs', element: <ProductCatalogsPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'catalogs.view' },
  { path: '/reception', element: <ReceptionPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'reception.view' },
  { path: '/reception/new', element: <ReceptionFormPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'reception.manage' },
  { path: '/reception/:id', element: <ReceptionDetailPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'reception.view' },
  { path: '/despachos', element: <DespachosPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'despachos.view' },
  { path: '/despachos/new', element: <DespachoFormPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'despachos.manage' },
  { path: '/despachos/:id', element: <DespachoDetailPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'despachos.view' },
  { path: '/service-orders', element: <ServiceOrdersPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'service_orders.view' },
  { path: '/service-orders/new', element: <ServiceOrderFormPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'service_orders.manage' },
  { path: '/service-orders/:id', element: <ServiceOrderDetailPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'service_orders.view' },
  { path: '/solicitantes', element: <SolicitantesPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'], permissionKey: 'solicitantes.view' },
  { path: '/solicitantes/new', element: <SolicitanteFormPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'solicitantes.manage' },
  { path: '/solicitantes/:id/edit', element: <SolicitanteFormPage />, allowedRoles: ['admin', 'almacenista'], permissionKey: 'solicitantes.manage' },
  { path: '/users', element: <UsersPage />, allowedRoles: ['admin'], permissionKey: 'users.manage' },
  { path: '/users/new', element: <UserFormPage />, allowedRoles: ['admin'], permissionKey: 'users.manage' },
  { path: '/users/:id/edit', element: <UserFormPage />, allowedRoles: ['admin'], permissionKey: 'users.manage' },
  { path: '/roles-permissions', element: <RolePermissionsPage />, allowedRoles: ['admin'], permissionKey: 'roles.manage' },
  { path: '/security', element: <SecurityPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '*', element: <Navigate to="/" replace />, publicRoute: true },
]

export default appRoutes
