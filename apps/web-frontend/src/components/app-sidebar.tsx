'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight, Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useAuth } from '@/components/auth/auth-provider';
import { hasAnyPermission, ROUTE_PERMISSIONS, ROUTE_ROLES } from '@/lib/auth';
import { getActiveNavHref, NAV_ITEMS, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

function trackGlow(event: React.PointerEvent<HTMLElement>) {
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  target.style.setProperty('--glow-x', `${event.clientX - rect.left}px`);
  target.style.setProperty('--glow-y', `${event.clientY - rect.top}px`);
}

function useVisibleItems(): NavItem[] {
  const { session } = useAuth();
  return useMemo(
    () =>
      NAV_ITEMS.filter(
        (item) =>
          session &&
          (!ROUTE_ROLES[item.href] || ROUTE_ROLES[item.href].includes(session.user.role)) &&
          hasAnyPermission(session.user.permissions, ROUTE_PERMISSIONS[item.href]),
      ),
    [session],
  );
}

function NavLink({
  item,
  active,
  expanded,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  expanded: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={expanded ? undefined : item.label}
      aria-label={expanded ? undefined : item.label}
      aria-current={active ? 'page' : undefined}
      onPointerMove={trackGlow}
      className={cn(
        'group relative isolate flex items-center gap-3 overflow-hidden rounded-lg py-2.5 text-sm font-medium transition-[color,background-color,transform] duration-200',
        expanded ? 'justify-start px-2.5' : 'justify-center px-0',
        active
          ? 'bg-white/[0.07] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]'
          : 'text-slate-400 hover:bg-white/[0.045] hover:text-white',
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        style={{
          background:
            'radial-gradient(110px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(167, 139, 250, 0.2), transparent 72%)',
        }}
      />
      {active ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 z-10 w-px rounded-full bg-violet-400 shadow-[0_0_12px_rgba(167,139,250,0.9)]"
        />
      ) : null}
      <Icon
        aria-hidden="true"
        className={cn(
          'relative z-10 h-4 w-4 shrink-0 transition-colors duration-200',
          active ? 'text-violet-300' : 'text-slate-500 group-hover:text-violet-300',
        )}
      />
      <span
        className={cn(
          'relative z-10 overflow-hidden whitespace-nowrap text-left transition-[max-width,opacity] duration-300 ease-out',
          expanded ? 'max-w-[180px] opacity-100' : 'max-w-0 opacity-0',
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const items = useVisibleItems();
  const activeHref = getActiveNavHref(pathname);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const expanded = pinned || hovered;

  return (
    <div className="relative hidden w-[82px] shrink-0 md:block">
      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setHovered(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setHovered(false);
          }
        }}
        aria-label="Navegación lateral"
        className={cn(
          'cosmic sticky top-20 z-30 ml-3 flex max-h-[62vh] flex-col overflow-hidden rounded-2xl border border-white/10 p-2.5 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.95)] transition-[width,box-shadow,border-color] duration-300 ease-out',
          expanded
            ? 'w-[248px] border-violet-400/20 shadow-[0_30px_80px_-32px_rgba(76,29,149,0.75)]'
            : 'w-[58px] hover:border-violet-400/30',
        )}
      >
        <div className="starfield opacity-40" aria-hidden="true" />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.28),transparent_70%)]"
        />

        <div
          className={cn(
            'relative z-10 flex items-center gap-2 pb-2 pt-0.5',
            expanded ? 'justify-between px-1' : 'justify-center',
          )}
        >
          <span
            className={cn(
              'eyebrow overflow-hidden whitespace-nowrap text-[9px] text-slate-400 transition-[max-width,opacity] duration-300',
              expanded ? 'max-w-[120px] opacity-100' : 'max-w-0 opacity-0',
            )}
          >
            Módulos
          </span>
          <button
            type="button"
            onClick={() => setPinned((current) => !current)}
            aria-pressed={pinned}
            aria-label={
              pinned
                ? 'Contraer barra de navegación'
                : expanded
                  ? 'Fijar barra de navegación abierta'
                  : 'Expandir barra de navegación'
            }
            className="group relative isolate flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-slate-400 transition-[color,border-color,background-color] duration-200 hover:border-violet-400/40 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          >
            {expanded ? (
              <ChevronsLeft aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <ChevronsRight aria-hidden="true" className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        <nav
          className="relative z-10 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden pr-0.5"
          aria-label="Navegación principal"
        >
          {items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={activeHref === item.href}
              expanded={expanded}
            />
          ))}
        </nav>

        <div
          className={cn(
            'eyebrow relative z-10 mt-2 overflow-hidden whitespace-nowrap border-t border-white/10 pt-2.5 text-[9px] text-slate-400 transition-[max-width,opacity,height] duration-300',
            expanded ? 'max-w-[200px] px-1 opacity-100' : 'max-w-0 border-transparent opacity-0',
          )}
        >
          ARCA · La Paz, Bolivia
        </div>
      </aside>
    </div>
  );
}

export function MobileSidebar() {
  const pathname = usePathname();
  const items = useVisibleItems();
  const activeHref = getActiveNavHref(pathname);
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Abrir navegación"
          onPointerMove={trackGlow}
          className="group relative isolate flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-[color,border-color] duration-200 hover:border-violet-400/40 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40 md:hidden"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                'radial-gradient(140px circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(167, 139, 250, 0.24), transparent 72%)',
            }}
          />
          <Menu aria-hidden="true" className="relative z-10 h-4 w-4" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-white/10 bg-[#0b0714] p-0">
        <SheetTitle className="sr-only">Navegación principal</SheetTitle>
        <SheetDescription className="sr-only">
          Accesos a los módulos habilitados para tu rol.
        </SheetDescription>
        <div className="cosmic relative flex h-full flex-col overflow-hidden p-5">
          <div className="starfield opacity-40" aria-hidden="true" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.28),transparent_70%)]"
          />
          <p className="eyebrow relative z-10 text-[9px] text-violet-300">ARCA · Gestión humana</p>
          <p className="relative z-10 mt-2 font-display text-lg font-semibold text-white">
            Navegación
          </p>
          <nav className="relative z-10 mt-5 flex flex-1 flex-col gap-1" aria-label="Principal">
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={activeHref === item.href}
                expanded
                onNavigate={() => setOpen(false)}
              />
            ))}
          </nav>
          <p className="eyebrow relative z-10 mt-6 border-t border-white/10 pt-4 text-[9px] text-slate-400">
            ARCA · La Paz, Bolivia
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
