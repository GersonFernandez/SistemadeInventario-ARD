import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import InventoryPage from './pages/InventoryPage'
import ItemFormPage from './pages/ItemFormPage'
import ItemDetailPage from './pages/ItemDetailPage'
import DashboardPage from './pages/DashboardPage'
import DespachosPage from './pages/DespachosPage'
import DespachoFormPage from './pages/DespachoFormPage'
import DespachoDetailPage from './pages/DespachoDetailPage'
import AsignacionesActivasPage from './pages/AsignacionesActivasPage'
import AuditPage from './pages/AuditPage'
import UsersPage from './pages/UsersPage'
import UserFormPage from './pages/UserFormPage'
import CategoriesPage from './pages/CategoriesPage'
import LocationsPage from './pages/LocationsPage'
import PrintLabelPage from './pages/PrintLabelPage'
import SecurityPage from './pages/SecurityPage'
import SolicitantesPage from './pages/SolicitantesPage'
import ProductCatalogsPage from './pages/ProductCatalogsPage'
import RepairsPage from './pages/RepairsPage'
import InstallationsPage from './pages/InstallationsPage'
import ReceptionPage from './pages/ReceptionPage'
import BrandsMaintenancePage from './pages/BrandsMaintenancePage'
import ModelsMaintenancePage from './pages/ModelsMaintenancePage'

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

function Dashboard() {
  return <DashboardPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute>
            <InventoryPage />
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
        path="/inventory/new"
        element={
          <ProtectedRoute>
            <ItemFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/:id"
        element={
          <ProtectedRoute>
            <ItemDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory/:id/edit"
        element={
          <ProtectedRoute>
            <ItemFormPage />
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
        path="/inventory/:id/print-label"
        element={
          <ProtectedRoute>
            <PrintLabelPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security"
        element={
          <ProtectedRoute>
            <SecurityPage />
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
        path="/brands-maintenance"
        element={
          <ProtectedRoute>
            <BrandsMaintenancePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/models-maintenance"
        element={
          <ProtectedRoute>
            <ModelsMaintenancePage />
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
        path="/workorders"
        element={
          <ProtectedRoute>
            <DespachosPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workorders/new"
        element={
          <ProtectedRoute>
            <DespachoFormPage />
          </ProtectedRoute>
        }
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
        path="/workorders/:id/edit"
        element={
          <ProtectedRoute>
            <DespachoFormPage />
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
        path="/solicitantes"
        element={
          <ProtectedRoute>
            <SolicitantesPage />
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
        path="/asignaciones"
        element={
          <ProtectedRoute>
            <AsignacionesActivasPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/audit"
        element={
          <ProtectedRoute>
            <AuditPage />
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
    </Routes>
  )
}
