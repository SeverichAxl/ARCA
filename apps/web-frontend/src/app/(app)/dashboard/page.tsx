import { ArrowUpRight, CalendarDays, FileText, Receipt, Users, TrendingUp, AlertCircle } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import { DashboardCharts } from '@/components/dashboard/dashboard-charts'
import { PageTransition } from '@/components/fade-in'

export const metadata: Metadata = {
  title: 'Dashboard — ARCA Ltda.',
}

const SUMMARY = [
  {
    label: 'Empleados activos',
    value: '77',
    change: '+4% este mes',
    hint: 'Módulo ms-personal',
    icon: Users,
    trend: 'up',
  },
  {
    label: 'Solicitudes de vacaciones',
    value: '22',
    change: '6 pendientes',
    hint: 'Módulo ms-vacaciones',
    icon: CalendarDays,
    trend: 'neutral',
  },
  {
    label: 'Contratos vigentes',
    value: '68',
    change: '3 por vencer',
    hint: 'Módulo ms-contratos',
    icon: FileText,
    trend: 'warning',
  },
  {
    label: 'Planillas del periodo',
    value: 'Bs 452.800',
    change: 'Gestión 02/2026',
    hint: 'Módulo ms-planillas',
    icon: Receipt,
    trend: 'up',
  },
]

export default function DashboardPage() {
  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="Resumen ejecutivo y estado operativo del Sistema de Gestión Humana de ARCA Ltda."
        />

        {/* Tarjetas de Métricas Resumen */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {SUMMARY.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm transition hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-xs font-normal border-slate-200 dark:border-slate-700">
                    {item.trend === 'warning' ? (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" /> {item.change}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <TrendingUp className="h-3 w-3" /> {item.change}
                      </span>
                    )}
                  </Badge>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
                  <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {item.value}
                  </p>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800/80 pt-2">
                  {item.hint}
                </p>
              </div>
            )
          })}
        </div>

        {/* Sección de Gráficos Visuales */}
        <DashboardCharts />

        {/* Accesos Rápidos y Estado del Sistema */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Accesos Rápidos */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Accesos rápidos</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Navega directamente a las vistas principales de la plataforma.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { href: '/personal', label: 'Gestionar personal' },
                { href: '/vacaciones', label: 'Revisar vacaciones' },
                { href: '/contratos', label: 'Consultar contratos' },
                { href: '/boletas', label: 'Ver boletas de pago' },
              ].map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-400"
                >
                  {link.label}
                  <ArrowUpRight className="h-4 w-4 opacity-70" />
                </Link>
              ))}
            </div>
          </section>

          {/* Estado de Arquitectura Monorepo */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-slate-950 p-6 text-slate-100 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
                Arquitectura del Sistema
              </p>
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <h2 className="mt-2 text-lg font-semibold">Frontend conectado a API Gateway</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Interacción en tiempo real con microservicios NestJS, autenticación por tokens RS256 y gestión de estado compartida mediante TanStack Query.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs">
              {['Next.js 15', 'Tailwind CSS', 'shadcn/ui', 'NestJS', 'Prisma', 'TanStack Query'].map((tag) => (
                <span key={tag} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-slate-300">
                  {tag}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageTransition>
  )
}