'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { hasAnyPermission, ROUTE_PERMISSIONS } from '@/lib/auth';

const QUICK_LINKS = [
  { href: '/personal', label: 'Gestionar personal' },
  { href: '/vacaciones', label: 'Revisar vacaciones' },
  { href: '/contratos', label: 'Consultar contratos' },
  { href: '/boletas', label: 'Ver boletas de pago' },
] as const;

export function DashboardQuickLinks() {
  const { session } = useAuth();
  const visibleLinks = QUICK_LINKS.filter(
    (link) =>
      session &&
      hasAnyPermission(session.user.permissions, ROUTE_PERMISSIONS[link.href]),
  );

  if (visibleLinks.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        Accesos rápidos
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Navega directamente a las vistas disponibles para tu rol.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visibleLinks.map((link) => (
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
  );
}
