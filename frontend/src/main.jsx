import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import SystemToaster from './components/SystemToaster'
import App from './App'
import './index.css'

const basename = import.meta.env.BASE_URL || '/'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter
      basename={basename}
      future={{ v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <App />
        <SystemToaster />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
