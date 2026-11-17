'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, CalendarDays, Check, Clock3, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type {
  VacationBalance,
  VacationRequest,
  VacationState,
  VacationView,
} from '@/lib/vacation-api';

const STATE_LABELS: Record<VacationState, string> = {
  PENDIENTE_JEFE: 'Pendiente de jefatura',
  APROBADO_JEFE: 'Aprobado por jefatura',
  APROBADO_FINAL: 'Aprobado por RRHH',
  RECHAZADA: 'Rechazada',
  CANCELADA: 'Cancelada',
};
const STATE_STYLES: Record<VacationState, string> = {
  PENDIENTE_JEFE:
    'border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning))]',
  APROBADO_JEFE:
    'border border-[hsl(var(--info)/0.35)] bg-[hsl(var(--info-bg))] text-[hsl(var(--info))]',
  APROBADO_FINAL:
    'border border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]',
  RECHAZADA:
    'border border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger))]',
  CANCELADA: 'border border-border bg-muted text-muted-foreground',
};
const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));

export function VacationBalanceCards({ balance }: { balance: VacationBalance }) {
  const currentYear = Math.max(...balance.gestiones.map(({ gestion }) => gestion));
  return (
    <>
      <section
        className={`mb-5 flex items-center justify-between gap-4 rounded-xl border p-5 ${
          balance.elegible
            ? 'border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success-bg))]'
            : 'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))]'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full text-white ${
              balance.elegible ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          >
            {balance.elegible ? <Check className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Estado de elegibilidad
            </p>
            <p className="font-semibold text-foreground">
              {balance.elegible
                ? 'Puedes solicitar vacaciones'
                : 'Aún no cumples la antigüedad mínima'}
            </p>
          </div>
        </div>
        <span className="text-sm font-medium text-foreground">
          {balance.elegible ? 'Elegible' : 'No elegible'}
        </span>
      </section>
      {balance.advertencias.length > 0 && (
        <div className="mb-5 flex gap-3 rounded-xl border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] p-4 text-sm text-[hsl(var(--warning))]">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Revisa tus gestiones pendientes</p>
            <p className="mt-1">{balance.advertencias.join(' · ')}</p>
          </div>
        </div>
      )}
      <section className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {balance.gestiones.map((gestion) => {
          const assigned = gestion.diasAsignados + gestion.diasExcepcion;
          const usedPercent = assigned ? Math.min(100, (gestion.diasTomados / assigned) * 100) : 0;
          return (
            <article
              key={gestion.gestion}
              className="group relative rounded-2xl border border-border/80 bg-card/85 backdrop-blur-sm p-6 shadow-[0_20px_50px_-38px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow] duration-300 hover:border-violet-400/35 hover:shadow-[0_28px_60px_-32px_hsl(var(--violet-600)/0.45)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Gestión
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-foreground">{gestion.gestion}</h2>
                </div>
                <span className="rounded-full border border-primary/25 bg-primary/15 px-3 py-1 text-xs font-medium text-emerald-200">
                  {gestion.gestion === currentYear ? 'Actual' : 'Acumulada'}
                </span>
              </div>
              <div className="mt-6 grid grid-cols-3 divide-x divide-border">
                <Metric label="Asignados" value={assigned} />
                <Metric label="Tomados" value={gestion.diasTomados} />
                <Metric label="Pendientes" value={gestion.diasPendientes} accent />
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
            </article>
          );
        })}
      </section>
    </>
  );
}

export function VacationRequestList({ items }: { items: VacationRequest[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.9)]">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-violet-300" />
        <h2 className="font-semibold text-foreground">Solicitudes recientes</h2>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Todavía no tienes solicitudes de vacaciones.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div>
                <p className="font-medium text-foreground">
                  {formatDate(item.fechaInicio)} — {formatDate(item.fechaFin)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.diasHabiles} días hábiles
                </p>
              </div>
              <StateBadge state={item.estado} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function VacationApprovalList({
  items,
  view,
  busyId,
  comments,
  onCommentChange,
  canResolveException,
  onAct,
  onResolveException,
}: {
  items: VacationRequest[];
  view: Exclude<VacationView, 'propias'>;
  busyId: string;
  comments: Record<string, string>;
  onCommentChange: (id: string, value: string) => void;
  canResolveException: boolean;
  onAct: (id: string, action: 'approve' | 'reject') => void;
  onResolveException: (id: string, decision: 'APROBADA' | 'RECHAZADA') => void;
}) {
  if (!items.length)
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        No hay solicitudes pendientes en esta bandeja.
      </div>
    );
  return (
    <section className="space-y-4">
      {items.map((item) => {
        const canDecide =
          (view === 'bandeja-jefe' && item.estado === 'PENDIENTE_JEFE') ||
          (view === 'bandeja-rrhh' && item.estado === 'APROBADO_JEFE');
        return (
          <article
            key={item.id}
            className="rounded-xl border border-border bg-card p-5 shadow-[0_18px_40px_-34px_rgba(0,0,0,0.9)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">
                  {item.empleado?.nombreCompleto ?? 'Funcionario'}{' '}
                  <span className="font-normal text-muted-foreground">
                    · {item.diasHabiles} días hábiles
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatDate(item.fechaInicio)} — {formatDate(item.fechaFin)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Solicitud {item.id.slice(0, 8)}
                </p>
              </div>
              <StateBadge state={item.estado} />
            </div>
            {item.excepcion && (
              <div className="mt-3 rounded-lg border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] p-3 text-sm text-[hsl(var(--warning))]">
                Excepción: {item.excepcion.estado} · {item.excepcion.justificacion}
              </div>
            )}
            <label className="mt-4 block text-xs font-medium text-muted-foreground">
              Comentario o motivo
              <textarea
                value={comments[item.id] ?? ''}
                onChange={(event) => onCommentChange(item.id, event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-ring/30"
                rows={2}
              />
            </label>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {canResolveException && item.excepcion?.estado === 'PENDIENTE' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === item.excepcion.id}
                    onClick={() => onResolveException(item.excepcion!.id, 'RECHAZADA')}
                  >
                    Rechazar excepción
                  </Button>
                  <Button
                    type="button"
                    disabled={busyId === item.excepcion.id}
                    onClick={() => onResolveException(item.excepcion!.id, 'APROBADA')}
                  >
                    Aprobar excepción
                  </Button>
                </>
              )}
              {canDecide && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === item.id}
                    onClick={() => onAct(item.id, 'reject')}
                  >
                    Rechazar
                  </Button>
                  <Button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => onAct(item.id, 'approve')}
                  >
                    {busyId === item.id
                      ? 'Guardando…'
                      : view === 'bandeja-jefe'
                        ? 'Aprobar como jefatura'
                        : 'Aprobar como RRHH'}
                  </Button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function VacationRequestDialog({
  balance,
  available,
  onClose,
  onSubmit,
}: {
  balance: VacationBalance | null;
  available: number;
  onClose: () => void;
  onSubmit: (input: {
    fechaInicio: string;
    fechaFin: string;
    days: number;
    exception: boolean;
    justification: string;
  }) => Promise<void>;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [exception, setException] = useState(false);
  const [justification, setJustification] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const days = countWeekdays(start, end);
  const insufficient = days > available;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!start || !end || end < start || !days) {
      setError('Selecciona un rango válido que incluya días hábiles.');
      return;
    }
    if (insufficient && !exception) {
      setError('El saldo no alcanza. Activa la solicitud excepcional para continuar.');
      return;
    }
    if (exception && !justification.trim()) {
      setError('Escribe la justificación para solicitar la excepción.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        fechaInicio: start,
        fechaFin: end,
        days,
        exception: insufficient && exception,
        justification: justification.trim(),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,10,20,0.65)] p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-2xl shadow-black/50"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Solicitar vacaciones</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              El servidor valida feriados, traslapes y saldo antes de registrar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-foreground">
            Fecha de inicio
            <Input
              required
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className="mt-2"
            />
          </label>
          <label className="text-sm font-medium text-foreground">
            Fecha de fin
            <Input
              required
              type="date"
              min={start || undefined}
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className="mt-2"
            />
          </label>
        </div>
        <div className="mt-4 rounded-lg border border-primary/25 bg-primary/10 p-4">
          <p className="text-sm font-semibold text-emerald-200">{days} días hábiles estimados</p>
          <p className="mt-1 text-xs text-emerald-200/75">
            Estimación sin feriados; saldo pendiente: {available} días.
          </p>
        </div>
        {insufficient && (
          <div className="mt-4 rounded-lg border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] p-4">
            <p className="text-sm font-semibold text-[hsl(var(--warning))]">Saldo insuficiente</p>
            <label className="mt-3 flex items-center gap-2 text-sm text-[hsl(var(--warning))]">
              <input
                type="checkbox"
                checked={exception}
                onChange={(event) => setException(event.target.checked)}
              />
              Solicitar aprobación excepcional
            </label>
            {exception && (
              <textarea
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                maxLength={1000}
                required
                placeholder="Explica el motivo de la excepción"
                className="mt-3 min-h-24 w-full rounded-md border border-[hsl(var(--warning)/0.4)] bg-background p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-[hsl(var(--warning)/0.5)]"
              />
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-[hsl(var(--danger))]">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !balance?.elegible}>
            <Send className="h-4 w-4" />
            {saving ? 'Enviando…' : 'Enviar solicitud'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="px-3 first:pl-0 last:pr-0">
      <p
        className={`text-2xl font-semibold tabular-nums ${accent ? 'text-violet-300' : 'text-foreground'}`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
function StateBadge({ state }: { state: VacationState }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATE_STYLES[state]}`}>
      {STATE_LABELS[state]}
    </span>
  );
}
function countWeekdays(start: string, end: string) {
  if (!start || !end || end < start) return 0;
  const date = new Date(`${start}T12:00:00`);
  const last = new Date(`${end}T12:00:00`);
  let count = 0;
  while (date <= last) {
    if (date.getDay() !== 0 && date.getDay() !== 6) count++;
    date.setDate(date.getDate() + 1);
  }
  return count;
}
