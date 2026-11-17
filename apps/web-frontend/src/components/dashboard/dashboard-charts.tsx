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
  { name: 'Aprobadas', value: 14, color: '#34d399' },
  { name: 'Pendientes', value: 6, color: '#8b5cf6' },
  { name: 'Rechazadas', value: 2, color: '#fb7185' },
]

const TOOLTIP_STYLE = {
  backgroundColor: '#120b22',
  border: '1px solid #3b2a60',
  borderRadius: '8px',
  color: '#f4f1ff',
}

export function DashboardCharts() {
  return (
    <div className="grid gap-6 lg:grid-cols-7">
      <div className="lg:col-span-4 rounded-xl border border-border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(0,0,0,0.95)]">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">
            Distribución de Personal por Área
          </h3>
          <p className="text-xs text-muted-foreground">
            Total de funcionarios ratificados en la gestión activa.
          </p>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={AREA_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a1b48" />
              <XAxis dataKey="area" tick={{ fontSize: 12, fill: '#9a8dbb' }} stroke="#3a2a5c" />
              <YAxis tick={{ fontSize: 12, fill: '#9a8dbb' }} stroke="#3a2a5c" />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="empleados" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-3 rounded-xl border border-border bg-card p-6 shadow-[0_18px_45px_-38px_rgba(0,0,0,0.95)]">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-foreground">
            Estado de Vacaciones
          </h3>
          <p className="text-xs text-muted-foreground">
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
              <Tooltip contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {VACATION_STATUS.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name} ({item.value})
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
