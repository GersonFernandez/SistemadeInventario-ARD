import { Link } from 'react-router-dom'
import {
  CubeIcon,
  WrenchScrewdriverIcon,
  UsersIcon,
  ChartBarIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { useAuth } from '../context/AuthContext'
import { getVisibleModules } from '../config/modules'

const moduleIcons = {
  inventory: CubeIcon,
  operations: WrenchScrewdriverIcon,
  administration: UsersIcon,
  reports: ChartBarIcon,
}

const accentClasses = {
  inventory: { gradient: 'from-brand-800 to-brand-600', border: 'border-brand-100', badge: 'bg-brand-50 text-brand-700 border-brand-200' },
  operations: { gradient: 'from-emerald-700 to-emerald-500', border: 'border-emerald-100', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  administration: { gradient: 'from-amber-700 to-amber-500', border: 'border-amber-100', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  reports: { gradient: 'from-slate-700 to-slate-500', border: 'border-slate-100', badge: 'bg-slate-50 text-slate-700 border-slate-200' },
}

export default function CatalogsPage() {
  const { user } = useAuth()
  const modules = getVisibleModules(user)

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-brand-100 bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-100">Panel de acceso</p>
            <h2 className="mt-1 text-2xl font-bold">Módulos del sistema</h2>
            <p className="mt-2 max-w-2xl text-sm text-brand-50">
              Selecciona una pantalla para acceder directamente. Cada módulo agrupa las funciones de su dominio.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm backdrop-blur">
            <p className="font-semibold">{modules.reduce((t, m) => t + m.pages.length, 0)} pantallas disponibles</p>
            <p className="text-brand-100">{modules.length} módulos activos para tu rol</p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {modules.map((module) => {
          const Icon = moduleIcons[module.id] || CubeIcon
          const accent = accentClasses[module.id] || accentClasses.inventory
          return (
            <div key={module.id} className={`rounded-2xl border ${accent.border} bg-white p-5 shadow-sm`}>
              <div className="flex items-start justify-between">
                <div className={`inline-flex rounded-xl bg-gradient-to-r ${accent.gradient} p-3 text-white shadow-sm`}>
                  <Icon className="h-5 w-5" />
                </div>
                <Link
                  to={module.primaryRoute}
                  className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-brand-700"
                >
                  Ver todo <ArrowRightIcon className="h-3 w-3" />
                </Link>
              </div>
              <h3 className="mt-4 text-base font-bold text-gray-900">{module.label}</h3>
              <p className="mt-1 text-sm text-gray-500">{module.description}</p>

              <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
                {module.pages.map((page) => (
                  <Link
                    key={page.path}
                    to={page.path}
                    className="flex items-center justify-between px-4 py-3 text-sm transition hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl"
                  >
                    <div>
                      <p className="font-medium text-gray-800">{page.label}</p>
                      <p className="text-xs text-gray-400">{page.description}</p>
                    </div>
                    <ArrowRightIcon className="h-4 w-4 flex-shrink-0 text-gray-300" />
                  </Link>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
