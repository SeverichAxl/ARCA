'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildVacationCalendarDays,
  formatVacationMonth,
  shiftVacationMonth,
} from '@/lib/vacation-calendar';
import type { VacationRequest } from '@/lib/vacation-api';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));

export function VacationCalendar({
  month,
  items,
  loading,
  error,
  onMonthChange,
  onRetry,
}: {
  month: string;
  items: VacationRequest[];
  loading: boolean;
  error: string;
  onMonthChange: (month: string) => void;
  onRetry: () => void;
}) {
  const days = buildVacationCalendarDays(month);
  const monthLabel = formatVacationMonth(month);
  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const currentMonth = todayKey.slice(0, 7);
  const approvedItems = items.filter((item) => item.estado === 'APROBADO_FINAL');

  return (
    <section
      aria-label={`Calendario de vacaciones: ${monthLabel}`}
      className="w-full"
    >
      <div className="grid gap-6 lg:grid-cols-12">
        {/* ==================== CALENDARIO PRINCIPAL ==================== */}
        <div
          className="lg:col-span-8 overflow-hidden rounded-xl border border-border bg-card shadow-[0_18px_45px_-38px_rgba(0,0,0,0.95)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-violet-300">
                <CalendarDays className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-semibold capitalize text-foreground">
                  {monthLabel}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {loading
                    ? 'Consultando ausencias…'
                    : `${approvedItems.length} ${approvedItems.length === 1 ? 'rango aprobado' : 'rangos aprobados'}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-9 w-9 px-0"
                aria-label="Mes anterior"
                onClick={() => onMonthChange(shiftVacationMonth(month, -1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 px-3 text-sm"
                onClick={() => onMonthChange(currentMonth)}
              >
                Este mes
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-9 px-0"
                aria-label="Mes siguiente"
                onClick={() => onMonthChange(shiftVacationMonth(month, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-border/70 px-4 py-3 text-xs text-muted-foreground sm:px-6">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
              Vacaciones aprobadas
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full border border-violet-400/50" />
              Hoy
            </span>
          </div>

          <div className="px-3 py-4 sm:px-5">
            {error ? (
              <div role="alert" className="rounded-lg border border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger-bg))] p-4 text-sm text-[hsl(var(--danger))]">
                <p>{error}</p>
                <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>
                  Reintentar
                </Button>
              </div>
            ) : loading ? (
              <div role="status" className="flex min-h-[300px] items-center justify-center gap-3 text-sm text-muted-foreground">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-violet-400 motion-reduce:animate-none" />
                Cargando vacaciones del mes…
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div className="min-w-[620px]">
                    <div className="grid grid-cols-7 border-b border-border">
                      {WEEKDAYS.map((weekday) => (
                        <div
                          key={weekday}
                          className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {weekday}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {days.map((day, index) => {
                        const absences = items.filter((item) => {
                          const start = item.fechaInicio.slice(0, 10);
                          const end = item.fechaFin.slice(0, 10);
                          return day.date >= start && day.date <= end;
                        });
                        const isToday = day.date === todayKey;
                        const hasVacation = absences.length > 0;
                        return (
                          <div
                            key={day.date}
                            aria-label={`${day.date}${absences.length ? `, ${absences.length} vacaciones aprobadas` : ''}`}
                            className={`min-h-[70px] sm:min-h-[100px] rounded-2xl border border-border/60 flex flex-col items-center justify-center gap-1 px-1 py-2 transition-colors duration-200 hover:bg-accent/40 ${
                              day.inMonth ? 'bg-card' : 'bg-muted/30'
                            } ${hasVacation ? 'bg-violet-500/10 border-violet-500/20' : ''} ${isToday ? 'ring-2 ring-violet-500' : ''}`}
                          >
                            <time
                              dateTime={day.date}
                              className={`h-8 min-w-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                                isToday
                                  ? 'bg-violet-600 text-white'
                                  : hasVacation
                                    ? 'text-violet-300'
                                    : day.inMonth
                                      ? 'text-foreground'
                                      : 'text-muted-foreground/50'
                              }`}
                            >
                              {day.day}
                            </time>
                            {hasVacation && (
                              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                {items.length === 0 && (
                  <div className="flex items-start gap-3 px-2 py-6 text-sm text-muted-foreground">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                    <p>No tienes vacaciones aprobadas en este mes.</p>
                  </div>
                )}
              </>
            )}
          </div>
          <p className="border-t border-border/70 bg-muted/30 px-4 py-3 text-xs leading-5 text-muted-foreground sm:px-6">
            Esta agenda muestra tus vacaciones con aprobación final. La API actual no permite consultar licencias remuneradas ni ausencias de otras áreas.
          </p>
        </div>

        {/* ==================== PANEL SCHEDULED (DERECHA) ==================== */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <section className="rounded-xl border border-border bg-card shadow-[0_18px_40px_-34px_rgba(0,0,0,0.9)]">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-violet-400" />
                <h3 className="font-semibold text-foreground">Scheduled</h3>
              </div>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-200">
                {approvedItems.length}
              </span>
            </div>
            <div className="p-4 space-y-3">
              {approvedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CalendarDays className="mb-2 h-6 w-6 shrink-0 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    No hay vacaciones programadas en este mes.
                  </p>
                </div>
              ) : (
                approvedItems.map((item) => {
                  const start = item.fechaInicio.slice(0, 10);
                  const end = item.fechaFin.slice(0, 10);
                  const startDay = start.slice(8, 10);
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3 hover:bg-muted/50 transition-colors duration-200 group"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-300">
                        <span className="text-[10px] font-bold leading-none">
                          {startDay}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          Vacaciones aprobadas
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">
                          {formatDate(start)} — {formatDate(end)}
                        </p>
                        <span className="mt-2 inline-flex items-center rounded-full border border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success-bg))] px-2 py-0.5 text-[10px] font-medium text-[hsl(var(--success))]">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Aprobado
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
