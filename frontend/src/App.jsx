import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import appRoutes from './config/routes'

function ProtectedRoute({ children, allowedRoles = [] }) {
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

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />
  }

  return <Layout>{children}</Layout>
}

export default function App() {
  return (
    <Routes>
      {appRoutes.map((route) => {
        const element = route.publicRoute ? route.element : (
          <ProtectedRoute allowedRoles={route.allowedRoles || []}>
            {route.element}
          </ProtectedRoute>
        )

        return <Route key={route.path} path={route.path} element={element} />
      })}
    </Routes>
  )
}
