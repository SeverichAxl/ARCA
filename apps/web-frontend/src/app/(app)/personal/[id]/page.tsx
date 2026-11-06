'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Ban, CalendarCheck2, Pencil, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AdminPageTitle, ErrorBanner } from '@/components/admin/admin-components';
import {
  EmployeeCard,
  EmployeeField,
  EmployeeProtectionAlert,
  EmployeeProtectionBadges,
  EmployeeStatusBadge,
  SalaryValue,
} from '@/components/personal/employee-components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useEmployee } from '@/hooks/use-personal';
import { AUTH_MODE } from '@/lib/auth';
import { activeProtections, personalApi } from '@/lib/personal-api';

const today = () => new Date().toISOString().slice(0, 10);

function getEarliestRatificationDate(fechaIngreso: string, diasPrueba = 90): string {
  const date = new Date(`${fechaIngreso}T00:00:00`);
  date.setDate(date.getDate() + diasPrueba);
  return date.toISOString().slice(0, 10);
}

function historyLabel(type?: string): string {
  const labels: Record<string, string> = {
    ALTA: 'Alta de funcionario',
    MODIFICACION: 'Modificación laboral',
    RATIFICACION: 'Ratificación',
    BAJA: 'Baja de funcionario',
  };
  return (type && labels[type]) || type || 'Movimiento laboral';
}

