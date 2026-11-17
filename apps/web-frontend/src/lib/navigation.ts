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
import type { ROUTE_PERMISSIONS } from '@/lib/auth';

export interface NavItem {
  href: keyof typeof ROUTE_PERMISSIONS;
  label: string;
  icon: typeof Users;
}

/** Módulos visibles en el rail lateral y en la navegación móvil. */
export const NAV_ITEMS: NavItem[] = [
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

const SECTION_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  personal: 'Personal',
  organigrama: 'Organigrama',
  'areas-cargos': 'Áreas y cargos',
  vacaciones: 'Vacaciones',
  contratos: 'Contratos',
  boletas: 'Boletas',
  usuarios: 'Usuarios y roles',
  auditoria: 'Auditoría',
};

const SEGMENT_LABELS: Record<string, string> = {
  nueva: 'Nueva plantilla',
  plantillas: 'Plantillas',
  'mis-boletas': 'Mis boletas',
  modificar: 'Modificar',
  baja: 'Dar de baja',
};

/** Etiqueta de la "página" final de cada ruta conocida. */
const PAGE_LABELS: Record<string, string> = {
  '/dashboard': 'Overview',
  '/personal': 'Listado',
  '/personal/nuevo': 'Nuevo registro',
  '/organigrama': 'Estructura',
  '/areas-cargos': 'Catálogo',
  '/vacaciones': 'Calendario',
  '/contratos': 'Resumen',
  '/contratos/plantillas': 'Plantillas',
  '/contratos/plantillas/nueva': 'Nueva plantilla',
  '/boletas': 'Autorizadas',
  '/boletas/mis-boletas': 'Mis boletas',
  '/usuarios': 'Directorio',
  '/auditoria': 'Registro',
};

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isIdentifier(value: string): boolean {
  return /^\d+$/.test(value) || /^[0-9a-f]{6,}$/i.test(value);
}

/**
 * Construye la ruta de navegación que se muestra en el header, por ejemplo
 * `ARCA > Dashboard > Overview` o `ARCA > Personal > Ficha del empleado`.
 */
export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const clean = pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
  const root: BreadcrumbItem = { label: 'ARCA', href: '/dashboard' };

  if (clean === '/' || clean === '/login') {
    return [root, { label: 'Acceso' }];
  }

  const segments = clean.split('/').filter(Boolean);
  const section = segments[0];
  const sectionLabel = SECTION_LABELS[section] ?? capitalize(section);
  let leaf = PAGE_LABELS[clean];

  if (!leaf) {
    if (section === 'personal' && segments.length >= 2) {
      if (segments[1] === 'nuevo') leaf = 'Nuevo registro';
      else if (segments[2] === 'modificar') leaf = 'Modificar ficha';
      else if (segments[2] === 'baja') leaf = 'Dar de baja';
      else leaf = 'Ficha del empleado';
    } else {
      const last = segments.at(-1) ?? section;
      leaf = SEGMENT_LABELS[last] ?? (isIdentifier(last) ? 'Detalle' : capitalize(last));
    }
  }

  return [root, { label: sectionLabel }, { label: leaf }];
}

/**
 * Devuelve el enlace activo más específico para la ruta actual. Evita que
 * `/boletas` quede activo al visitar `/boletas/mis-boletas`.
 */
export function getActiveNavHref(pathname: string): string | undefined {
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )?.href;
}
