import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import appRoutes from './config/routes'
import { hasPermission } from './utils/permissions'

function ProtectedRoute({ children, allowedRoles = [], permissionKey }) {
  const { user, loading } = useAuth()
  const location = useLocation()

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

  if (user.must_change_password && location.pathname !== '/security') {
    return <Navigate to="/security" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  if (!hasPermission(user, permissionKey, allowedRoles)) {
    return <Navigate to="/" replace />
  }

  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      {appRoutes.map((route) => {
        const element = route.publicRoute ? route.element : (
          <ProtectedRoute allowedRoles={route.allowedRoles || []} permissionKey={route.permissionKey}>
            {route.element}
          </ProtectedRoute>
        )

        return <Route key={route.path} path={route.path} element={element} />
      })}
    </Routes>
  )
}
