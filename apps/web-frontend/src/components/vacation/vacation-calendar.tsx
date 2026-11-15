'use client';

import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  buildVacationCalendarDays,
  formatVacationMonth,
  shiftVacationMonth,
} from '@/lib/vacation-calendar';
import type { VacationRequest } from '@/lib/vacation-api';

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

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

  return (
    <section aria-label={`Calendario de vacaciones: ${monthLabel}`} className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_18px_45px_-38px_rgba(0,0,0,0.95)]">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/30 bg-primary/15 text-violet-300">
            <CalendarDays className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold capitalize text-foreground">{monthLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Consultando ausencias…' : `${items.length} ${items.length === 1 ? 'rango aprobado' : 'rangos aprobados'}`}
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
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-violet-500" />Vacaciones aprobadas</span>
        <span>El rango se extiende entre las fechas marcadas.</span>
      </div>

      <div className="px-3 py-4 sm:px-5">
        {error ? (
          <div role="alert" className="rounded-lg border border-[hsl(var(--danger)/0.35)] bg-[hsl(var(--danger-bg))] p-4 text-sm text-[hsl(var(--danger))]">
            <p>{error}</p>
            <Button type="button" variant="outline" className="mt-3" onClick={onRetry}>Reintentar</Button>
          </div>
        ) : loading ? (
          <div role="status" className="flex min-h-56 items-center justify-center gap-3 text-sm text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-violet-400 motion-reduce:animate-none" />
            Cargando vacaciones del mes…
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[620px]">
                <div className="grid grid-cols-7 border-b border-border">
                  {WEEKDAYS.map((weekday) => (
                    <div key={weekday} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {weekday}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {days.map((day, index) => {
                    const absences = items.filter((item) => {
                      const start = item.fechaInicio.slice(0, 10);
                      const end = item.fechaFin.slice(0, 10);
                      return day.date >= start && day.date <= end;
                    });
                    const isToday = day.date === todayKey;
                    return (
                      <div
                        key={day.date}
                        aria-label={`${day.date}${absences.length ? `, ${absences.length} vacaciones aprobadas` : ''}`}
                        className={`min-h-24 border-b border-r border-border/60 px-1.5 py-2 sm:min-h-28 sm:px-2 ${index % 7 === 0 ? 'border-l' : ''} ${day.inMonth ? 'bg-card' : 'bg-muted/30'}`}
                      >
                        <time
                          dateTime={day.date}
                          className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full text-xs ${isToday ? 'bg-violet-600 font-semibold text-white' : day.inMonth ? 'font-medium text-foreground' : 'text-muted-foreground/60'}`}
                        >
                          {day.day}
                        </time>
                        <div className="mt-1 space-y-1">
                          {absences.map((item) => {
                            const start = item.fechaInicio.slice(0, 10);
                            const end = item.fechaFin.slice(0, 10);
                            const segmentStart = day.date === start || index % 7 === 0;
                            const segmentEnd = day.date === end || index % 7 === 6;
                            const label = day.date === start
                              ? 'Vacaciones aprobadas'
                              : start < day.date && segmentStart
                                ? 'Continúa'
                                : '';
                            return (
                              <div
                                key={item.id}
                                title={`Vacaciones aprobadas: ${start} — ${end}`}
                                className={`h-6 overflow-hidden bg-violet-600 px-1.5 text-[10px] font-medium leading-6 text-white ${segmentStart ? 'rounded-l-md' : ''} ${segmentEnd ? 'rounded-r-md' : ''}`}
                              >
                                {label}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {items.length === 0 && (
              <div className="flex items-start gap-3 px-2 py-5 text-sm text-muted-foreground">
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
    </section>
  );
}
