import React, { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadUser = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const { data } = await api.get('/auth/me/')
      setUser(data)
      if (data.session_timeout_minutes) {
        localStorage.setItem('sessionTimeoutMinutes', String(data.session_timeout_minutes))
      }
    } catch (error) {
      console.error('Failed to load user', error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login/', { email, password })
    localStorage.setItem('accessToken', data.access)
    localStorage.setItem('refreshToken', data.refresh)
    if (data.session_timeout_minutes) {
      localStorage.setItem('sessionTimeoutMinutes', String(data.session_timeout_minutes))
    }
    await loadUser()
    return data
  }

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken')
    if (refreshToken) {
      try {
        await api.post('/auth/logout/', { refresh: refreshToken })
      } catch (error) {
        console.error('Logout failed', error)
      }
    }
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('sessionTimeoutMinutes')
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
