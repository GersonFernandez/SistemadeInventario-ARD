import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { solicitanteApi } from '../services/workOrderApi'
import { inventoryApi } from '../services/inventoryApi'
import { useAuth } from '../context/AuthContext'
import RemoteEntityPicker from '../components/RemoteEntityPicker'
import { DOMINICAN_CEDULA_ERROR, formatDominicanCedula, isValidDominicanCedula } from '../utils/dominicanCedula'
import { hasPermission } from '../utils/permissions'

const emptyForm = {
  name: '',
  rank: '',
  unit: '',
  agent_id: '',
  notes: '',
  is_active: true,
}

export default function SolicitanteFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = hasPermission(user, 'solicitantes.manage', ['admin', 'almacenista'])
  const isEditing = Boolean(id)

  const [loading, setLoading] = useState(isEditing)
  const [saving, setSaving] = useState(false)
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [cedulaError, setCedulaError] = useState('')

  useEffect(() => {
    if (!canManage) {
      toast.error('No tienes permisos para gestionar solicitantes')
      navigate('/solicitantes')
      return
    }

    if (isEditing) {
      loadSolicitante()
    }
  }, [id, canManage])

  const selectedLocationLabel = useMemo(() => {
    if (!selectedUnit) return 'Sin unidad asignada'
    return selectedUnit.breadcrumb || selectedUnit.name || 'Sin unidad asignada'
  }, [selectedUnit])

  const searchLocations = async (query) => {
    const { data } = await inventoryApi.getLocations({
      search: query,
      page_size: 50,
    })
    const rows = data.results || data || []
    return rows.sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
  }

  const loadSolicitante = async () => {
    try {
      const { data } = await solicitanteApi.get(id)
      setForm({
        name: data.name || '',
        rank: data.rank || '',
        unit: data.unit ? String(data.unit) : '',
        agent_id: data.agent_id || '',
        notes: data.notes || '',
        is_active: Boolean(data.is_active),
      })
      if (data.unit) {
        setSelectedUnit({
          id: data.unit,
          name: data.unit_name || `Unidad ${data.unit}`,
          breadcrumb: data.unit_name || null,
        })
      }
    } catch {
      toast.error('No se pudo cargar el solicitante')
      navigate('/solicitantes')
    } finally {
      setLoading(false)
    }
  }

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    if (!form.name.trim()) {
      toast.error('Debe indicar el nombre del solicitante')
      return false
    }

    if (form.name.trim().length < 3) {
      toast.error('El nombre debe tener al menos 3 caracteres')
      return false
    }

    if (form.agent_id && !isValidDominicanCedula(form.agent_id)) {
      setCedulaError(DOMINICAN_CEDULA_ERROR)
      toast.error(DOMINICAN_CEDULA_ERROR)
      return false
    }

    if (form.rank.trim().length > 50) {
      toast.error('El rango no puede superar 50 caracteres')
      return false
    }

    return true
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        rank: form.rank.trim(),
        unit: form.unit ? Number(form.unit) : null,
        agent_id: form.agent_id.trim(),
        notes: form.notes.trim(),
      }

      if (!payload.unit) {
        delete payload.unit
      }

      if (isEditing) {
        payload.is_active = form.is_active
        await solicitanteApi.update(id, payload)
        toast.success('Solicitante actualizado')
      } else {
        await solicitanteApi.create(payload)
        toast.success('Solicitante creado')
      }

      navigate('/solicitantes')
    } catch (error) {
      const apiData = error.response?.data
      const apiCedulaError = apiData?.agent_id?.[0]
      if (apiCedulaError) setCedulaError(apiCedulaError)
      const message =
        apiCedulaError || apiData?.detail ||
        (apiData ? Object.values(apiData).flat().join(', ') : null) ||
        'No se pudo guardar el solicitante'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  if (!canManage) {
    return null
  }

  if (loading) {
    return <p className="text-gray-600">Cargando solicitante...</p>
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-brand-100 bg-gradient-to-r from-brand-900 to-brand-700 p-6 text-white shadow-sm">
        <p className="text-xs uppercase tracking-[0.2em] text-brand-100">Gestión de solicitantes</p>
        <h2 className="mt-2 text-3xl font-bold">{isEditing ? 'Editar solicitante' : 'Nuevo solicitante'}</h2>
        <p className="mt-2 max-w-3xl text-sm text-brand-100">
          Complete los datos de identificación del solicitante que recibirá mercancía en despachos.
          Esta información quedará disponible para reutilizarse en futuras entregas.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:items-start">
        <section className="space-y-6 xl:col-span-2">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Identificación</h3>
            <p className="mt-1 text-xs text-gray-500">Datos principales del personal o dependencia.</p>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Nombre completo</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Ej: José Rafael Pérez"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Rango / Grado</label>
                <input
                  type="text"
                  value={form.rank}
                  onChange={(e) => updateField('rank', e.target.value)}
                  placeholder="Ej: Teniente de Navío"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Cédula dominicana</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={13}
                  value={form.agent_id}
                  onChange={(e) => {
                    updateField('agent_id', formatDominicanCedula(e.target.value))
                    setCedulaError('')
                  }}
                  onBlur={() => form.agent_id && !isValidDominicanCedula(form.agent_id) && setCedulaError(DOMINICAN_CEDULA_ERROR)}
                  placeholder="000-0000000-0"
                  aria-invalid={Boolean(cedulaError)}
                  aria-describedby={cedulaError ? 'solicitante-cedula-error' : undefined}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 ${cedulaError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-300 focus:border-brand-700 focus:ring-brand-100'}`}
                />
                {cedulaError && <p id="solicitante-cedula-error" className="mt-1.5 text-sm text-red-600">{cedulaError}</p>}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Asignación</h3>
            <p className="mt-1 text-xs text-gray-500">Vincule el solicitante a su unidad o base, si aplica.</p>

            <div className="mt-5 grid grid-cols-1 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700">Unidad / Base</label>
                <div className="mt-1">
                  <RemoteEntityPicker
                    value={selectedUnit}
                    onChange={(loc) => {
                      setSelectedUnit(loc)
                      updateField('unit', loc ? String(loc.id) : '')
                    }}
                    fetchOptions={searchLocations}
                    getLabel={(loc) => loc?.breadcrumb || loc?.name || '—'}
                    getMeta={(loc) => loc?.codigo ? `Código: ${loc.codigo}` : 'Sin código'}
                    placeholder="Buscar unidad/base por nombre o código..."
                    minChars={1}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Notas operativas</label>
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Ej: Retira consumibles para radar de cubierta..."
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:border-brand-700 focus:outline-none focus:ring-brand-700"
                />
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">Resumen</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Solicitante</dt>
                <dd className="font-medium text-gray-900">{form.name.trim() || 'Sin nombre'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Rango</dt>
                <dd className="font-medium text-gray-900">{form.rank.trim() || 'No indicado'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Unidad</dt>
                <dd className="font-medium text-gray-900">{selectedLocationLabel}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Cédula dominicana</dt>
                <dd className="font-medium text-gray-900">{form.agent_id.trim() || 'No indicado'}</dd>
              </div>
            </dl>
          </div>

          {isEditing && (
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateField('is_active', e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-700 focus:ring-brand-700"
                />
                <span className="text-sm text-gray-700">Solicitante activo</span>
              </label>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="space-y-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-md bg-brand-800 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
              >
                {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear solicitante'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/solicitantes')}
                className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        </aside>
      </form>
    </div>
  )
}
