import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import AccessHubPage from './pages/AccessHubPage'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import LocationsPage from './pages/LocationsPage'
import ProductCatalogsPage from './pages/ProductCatalogsPage'
import RepairsPage from './pages/RepairsPage'
import InstallationsPage from './pages/InstallationsPage'
import ReceptionPage from './pages/ReceptionPage'
import ItemDetailPage from './pages/ItemDetailPage'
import ItemFormPage from './pages/ItemFormPage'
import PrintLabelPage from './pages/PrintLabelPage'
import DespachosPage from './pages/DespachosPage'
import DespachoFormPage from './pages/DespachoFormPage'
import DespachoDetailPage from './pages/DespachoDetailPage'
import ServiceOrdersPage from './pages/ServiceOrdersPage'
import ServiceOrderDetailPage from './pages/ServiceOrderDetailPage'
import SolicitantesPage from './pages/SolicitantesPage'
import SolicitanteFormPage from './pages/SolicitanteFormPage'
import UsersPage from './pages/UsersPage'
import UserFormPage from './pages/UserFormPage'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Cargando...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AccessHubPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <ProductsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products/new"
        element={
          <ProtectedRoute>
            <ItemFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products/:id"
        element={
          <ProtectedRoute>
            <ItemDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products/:id/edit"
        element={
          <ProtectedRoute>
            <ItemFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products/:id/print-label"
        element={
          <ProtectedRoute>
            <PrintLabelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories"
        element={
          <ProtectedRoute>
            <CategoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/locations"
        element={
          <ProtectedRoute>
            <LocationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/product-catalogs"
        element={
          <ProtectedRoute>
            <ProductCatalogsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/repairs"
        element={
          <ProtectedRoute>
            <RepairsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/installations"
        element={
          <ProtectedRoute>
            <InstallationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception"
        element={
          <ProtectedRoute>
            <ReceptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/despachos"
        element={
          <ProtectedRoute>
            <DespachosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/despachos/new"
        element={
          <ProtectedRoute>
            <DespachoFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/despachos/:id"
        element={
          <ProtectedRoute>
            <DespachoDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workorders"
        element={<Navigate to="/despachos" replace />}
      />
      <Route
        path="/workorders/new"
        element={<Navigate to="/despachos/new" replace />}
      />
      <Route
        path="/workorders/:id"
        element={
          <ProtectedRoute>
            <DespachoDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-orders"
        element={
          <ProtectedRoute>
            <ServiceOrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/service-orders/:id"
        element={
          <ProtectedRoute>
            <ServiceOrderDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/solicitantes"
        element={
          <ProtectedRoute>
            <SolicitantesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/solicitantes/new"
        element={
          <ProtectedRoute>
            <SolicitanteFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/solicitantes/:id/edit"
        element={
          <ProtectedRoute>
            <SolicitanteFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute adminOnly>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/new"
        element={
          <ProtectedRoute adminOnly>
            <UserFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:id/edit"
        element={
          <ProtectedRoute adminOnly>
            <UserFormPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
