'use client';

import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  FileText,
  Network,
  ReceiptText,
  Users,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { hasAnyPermission, ROUTE_PERMISSIONS } from '@/lib/auth';
import { cn } from '@/lib/utils';

const QUICK_LINKS = [
  { href: '/personal', label: 'Gestionar personal', icon: Users },
  { href: '/organigrama', label: 'Consultar organigrama', icon: Network },
  { href: '/areas-cargos', label: 'Administrar áreas y cargos', icon: Building2 },
  { href: '/vacaciones', label: 'Revisar vacaciones', icon: CalendarDays },
  { href: '/contratos', label: 'Consultar contratos', icon: FileText },
  { href: '/boletas', label: 'Ver boletas de pago', icon: ReceiptText },
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
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card/85 p-5 shadow-[0_20px_50px_-38px_rgba(0,0,0,0.95)] sm:p-6">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-violet-600/10 blur-3xl"
      />
      <div className="relative">
        <p className="eyebrow text-[10px] text-violet-300">Navegación directa</p>
        <h2 className="mt-2 font-display text-lg font-semibold tracking-[-0.02em] text-foreground">
          Accesos rápidos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Navega directamente a las vistas disponibles para tu rol.
        </p>
      </div>
      <div className="relative mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onPointerMove={(event) => {
                const target = event.currentTarget;
                const rect = target.getBoundingClientRect();
                target.style.setProperty('--glow-x', `${event.clientX - rect.left}px`);
                target.style.setProperty('--glow-y', `${event.clientY - rect.top}px`);
              }}
              className={cn(
                'group relative isolate flex items-center gap-3 overflow-hidden rounded-xl border border-border px-3.5 py-3 text-sm font-medium text-foreground',
                'transition-[transform,border-color,background-color,color] duration-200 hover:-translate-y-0.5 hover:border-violet-400/50 hover:bg-violet-500/[0.06] hover:text-violet-100',
              )}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  background:
                    'radial-gradient(150px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(167,139,250,0.18), transparent 72%)',
                }}
              />
              <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/60 text-muted-foreground transition-colors duration-200 group-hover:border-violet-400/40 group-hover:text-violet-200">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <span className="relative z-10 flex-1">{link.label}</span>
              <ArrowUpRight
                aria-hidden="true"
                className="relative z-10 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-violet-300"
              />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
