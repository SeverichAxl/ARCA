'use client';

import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { hasAnyPermission, ROUTE_PERMISSIONS } from '@/lib/auth';

const QUICK_LINKS = [
  { href: '/personal', label: 'Gestionar personal' },
  { href: '/organigrama', label: 'Consultar organigrama' },
  { href: '/areas-cargos', label: 'Administrar áreas y cargos' },
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
    <section className="rounded-[6px] border border-border bg-card p-6 shadow-[0_18px_45px_-35px_rgba(0,0,0,0.9)]">
      <p className="eyebrow text-[10px] text-violet-300">Navegación directa</p>
      <h2 className="mt-2 font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
        Accesos rápidos
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Navega directamente a las vistas disponibles para tu rol.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {visibleLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between rounded-[4px] border border-border px-4 py-3 text-sm font-medium text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-400/60 hover:bg-primary/[0.08] hover:text-violet-200"
          >
            {link.label}
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-300" />
          </Link>
        ))}
      </div>
    </section>
  );
}
