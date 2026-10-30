import { ArrowUpRight, CalendarDays, FileText, Receipt, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const SUMMARY = [
  {
    label: 'Empleados activos',
    value: '—',
    hint: 'Pendiente de integración con ms-personal',
    icon: Users,
  },
  {
    label: 'Solicitudes de vacaciones',
    value: '—',
    hint: 'Pendiente de integración con ms-vacaciones',
    icon: CalendarDays,
  },
  {
    label: 'Contratos vigentes',
    value: '—',
    hint: 'Pendiente de integración con ms-contratos',
    icon: FileText,
  },
  {
    label: 'Planillas del periodo',
    value: '—',
    hint: 'Pendiente de integración con ms-planillas',
    icon: Receipt,
  },
];

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Resumen general del Sistema de Gestión Humana de ARCA Ltda."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                  Sin datos
                </span>
              </div>
              <p className="mt-4 text-sm font-medium text-slate-500">{item.label}</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                {item.value}
              </p>
              <p className="mt-3 text-xs leading-5 text-slate-400">{item.hint}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Accesos rápidos</h2>
          <p className="mt-1 text-sm text-slate-500">
            Los módulos estarán disponibles a medida que se implementen las historias.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {[
              { href: '/personal', label: 'Gestionar personal' },
              { href: '/vacaciones', label: 'Revisar vacaciones' },
              { href: '/contratos', label: 'Consultar contratos' },
              { href: '/boletas', label: 'Ver boletas' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {link.label}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-900 p-6 text-slate-100 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">
            Estado del sistema
          </p>
          <h2 className="mt-2 text-lg font-semibold">Estructura base lista</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Microservicios, gateway y frontend conectados por variables de entorno. La lógica de
            negocio se incorporará en las siguientes iteraciones.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            {['Next.js', 'NestJS', 'Prisma', 'PostgreSQL', 'RabbitMQ'].map((tag) => (
              <span key={tag} className="rounded-full border border-white/15 px-3 py-1">
                {tag}
              </span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
