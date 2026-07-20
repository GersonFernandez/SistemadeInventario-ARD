import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { productApi } from '../services/productApi'

export default function ProductCatalogsPage() {
  const [brands, setBrands] = useState([])
  const [models, setModels] = useState([])
  const [states, setStates] = useState([])
  const [brandForm, setBrandForm] = useState({ name: '', description: '' })
  const [modelForm, setModelForm] = useState({ brand: '', name: '', description: '' })
  const [stateForm, setStateForm] = useState({ code: '', name: '', description: '' })

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    try {
      const [b, m, s] = await Promise.all([
        productApi.getBrands(),
        productApi.getProductModels(),
        productApi.getProductStates(),
      ])
      setBrands(b.data.results || b.data)
      setModels(m.data.results || m.data)
      setStates(s.data.results || s.data)
    } catch {
      toast.error('No se pudo cargar catálogos de productos')
    }
  }

  const createBrand = async (e) => {
    e.preventDefault()
    try {
      await productApi.createBrand(brandForm)
      setBrandForm({ name: '', description: '' })
      toast.success('Marca creada')
      loadAll()
    } catch {
      toast.error('No se pudo crear la marca')
    }
  }

  const createModel = async (e) => {
    e.preventDefault()
    try {
      await productApi.createProductModel(modelForm)
      setModelForm({ brand: '', name: '', description: '' })
      toast.success('Modelo creado')
      loadAll()
    } catch {
      toast.error('No se pudo crear el modelo')
    }
  }

  const createState = async (e) => {
    e.preventDefault()
    try {
      await productApi.createProductState(stateForm)
      setStateForm({ code: '', name: '', description: '' })
      toast.success('Estado creado')
      loadAll()
    } catch {
      toast.error('No se pudo crear el estado')
    }
  }

  const disableEntity = async (type, id) => {
    try {
      if (type === 'brand') await productApi.deleteBrand(id)
      if (type === 'model') await productApi.deleteProductModel(id)
      if (type === 'state') await productApi.deleteProductState(id)
      toast.success('Registro deshabilitado')
      loadAll()
    } catch {
      toast.error('No se pudo deshabilitar')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Catálogos de Productos</h2>
        <p className="mt-1 text-sm text-gray-600">Gestión de marcas, modelos y estados.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form onSubmit={createBrand} className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="font-semibold text-gray-900">Nueva Marca</h3>
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Nombre" value={brandForm.name} onChange={(e) => setBrandForm({ ...brandForm, name: e.target.value })} required />
          <textarea className="w-full rounded border px-3 py-2 text-sm" placeholder="Descripción" value={brandForm.description} onChange={(e) => setBrandForm({ ...brandForm, description: e.target.value })} rows={2} />
          <button className="rounded bg-brand-800 px-3 py-2 text-sm text-white">Agregar</button>
        </form>

        <form onSubmit={createModel} className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="font-semibold text-gray-900">Nuevo Modelo</h3>
          <select className="w-full rounded border px-3 py-2 text-sm" value={modelForm.brand} onChange={(e) => setModelForm({ ...modelForm, brand: e.target.value })} required>
            <option value="">Seleccione marca</option>
            {brands.filter((b) => b.is_active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Nombre" value={modelForm.name} onChange={(e) => setModelForm({ ...modelForm, name: e.target.value })} required />
          <textarea className="w-full rounded border px-3 py-2 text-sm" placeholder="Descripción" value={modelForm.description} onChange={(e) => setModelForm({ ...modelForm, description: e.target.value })} rows={2} />
          <button className="rounded bg-brand-800 px-3 py-2 text-sm text-white">Agregar</button>
        </form>

        <form onSubmit={createState} className="rounded-lg border border-gray-200 bg-white p-4 space-y-2">
          <h3 className="font-semibold text-gray-900">Nuevo Estado</h3>
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Código (ej: instalado)" value={stateForm.code} onChange={(e) => setStateForm({ ...stateForm, code: e.target.value })} required />
          <input className="w-full rounded border px-3 py-2 text-sm" placeholder="Nombre" value={stateForm.name} onChange={(e) => setStateForm({ ...stateForm, name: e.target.value })} required />
          <textarea className="w-full rounded border px-3 py-2 text-sm" placeholder="Descripción" value={stateForm.description} onChange={(e) => setStateForm({ ...stateForm, description: e.target.value })} rows={2} />
          <button className="rounded bg-brand-800 px-3 py-2 text-sm text-white">Agregar</button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <CatalogTable title="Marcas" rows={brands} disable={(id) => disableEntity('brand', id)} />
        <CatalogTable title="Modelos" rows={models} disable={(id) => disableEntity('model', id)} subtitleKey="brand_name" />
        <CatalogTable title="Estados" rows={states} disable={(id) => disableEntity('state', id)} subtitleKey="code" />
      </div>
    </div>
  )
}

function CatalogTable({ title, rows, disable, subtitleKey }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      <div className="space-y-2 max-h-80 overflow-auto">
        {rows.map((r) => (
          <div key={r.id} className="rounded border border-gray-200 p-2 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{r.name}</p>
              {subtitleKey && <p className="text-xs text-gray-500">{r[subtitleKey]}</p>}
              <p className={`text-xs ${r.is_active ? 'text-green-600' : 'text-gray-400'}`}>{r.is_active ? 'Activo' : 'Inactivo'}</p>
            </div>
            {r.is_active && (
              <button onClick={() => disable(r.id)} className="text-xs text-red-600 hover:text-red-800">Deshabilitar</button>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-500">Sin registros.</p>}
      </div>
    </div>
  )
}
