'use client';

import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Network,
  ReceiptText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { hasAnyPermission, ROUTE_PERMISSIONS, ROUTE_ROLES } from '@/lib/auth';
import { useAuth } from '@/components/auth/auth-provider';

const NAV_ITEMS: Array<{
  href: keyof typeof ROUTE_PERMISSIONS;
  label: string;
  icon: typeof Users;
}> = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/personal', label: 'Personal', icon: Users },
  { href: '/organigrama', label: 'Organigrama', icon: Network },
  { href: '/areas-cargos', label: 'Áreas y cargos', icon: Building2 },
  { href: '/vacaciones', label: 'Vacaciones', icon: CalendarDays },
  { href: '/contratos/plantillas', label: 'Plantillas de contrato', icon: FileText },
  { href: '/boletas/mis-boletas', label: 'Mis boletas', icon: ReceiptText },
  { href: '/boletas', label: 'Boletas autorizadas', icon: ReceiptText },
  { href: '/usuarios', label: 'Usuarios y roles', icon: ShieldCheck },
  { href: '/auditoria', label: 'Auditoría', icon: ClipboardList },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { session } = useAuth();
  const visibleItems = NAV_ITEMS.filter(
    (item) =>
      session &&
      (!ROUTE_ROLES[item.href] || ROUTE_ROLES[item.href].includes(session.user.role)) &&
      hasAnyPermission(session.user.permissions, ROUTE_PERMISSIONS[item.href]),
  );

  return (
    <aside className="cosmic sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-white/10 px-4 py-6 text-slate-300 md:flex">
      <div className="starfield opacity-50" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.30),transparent_70%)]"
      />

      <Link
        href="/dashboard"
        className="relative z-10 flex items-center gap-3 px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
      >
        <Image
          src="/ARCA-logo.png"
          alt="ARCA Ltda."
          width={1408}
          height={768}
          priority
          className="h-11 w-auto brightness-0 invert"
        />
      </Link>
      <p className="eyebrow relative z-10 mt-3 px-2 text-[9px] text-slate-400">
        Gestión humana
      </p>

      <nav className="relative z-10 mt-8 flex flex-1 flex-col gap-1" aria-label="Navegación principal">
        <p className="eyebrow mb-2 px-3 text-[9px] text-slate-400">Módulos</p>
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-[4px] px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/[0.06] text-white'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
              )}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1.5 left-0 w-px bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]"
                />
              ) : null}
              <Icon
                aria-hidden="true"
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive ? 'text-violet-300' : 'text-slate-500 group-hover:text-violet-300',
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="eyebrow relative z-10 mt-6 border-t border-white/10 px-2 pt-4 text-[9px] text-slate-400">
        ARCA · La Paz, Bolivia
      </div>
    </aside>
  );
}
