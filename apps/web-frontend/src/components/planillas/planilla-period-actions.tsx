'use client';

import { useState, type FormEvent } from 'react';
import type { ReactNode } from 'react';
import { Calculator, Check, CircleAlert, LockKeyhole } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { ErrorAlert } from '@/components/shared/error-alert';
import { MoneyText } from '@/components/shared/money-text';
import { PeriodText } from '@/components/shared/period-text';
import { Button } from '@/components/ui/button';
import { isDomainMocked } from '@/lib/api/mock-status';
import { planillasApi } from '@/lib/api/planillas/planillas-api';
import type {
  CalculoPlanillaResult,
  PlanillaCabecera,
} from '@/lib/api/planillas/types';

function currentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function PlanillaPeriodActions({
  onPlanillaClosed,
}: {
  onPlanillaClosed: (planilla: PlanillaCabecera) => void;
}) {
  const { request, session } = useAuth();
  const permissions = session?.user.permissions ?? [];
  const canCalculate = permissions.includes('planilla:calculate');
  const canClose = permissions.includes('planilla:close');
  const mocked = isDomainMocked('planillas');
  const [period, setPeriod] = useState(currentPeriod);
  const [calculation, setCalculation] = useState<CalculoPlanillaResult | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [busy, setBusy] = useState<'calculate' | 'close' | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState('');

  if (!canCalculate) return null;

  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy('calculate');
    setError(null);
    setSuccess('');
    setCalculation(null);
    setConfirmClose(false);
    try {
      const result = await planillasApi.calcularPeriodo(request, period);
      setCalculation(result);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  }

  async function closePlanilla() {
    if (!calculation || !canClose) return;
    setBusy('close');
    setError(null);
    try {
      const closed = await planillasApi.cerrarPlanilla(request, calculation.planilla.id);
      setCalculation(null);
      setConfirmClose(false);
      setSuccess(`La planilla de ${closed.periodo} se cerró. Las boletas ya están habilitadas.`);
      onPlanillaClosed(closed);
    } catch (reason) {
      setError(reason);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section
      aria-labelledby="planilla-period-title"
      className="mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-[0_18px_45px_-38px_rgba(0,0,0,0.95)]"
    >
      <div className="border-l-4 border-violet-500 px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--info))]">
              Operación de nómina
            </p>
            <h2
              id="planilla-period-title"
              className="mt-1 text-lg font-semibold text-foreground"
            >
              Preparar planilla mensual
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Calcula o actualiza el borrador de los funcionarios activos. Revisa los totales y
              cierra el periodo para habilitar sus boletas.
            </p>
          </div>
          <Calculator aria-hidden="true" className="mt-1 h-5 w-5 text-[hsl(var(--info))]" />
        </div>

        <form onSubmit={(event) => void calculate(event)} className="mt-5 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-foreground">
              Periodo de nómina
            </span>
            <input
              type="month"
              required
              max={currentPeriod()}
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button type="submit" disabled={busy !== null || mocked}>
            <Calculator aria-hidden="true" className="h-4 w-4" />
            {busy === 'calculate' ? 'Calculando…' : 'Calcular periodo'}
          </Button>
        </form>

        {mocked ? (
          <p role="status" className="mt-3 text-sm text-[hsl(var(--warning))]">
            El cálculo y cierre requieren el servicio real de nómina; desactiva el mock de planillas
            para usar esta opción.
          </p>
        ) : null}

        {error ? <ErrorAlert error={error} className="mt-4" /> : null}
        {success ? (
          <p
            role="status"
            className="mt-4 flex items-start gap-2 rounded-lg border border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success-bg))] px-3 py-2.5 text-sm text-[hsl(var(--success))]"
          >
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {success}
          </p>
        ) : null}

        {calculation ? (
          <div className="mt-5 border-t border-border pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="font-semibold text-foreground">
                Cálculo listo · <PeriodText periodo={calculation.planilla.periodo} />
              </h3>
              <span className="text-sm text-muted-foreground">
                {calculation.planilla.totalEmpleados} funcionarios · {calculation.duracionTotalMs} ms
              </span>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem label="Total ganado">
                <MoneyText value={calculation.planilla.totales.totalGanado} />
              </SummaryItem>
              <SummaryItem label="Aportes laborales">
                <MoneyText value={calculation.planilla.totales.aportesLaborales} />
              </SummaryItem>
              <SummaryItem label="Aportes patronales">
                <MoneyText value={calculation.planilla.totales.aportesPatronales} />
              </SummaryItem>
              <SummaryItem label="ANS">
                <MoneyText value={calculation.planilla.totales.ans} />
              </SummaryItem>
              <SummaryItem label="RC-IVA">
                <MoneyText value={calculation.planilla.totales.rcIva} />
              </SummaryItem>
              <SummaryItem label="Otros descuentos">
                <MoneyText value={calculation.planilla.totales.otrosDescuentos} />
              </SummaryItem>
              <SummaryItem label="Líquido pagable">
                <MoneyText value={calculation.planilla.totales.liquidoPagable} />
              </SummaryItem>
            </dl>

            {calculation.observaciones.length > 0 ? (
              <div className="mt-4 rounded-lg border border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-bg))] px-3 py-2.5 text-sm text-[hsl(var(--warning))]">
                El cálculo generó {calculation.observaciones.length}{' '}
                {calculation.observaciones.length === 1 ? 'observación' : 'observaciones'}.
                Revisa la situación antes de cerrar.
                <ul className="mt-2 list-inside list-disc space-y-1">
                  {calculation.observaciones.map((observation, index) => (
                    <li key={`${index}-${observation}`}>{observation}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {canClose ? (
              <div className="mt-5">
                {!confirmClose ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setConfirmClose(true);
                    }}
                    disabled={busy !== null}
                  >
                    <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                    Cerrar planilla y habilitar boletas
                  </Button>
                ) : (
                  <div className="flex flex-col gap-3 rounded-lg border border-[hsl(var(--warning)/0.4)] bg-[hsl(var(--warning-bg))] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="flex items-start gap-2 text-sm text-[hsl(var(--warning))]">
                      <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                      El cierre es definitivo: la planilla quedará inmutable.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setConfirmClose(false)}
                        disabled={busy !== null}
                      >
                        Volver
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void closePlanilla()}
                        disabled={busy !== null}
                      >
                        {busy === 'close' ? 'Cerrando…' : 'Confirmar cierre definitivo'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[hsl(var(--warning))]">
                Tu rol puede calcular esta planilla, pero no tiene permiso para cerrarla.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SummaryItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-base font-semibold text-foreground">{children}</dd>
    </div>
  );
}
