import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { userApi } from '../services/userApi'
import { useAuth } from '../context/AuthContext'

export default function SecurityPage() {
  const navigate = useNavigate()
  const { user, refreshUser } = useAuth()
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await userApi.changeMyPassword(form)
      await refreshUser()
      toast.success('Contraseña actualizada. Revisa tu correo para confirmación.')
      setForm({ current_password: '', new_password: '', confirm_new_password: '' })
      navigate('/', { replace: true })
    } catch (error) {
      const data = error.response?.data
      const message = data?.detail || Object.values(data || {}).flat().join(', ') || 'No se pudo cambiar la contraseña.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Seguridad</h2>
        <p className="mt-1 text-sm text-gray-600">
          {user?.must_change_password
            ? 'Debe reemplazar la contraseña temporal antes de continuar.'
            : 'Cambia tu contraseña y mantén tu cuenta protegida.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Contraseña actual</label>
          <input
            type="password"
            required
            value={form.current_password}
            onChange={(e) => setForm({ ...form, current_password: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Nueva contraseña</label>
          <input
            type="password"
            required
            value={form.new_password}
            onChange={(e) => setForm({ ...form, new_password: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Confirmar nueva contraseña</label>
          <input
            type="password"
            required
            value={form.confirm_new_password}
            onChange={(e) => setForm({ ...form, confirm_new_password: e.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Cambiar contraseña'}
        </button>
      </form>
    </div>
  )
}
