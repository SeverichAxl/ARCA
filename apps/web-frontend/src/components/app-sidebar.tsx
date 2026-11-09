'use client';

import {
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Network,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react';
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
  { href: '/boletas', label: 'Boletas', icon: Receipt },
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
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-900 px-4 py-6 text-slate-300 md:flex">
      <Link href="/dashboard" className="flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-lg font-bold text-white">
          A
        </span>
        <span>
          <span className="block text-sm font-semibold tracking-wide text-white">ARCA Ltda.</span>
          <span className="block text-xs text-slate-400">Gestión Humana</span>
        </span>
      </Link>

      <nav className="mt-8 flex flex-1 flex-col gap-1">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
