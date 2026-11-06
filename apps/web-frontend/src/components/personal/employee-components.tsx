import type { ReactNode } from 'react';
import { AlertTriangle, BriefcaseBusiness, CalendarDays, ShieldCheck, UserRound } from 'lucide-react';
import {
  activeProtections,
  formatMoney,
  type Employee,
  type EmployeeStatus,
  type JobProtectionType,
} from '@/lib/personal-api';

const PROTECTION_LABELS: Record<JobProtectionType, string> = {
  GESTACION: 'Gestación',
  PROGENITOR: 'Progenitor',
  DISCAPACIDAD: 'Ley 223',
  TUTOR_DISCAPACIDAD: 'Tutor Ley 223',
};

const STATUS_STYLES: Record<EmployeeStatus, string> = {
  EN_PRUEBA: 'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]',
  RATIFICADO: 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]',
  INACTIVO: 'bg-muted text-muted-foreground',
};

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const label =
    status === 'EN_PRUEBA' ? 'En prueba' : status === 'RATIFICADO' ? 'Ratificado' : 'Inactivo';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 caption-small font-medium ${STATUS_STYLES[status]}`}>
      {label}
    </span>
  );
}

export function EmployeeProtectionBadges({ employee }: { employee: Employee }) {
  const protections = activeProtections(employee);
  return (
    <span className="flex flex-wrap gap-1">
      {protections.map((protection) => (
        <span
          key={protection.id ?? `${protection.tipo}-${protection.fechaInicio}`}
          className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--danger-bg))] px-2 py-0.5 caption-small text-[hsl(var(--danger))]"
        >
          <ShieldCheck className="h-3 w-3" />
          {PROTECTION_LABELS[protection.tipo]}
        </span>
      ))}
    </span>
  );
}

export function EmployeeCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: 'personal' | 'work' | 'signature' | 'protection';
  children: ReactNode;
}) {
  const icons = {
    personal: UserRound,
    work: BriefcaseBusiness,
    signature: CalendarDays,
    protection: ShieldCheck,
  };
  const Icon = icons[icon];

  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <header className="mb-5 flex items-center gap-3 border-b border-border pb-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <span>
          <span className="block body-medium text-card-foreground">{title}</span>
          <span className="caption-small text-muted-foreground">{description}</span>
        </span>
      </header>
      {children}
    </section>
  );
}

export function EmployeeField({
  label,
  value,
}: {
  label: string;
  value: string | ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="caption-small text-muted-foreground">{label}</dt>
      <dd className="body-default break-words text-card-foreground">{value || '—'}</dd>
    </div>
  );
}

export function EmployeeProtectionAlert({ protections }: { protections: Employee['inamovilidades'] }) {
  if (!protections?.length) return null;
  return (
    <div className="flex gap-3 rounded-md border border-[hsl(var(--danger)/0.25)] bg-[hsl(var(--danger-bg))] p-4 text-[hsl(var(--danger))]">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="body-medium">Inamovilidad laboral activa</p>
        <p className="caption-small mt-1">
          La baja requiere autorización del Ministerio de Trabajo.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {protections.map((protection) => (
            <span key={protection.id ?? protection.tipo} className="caption-small font-medium">
              {PROTECTION_LABELS[protection.tipo]}
              {protection.fechaFin
                ? ` · hasta ${new Intl.DateTimeFormat('es-BO').format(new Date(protection.fechaFin))}`
                : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SalaryValue({ amount }: { amount?: number | null }) {
  return <span className="mono-hash">{formatMoney(amount)}</span>;
}
