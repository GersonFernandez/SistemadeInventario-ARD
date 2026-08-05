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

const appRoutes = [
  { path: '/login', element: <LoginPage />, publicRoute: true },
  { path: '/', element: <AccessHubPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '/products', element: <ProductsPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '/inventory', element: <InventoryPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '/products/:id', element: <ItemDetailPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '/products/:id/edit', element: <ItemFormPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/products/:id/print-label', element: <PrintLabelPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/categories', element: <CategoriesPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/locations', element: <LocationsPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/catalogs', element: <CatalogsPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/product-catalogs', element: <ProductCatalogsPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/reception', element: <ReceptionPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/reception/new', element: <ReceptionFormPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/despachos', element: <DespachosPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/despachos/new', element: <DespachoFormPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/despachos/:id', element: <DespachoDetailPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/service-orders', element: <ServiceOrdersPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '/service-orders/new', element: <ServiceOrderFormPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/service-orders/:id', element: <ServiceOrderDetailPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '/solicitantes', element: <SolicitantesPage />, allowedRoles: ['admin', 'almacenista', 'tecnico'] },
  { path: '/solicitantes/new', element: <SolicitanteFormPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/solicitantes/:id/edit', element: <SolicitanteFormPage />, allowedRoles: ['admin', 'almacenista'] },
  { path: '/users', element: <UsersPage />, allowedRoles: ['admin'] },
  { path: '/users/new', element: <UserFormPage />, allowedRoles: ['admin'] },
  { path: '/users/:id/edit', element: <UserFormPage />, allowedRoles: ['admin'] },
  { path: '*', element: <Navigate to="/" replace />, publicRoute: true },
]

export default appRoutes
