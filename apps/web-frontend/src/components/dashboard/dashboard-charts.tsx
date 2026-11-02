'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const AREA_DATA = [
  { area: 'Operaciones', empleados: 24 },
  { area: 'Tecnología', empleados: 18 },
  { area: 'RRHH', empleados: 8 },
  { area: 'Finanzas', empleados: 12 },
  { area: 'Ventas', empleados: 15 },
]

const VACATION_STATUS = [
  { name: 'Aprobadas', value: 14, color: '#22c55e' },
  { name: 'Pendientes', value: 6, color: '#3b82f6' },
  { name: 'Rechazadas', value: 2, color: '#ef4444' },
]

export function DashboardCharts() {
  return (
    <div className="grid gap-6 lg:grid-cols-7">
      <div className="lg:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Distribución de Personal por Área
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Total de funcionarios ratificados en la gestión activa.
          </p>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={AREA_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
              <XAxis dataKey="area" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
              <Bar dataKey="empleados" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Estado de Vacaciones
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Solicitudes procesadas este mes.
          </p>
        </div>
        <div className="h-[220px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={VACATION_STATUS}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={5}
                dataKey="value"
              >
                {VACATION_STATUS.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.9)',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#fff',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {VACATION_STATUS.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name} ({item.value})
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}