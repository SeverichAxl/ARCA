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
      <dt className={strong ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
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
      <h3 className="mb-1 text-sm font-semibold text-foreground">{title}</h3>
      <dl className="divide-y divide-border rounded-lg border border-border px-3">
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
      <dl className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Periodo</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            <PeriodText periodo={pago.periodo} />
          </dd>
        </div>
        {showEmployee ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Funcionario
            </dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {pago.empleado.nombreCompleto}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Días trabajados
          </dt>
          <dd className="mt-0.5 text-foreground">{pago.diasTrabajados}</dd>
        </div>
        {showEmployee && pago.empleado.ciEnmascarado ? (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">CI</dt>
            <dd className="mt-0.5 text-foreground">
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

      <section className="rounded-lg border border-primary/30 bg-primary/12 px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[hsl(var(--success))]">
            Líquido pagable
          </span>
          <MoneyText
            value={pago.liquidoPagable}
            className="text-base font-semibold text-[hsl(var(--success))]"
          />
        </div>
      </section>

      <DetailSection title="Informativos">
        <DetailRow label="Aporte patronal (empleador)" value={pago.aportePatronal} />
      </DetailSection>
      {Object.keys(pago.subsidiosInformativos).length ? (
        <section>
          <h3 className="mb-1 text-sm font-semibold text-foreground">
            Subsidios informativos
          </h3>
          <dl className="divide-y divide-border rounded-lg border border-border px-3">
            {Object.entries(pago.subsidiosInformativos).map(([concepto, monto]) => (
              <DetailRow key={concepto} label={concepto} value={monto} />
            ))}
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            Los subsidios y el aporte patronal no modifican el líquido pagable.
          </p>
        </section>
      ) : null}
    </div>
  );
}