export default function EmployeeDetailsPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const router = useRouter();
  const { request, session } = useAuth();
  const { employee, history, loading, error, reload } = useEmployee(employeeId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [ratificationDate, setRatificationDate] = useState(today());
  const [ratificationReason, setRatificationReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const permissions = session?.user.permissions ?? [];
  const canUpdate = permissions.includes('personal:update');
  const canRatify = permissions.includes('personal:ratify');
  const canTerminate = permissions.includes('personal:baja');
  const canReadSalary = permissions.includes('personal:read_salary');
  const protections = employee ? activeProtections(employee) : [];
  const earliestRatificationDate = useMemo(
    () => (employee ? getEarliestRatificationDate(employee.fechaIngreso, employee.diasPrueba) : ''),
    [employee],
  );
  const ratificationAllowed =
    !!employee &&
    employee.estado === 'EN_PRUEBA' &&
    today() >= earliestRatificationDate;

  const ratify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employee) return;
    setActionError(null);
    setSaving(true);
    try {
      await personalApi.ratifyEmployee(
        request,
        employee.id,
        ratificationDate,
        ratificationReason,
      );
      setDialogOpen(false);
      setRatificationReason('');
      await reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'No se pudo ratificar al funcionario.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="body-default text-muted-foreground">Cargando expediente…</p>;
  }
  if (error || !employee) {
    return (
      <div className="mx-auto max-w-6xl">
        <ErrorBanner message={error ?? 'No se encontró el funcionario.'} />
        <Button asChild variant="outline">
          <Link href="/personal">
            <ArrowLeft className="h-4 w-4" />
            Volver a Personal
          </Link>
        </Button>
      </div>
    );
  }

  const fullName = `${employee.nombres} ${employee.apellidos}`;

  return (
    <div className="mx-auto max-w-6xl">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link href="/personal">
          <ArrowLeft className="h-4 w-4" />
          Volver a Personal
        </Link>
      </Button>
      <AdminPageTitle
        eyebrow={employee.codigo ?? `Expediente ${employee.id.slice(0, 8)}`}
        title={fullName}
        description="Expediente personal, laboral y movimientos registrados."
        action={
          <div className="flex flex-wrap gap-2">
            {canUpdate && employee.estado !== 'INACTIVO' && (
              <Button asChild variant="outline" className="gap-2">
                <Link href={`/personal/${employee.id}/modificar`}>
                  <Pencil className="h-4 w-4" />
                  Modificar
                </Link>
              </Button>
            )}
            {canRatify && employee.estado === 'EN_PRUEBA' && (
              <Button
                className="gap-2"
                disabled={!ratificationAllowed}
                onClick={() => {
                  setRatificationDate(earliestRatificationDate > today() ? earliestRatificationDate : today());
                  setDialogOpen(true);
                }}
              >
                <CalendarCheck2 className="h-4 w-4" />
                Ratificar
              </Button>
            )}
            {canTerminate && employee.estado !== 'INACTIVO' && (
              <Button asChild variant="destructive" className="gap-2">
                <Link href={`/personal/${employee.id}/baja`}>
                  <Ban className="h-4 w-4" />
                  Dar de baja
                </Link>
              </Button>
            )}
          </div>
        }
      />

      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: los cambios se conservan en esta sesión del navegador.
        </div>
      )}
      {actionError && <ErrorBanner message={actionError} />}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <EmployeeStatusBadge status={employee.estado} />
        <EmployeeProtectionBadges employee={employee} />
        {employee.estado === 'EN_PRUEBA' && !ratificationAllowed && (
          <span className="caption-small text-muted-foreground">
            Ratificación habilitada desde el {new Intl.DateTimeFormat('es-BO').format(
              new Date(`${earliestRatificationDate}T00:00:00`),
            )}
          </span>
        )}
      </div>

      {protections.length > 0 && <div className="mb-5"><EmployeeProtectionAlert protections={protections} /></div>}

      <div className="grid gap-5 lg:grid-cols-2">
        <EmployeeCard title="Datos personales" description="Identificación y contacto." icon="personal">
          <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <EmployeeField label="Nombres" value={employee.nombres} />
            <EmployeeField label="Apellidos" value={employee.apellidos} />
            <EmployeeField label="Cédula de identidad" value={employee.ci} />
            <EmployeeField label="CI expedida en" value={employee.ciExpedido} />
            <EmployeeField
              label="Fecha de nacimiento"
              value={employee.fechaNacimiento
                ? new Intl.DateTimeFormat('es-BO').format(new Date(`${employee.fechaNacimiento}T00:00:00`))
                : '—'}
            />
            <EmployeeField label="Correo electrónico" value={employee.email} />
            <EmployeeField label="Teléfono" value={employee.telefono} />
            <EmployeeField label="Dirección" value={employee.direccion} />
            <EmployeeField label="Funcionario extranjero" value={employee.esExtranjero ? 'Sí' : 'No'} />
          </dl>
        </EmployeeCard>

        <EmployeeCard title="Datos laborales" description="Situación y asignación actual." icon="work">
          <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            <EmployeeField label="Área" value={employee.area?.nombre} />
            <EmployeeField label="Cargo" value={employee.cargo?.nombre} />
            <EmployeeField
              label="Fecha de ingreso"
              value={new Intl.DateTimeFormat('es-BO').format(new Date(`${employee.fechaIngreso}T00:00:00`))}
            />
            <EmployeeField label="Estado" value={<EmployeeStatusBadge status={employee.estado} />} />
            {canReadSalary && <EmployeeField label="Haber básico" value={<SalaryValue amount={employee.remuneracion} />} />}
            <EmployeeField
              label="Periodo de prueba"
              value={`${employee.diasPrueba ?? 90} días`}
            />
            {employee.fechaRatificacion && (
              <EmployeeField
                label="Fecha de ratificación"
                value={new Intl.DateTimeFormat('es-BO').format(
                  new Date(`${employee.fechaRatificacion}T00:00:00`),
                )}
              />
            )}
            <EmployeeField label="Firma gráfica" value={employee.firmaDisponible ? 'Registrada' : 'No disponible'} />
          </dl>
        </EmployeeCard>

        <EmployeeCard
          title="Inamovilidad laboral"
          description="Marcas y periodos de protección registrados."
          icon="protection"
        >
          {employee.inamovilidades?.length ? (
            <div className="space-y-3">
              {employee.inamovilidades.map((protection) => (
                <div
                  key={protection.id ?? `${protection.tipo}-${protection.fechaInicio}`}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-center gap-2 body-medium">
                    <ShieldCheck className="h-4 w-4 text-secondary" />
                    {protection.tipo.replaceAll('_', ' ')}
                    {protection.estadoActivo === false && (
                      <span className="caption-small text-muted-foreground">Cerrada</span>
                    )}
                  </div>
                  <p className="caption-small mt-2 text-muted-foreground">
                    Desde {new Intl.DateTimeFormat('es-BO').format(
                      new Date(`${protection.fechaInicio}T00:00:00`),
                    )}
                    {protection.fechaFin
                      ? ` hasta ${new Intl.DateTimeFormat('es-BO').format(
                          new Date(`${protection.fechaFin}T00:00:00`),
                        )}`
                      : ' · Sin fecha de cierre'}
                  </p>
                  {protection.observacion && (
                    <p className="caption-small mt-1 text-muted-foreground">{protection.observacion}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="body-default text-muted-foreground">No hay marcas de inamovilidad registradas.</p>
          )}
        </EmployeeCard>

        <EmployeeCard title="Historial laboral" description="Registro de cambios del expediente." icon="signature">
          {history.length ? (
            <ol className="space-y-4">
              {history.map((entry) => (
                <li key={entry.id} className="relative border-l border-border pb-1 pl-4">
                  <span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-secondary" />
                  <p className="body-medium">{historyLabel(entry.tipo)}</p>
                  <p className="caption-small mt-1 text-muted-foreground">
                    {entry.fechaEfectiva
                      ? new Intl.DateTimeFormat('es-BO').format(new Date(`${entry.fechaEfectiva}T00:00:00`))
                      : 'Fecha no disponible'}
                    {entry.motivo ? ` · ${entry.motivo}` : ''}
                  </p>
                  {(entry.areaNueva || entry.cargoNuevo) && (
                    <p className="caption-small mt-1 text-muted-foreground">
                      {[entry.areaNueva, entry.cargoNuevo].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {canReadSalary &&
                    (entry.remuneracionAnterior !== undefined ||
                      entry.remuneracionNueva !== undefined) && (
                      <p className="caption-small mt-1 text-muted-foreground">
                        Haber: {entry.remuneracionAnterior !== undefined
                          ? <SalaryValue amount={entry.remuneracionAnterior} />
                          : '—'}{' '}
                        → {entry.remuneracionNueva !== undefined
                          ? <SalaryValue amount={entry.remuneracionNueva} />
                          : '—'}
                      </p>
                    )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="body-default text-muted-foreground">No hay movimientos registrados.</p>
          )}
        </EmployeeCard>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={ratify}>
            <DialogHeader>
              <DialogTitle>Ratificar funcionario</DialogTitle>
              <DialogDescription>
                La ratificación solo puede hacerse después de cumplir los {employee.diasPrueba ?? 90} días de prueba.
              </DialogDescription>
            </DialogHeader>
            {actionError && <ErrorBanner message={actionError} />}
            <div className="my-5 space-y-4">
              <label className="block space-y-1.5">
                <span className="caption-small font-medium">Fecha de ratificación *</span>
                <Input
                  type="date"
                  required
                  min={earliestRatificationDate}
                  value={ratificationDate}
                  onChange={(event) => setRatificationDate(event.target.value)}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="caption-small font-medium">Motivo</span>
                <Input
                  maxLength={250}
                  value={ratificationReason}
                  onChange={(event) => setRatificationReason(event.target.value)}
                  placeholder="Motivo u observación"
                />
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Ratificando…' : 'Confirmar ratificación'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
