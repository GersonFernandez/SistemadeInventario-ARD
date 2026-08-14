import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ExclamationTriangleIcon,
  WrenchIcon,
  ClipboardDocumentListIcon,
  CubeIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { inventoryApi } from '../services/inventoryApi'
import { dashboardApi } from '../services/dashboardApi'

const COLORS = ['#1e3a5f', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6']

export default function DashboardPage() {
  const [criticalItems, setCriticalItems] = useState([])
  const [overdueUnits, setOverdueUnits] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCriticalItems()
    fetchOverdueUnits()
    fetchStats()
  }, [])

  const fetchCriticalItems = async () => {
    try {
      const { data } = await inventoryApi.getCriticalItems()
      setCriticalItems(data.results || data)
    } catch (error) {
      console.error('Failed to fetch critical items', error)
    }
  }

  const fetchOverdueUnits = async () => {
    try {
      const { data } = await inventoryApi.getOverdueUnits()
      setOverdueUnits(data.results || data)
    } catch (error) {
      console.error('Failed to fetch overdue units', error)
    }
  }

  const fetchStats = async () => {
    try {
      const { data } = await dashboardApi.getStats()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch dashboard stats', error)
    } finally {
      setLoading(false)
    }
  }

  const workOrderStatusData = stats
    ? Object.entries(stats.work_orders.status_counts).map(([name, value]) => ({ name, value }))
    : []

  const despachosRecientes = stats?.work_orders?.recent || []

  const unitsData = stats
    ? [
        { name: 'Disponibles', value: stats.tools.available },
        { name: 'Asignadas', value: stats.tools.loaned },
        { name: 'Dadas de baja', value: stats.tools.disposed },
      ]
    : []

  const inventoryData = stats
    ? [
        { name: 'Stock normal', value: stats.inventory.total_items - stats.inventory.critical_items },
        { name: 'Stock crítico', value: stats.inventory.critical_items },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Inicio</h2>
        <p className="mt-2 text-gray-600">
          Sistema de Inventario del Taller de Electrónica.
        </p>
      </div>

      {loading || !stats ? (
        <p className="text-gray-600">Cargando estadísticas...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={CubeIcon}
              label="Artículos en inventario"
              value={stats.inventory.total_items}
              link="/inventory"
              linkText="Ver inventario"
            />
            <StatCard
              icon={ClipboardDocumentListIcon}
              label="Despachos"
              value={stats.work_orders.total}
              link="/despachos"
              linkText="Ver despachos"
            />
            <StatCard
              icon={WrenchIcon}
              label="Unidades registradas"
              value={stats.tools.total_units}
              link="/inventory?kind=herramienta"
              linkText="Ver herramientas"
            />
            <StatCard
              icon={ArrowTrendingUpIcon}
              label="Solicitantes registrados"
              value={stats.inventory.total_items}
              link="/despachos/new"
              linkText="Nuevo despacho"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Estado de órdenes</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={workOrderStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {workOrderStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Unidades físicas</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={unitsData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#1e3a5f" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Inventario</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={inventoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label
                    >
                      {inventoryData.map((entry, index) => (
                        <Cell key={`inv-cell-${index}`} fill={index === 1 ? '#ef4444' : '#10b981'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {despachosRecientes.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Despachos recientes</h3>
              <div className="overflow-hidden rounded-md border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">DV</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Solicitante</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Estado</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {despachosRecientes.map((d) => (
                      <tr key={d.id}>
                        <td className="px-4 py-2 text-sm">
                          <Link
                            to={`/despachos/${d.id}`}
                            className="font-medium text-brand-800 hover:underline"
                          >
                            {d.ot_number}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900">{d.solicitante}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">{d.status}</td>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {new Date(d.issued_at).toLocaleDateString('es-DO')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
          <h3 className="text-lg font-medium text-gray-900">Alertas de stock crítico</h3>
        </div>

        {loading ? (
          <p className="text-gray-600">Cargando...</p>
        ) : criticalItems.length === 0 ? (
          <p className="text-sm text-gray-500">No hay artículos en stock crítico.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Artículo</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Ubicación</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Stock</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Mínimo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {criticalItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-sm">
                      <Link
                        to={`/inventory/${item.id}`}
                        className="font-medium text-brand-800 hover:underline"
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.location}</td>
                    <td className="px-4 py-2 text-sm text-red-600 font-medium">{item.stock_available}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{item.minimum_stock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <WrenchIcon className="h-5 w-5 text-orange-600" />
          <h3 className="text-lg font-medium text-gray-900">Unidades con préstamo vencido</h3>
        </div>

        {loading ? (
          <p className="text-gray-600">Cargando...</p>
        ) : overdueUnits.length === 0 ? (
          <p className="text-sm text-gray-500">No hay unidades con préstamo vencido.</p>
        ) : (
          <div className="overflow-hidden rounded-md border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Item</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Serial</th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Asignado a</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {overdueUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td className="px-4 py-2 text-sm">
                      <Link
                        to={`/inventory/${unit.item}`}
                        className="font-medium text-brand-800 hover:underline"
                      >
                        {unit.item_name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{unit.serial_number}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{unit.active_loan?.recipient?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, link, linkText }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-brand-50 rounded-md">
          <Icon className="h-6 w-6 text-brand-700" />
        </div>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <Link to={link} className="text-sm font-medium text-brand-700 hover:underline">
        {linkText}
      </Link>
    </div>
  )
}
