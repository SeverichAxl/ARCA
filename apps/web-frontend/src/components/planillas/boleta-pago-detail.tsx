import { MoneyText } from '@/components/shared/money-text';
import { PeriodText } from '@/components/shared/period-text';
import type { PagoPlanilla } from '@/lib/api/planillas/types';

function DetailRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <dt className={strong ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300'}>
        {label}
      </dt>
      <dd>
        <MoneyText value={value} className={strong ? 'font-semibold' : undefined} />
      </dd>
    </div>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-3 dark:divide-slate-700 dark:border-slate-700">
        {children}
      </dl>
    </section>
  );
}

export function BoletaPagoDetail({
  pago,
  showEmployee = false,
}: {
  pago: PagoPlanilla;
  showEmployee?: boolean;
}) {
  return (
    <div className="space-y-4">
      <dl className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Periodo</dt>
          <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
            <PeriodText periodo={pago.periodo} />
          </dd>
        </div>
        {showEmployee ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Funcionario
            </dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
              {pago.empleado.nombreCompleto}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Días trabajados
          </dt>
          <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{pago.diasTrabajados}</dd>
        </div>
        {showEmployee && pago.empleado.ciEnmascarado ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">CI</dt>
            <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
              {pago.empleado.ciEnmascarado}
            </dd>
          </div>
        ) : null}
      </dl>

      <DetailSection title="Haberes">
        <DetailRow label="Haber básico" value={pago.haberes.haberBasico} />
        <DetailRow label="Bono de antigüedad" value={pago.haberes.bonoAntiguedad} />
        <DetailRow label="Otros ingresos" value={pago.haberes.otrosIngresos} />
        <DetailRow label="Total ganado" value={pago.haberes.totalGanado} strong />
      </DetailSection>

      <DetailSection title="Descuentos">
        <DetailRow label="Aporte laboral" value={pago.descuentos.aporteLaboral} />
        <DetailRow label="Aporte nacional solidario" value={pago.descuentos.ans} />
        <DetailRow label="RC-IVA" value={pago.descuentos.rcIva} />
        <DetailRow label="Otros descuentos" value={pago.descuentos.otrosDescuentos} />
        <DetailRow label="Total descuentos" value={pago.descuentos.totalDescuentos} strong />
      </DetailSection>

      <section className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            Líquido pagable
          </span>
          <MoneyText
            value={pago.liquidoPagable}
            className="text-base font-semibold text-blue-900 dark:text-blue-100"
          />
        </div>
      </section>

      <DetailSection title="Informativos">
        <DetailRow label="Aporte patronal (empleador)" value={pago.aportePatronal} />
      </DetailSection>
      {Object.keys(pago.subsidiosInformativos).length ? (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Subsidios informativos
          </h3>
          <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 px-3 dark:divide-slate-700 dark:border-slate-700">
            {Object.entries(pago.subsidiosInformativos).map(([concepto, monto]) => (
              <DetailRow key={concepto} label={concepto} value={monto} />
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Los subsidios y el aporte patronal no modifican el líquido pagable.
          </p>
        </section>
      ) : null}
    </div>
  );
}
