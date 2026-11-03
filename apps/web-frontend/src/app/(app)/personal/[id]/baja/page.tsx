'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileUp, ShieldAlert } from 'lucide-react';
import { AdminPageTitle, ErrorBanner } from '@/components/admin/admin-components';
import {
  EmployeeCard,
  EmployeeProtectionAlert,
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
import { useAuth } from '@/components/auth/auth-provider';
import { useEmployee } from '@/hooks/use-personal';
import { AUTH_MODE } from '@/lib/auth';
import {
  activeProtections,
  calculateTerminationSettlement,
  formatMoney,
  isAuthorizationFile,
  personalApi,
} from '@/lib/personal-api';

const today = () => new Date().toISOString().slice(0, 10);

export default function EmployeeTerminationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { request, session } = useAuth();
  const { employee, loading, error: loadError } = useEmployee(id);
  const canReadSalary = session?.user.permissions.includes('personal:read_salary') ?? false;
  const [fechaBaja, setFechaBaja] = useState(today());
  const [motivo, setMotivo] = useState('');
  const [sueldoPromedio, setSueldoPromedio] = useState('');
  const [vacationDays, setVacationDays] = useState('0');
  const [aplicaDesahucio, setAplicaDesahucio] = useState(false);
  const [authorization, setAuthorization] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const protections = employee ? activeProtections(employee) : [];
  const hasProtection = protections.length > 0;
  const basicSalary = employee?.remuneracion ?? 0;
  const effectiveAverageSalary = sueldoPromedio === '' ? basicSalary : Number(sueldoPromedio);
  const settlement = useMemo(
    () =>
      employee
        ? calculateTerminationSettlement(
            employee,
            fechaBaja,
            effectiveAverageSalary,
            Number(vacationDays) || 0,
            aplicaDesahucio,
          )
        : null,
    [employee, fechaBaja, effectiveAverageSalary, vacationDays, aplicaDesahucio],
  );

  const selectAuthorization = (file?: File) => {
    if (!file) return;
    if (!isAuthorizationFile(file)) {
      setAuthorization(null);
      setError('La autorización debe ser un archivo PDF de máximo 10 MiB.');
      return;
    }
    setError(null);
    setAuthorization(file);
  };

  const review = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (hasProtection && !authorization) {
      setError('La inamovilidad está activa. Adjunta la autorización del Ministerio de Trabajo para continuar.');
      return;
    }
    if (!canReadSalary) {
      setError('Tu rol no tiene permiso para consultar los datos salariales requeridos para calcular el finiquito.');
      return;
    }
    if (!settlement || settlement.sueldoPromedio <= 0) {
      setError('El sueldo promedio indemnizable debe ser mayor a cero.');
      return;
    }
    setConfirmOpen(true);
  };

  const confirmTermination = async () => {
    if (!employee || !settlement) return;
    setError(null);
    setSaving(true);
    try {
      await personalApi.terminateEmployee(
        request,
        employee.id,
        { ...settlement, motivo: motivo.trim() },
        authorization ?? undefined,
      );
      router.replace(`/personal/${employee.id}`);
    } catch (reason) {
      setConfirmOpen(false);
      setError(reason instanceof Error ? reason.message : 'No se pudo registrar la baja.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="body-default text-muted-foreground">Cargando expediente…</p>;
  if (loadError || !employee) {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorBanner message={loadError ?? 'No se encontró el funcionario.'} />
        <Button asChild variant="outline"><Link href="/personal">Volver a Personal</Link></Button>
      </div>
    );
  }
  if (employee.estado === 'INACTIVO') {
    return (
      <div className="mx-auto max-w-4xl">
        <ErrorBanner message="Este funcionario ya se encuentra dado de baja." />
        <Button asChild variant="outline">
          <Link href={`/personal/${employee.id}`}>Volver al expediente</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link href={`/personal/${employee.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Volver al expediente
        </Link>
      </Button>
      <AdminPageTitle
        eyebrow="Cierre de relación laboral"
        title="Dar de baja"
        description={`Prepara el cálculo del finiquito de ${employee.nombres} ${employee.apellidos} antes de confirmar.`}
      />
      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: la baja cambia el estado del funcionario a Inactivo solo al confirmar.
        </div>
      )}
      {error && <ErrorBanner message={error} />}
      {hasProtection && (
        <div className="mb-5 space-y-3">
          <EmployeeProtectionAlert protections={protections} />
          <div className="flex items-start gap-3 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] p-4 text-[hsl(var(--warning))]">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="body-default">
              La baja está bloqueada por inamovilidad activa. Solo puedes continuar adjuntando la autorización del Ministerio de Trabajo.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={review} className="space-y-5">
        <EmployeeCard
          title="Datos de la baja"
          description="Registra la fecha, el motivo y la base de cálculo."
          icon="work"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="caption-small font-medium">Fecha de baja *</span>
              <Input
                type="date"
                required
                value={fechaBaja}
                onChange={(event) => setFechaBaja(event.target.value)}
              />
            </label>
            <label className="space-y-1.5">
              <span className="caption-small font-medium">Motivo *</span>
              <Input
                required
                minLength={3}
                maxLength={500}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                placeholder="Motivo de la baja"
              />
            </label>
            <label className="space-y-1.5">
              <span className="caption-small font-medium">Sueldo promedio indemnizable (Bs) *</span>
              <Input
                type="number"
                required
                min="0"
                step="0.01"
                value={sueldoPromedio}
                onChange={(event) => setSueldoPromedio(event.target.value)}
                placeholder={String(basicSalary)}
              />
              <span className="caption-small text-muted-foreground">
                Base inicial: haber básico {formatMoney(basicSalary)} (se reemplaza por promedio de 3 meses cuando exista).
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="caption-small font-medium">Días de vacaciones pendientes</span>
              <Input
                type="number"
                min="0"
                max="365"
                step="0.5"
                value={vacationDays}
                onChange={(event) => setVacationDays(event.target.value)}
              />
              <span className="caption-small text-muted-foreground">
                Ingresa el saldo confirmado para incluirlo en la liquidación.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-md border border-border p-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={aplicaDesahucio}
                onChange={(event) => setAplicaDesahucio(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-input text-secondary focus:ring-ring"
              />
              <span>
                <span className="block body-medium">Aplica desahucio</span>
                <span className="caption-small text-muted-foreground">
                  Incluye 3 × sueldo promedio indemnizable únicamente si corresponde.
                </span>
              </span>
            </label>
          </div>
        </EmployeeCard>

        {hasProtection && (
          <EmployeeCard
            title="Autorización del Ministerio"
            description="Obligatoria para continuar mientras exista inamovilidad activa."
            icon="protection"
          >
            <label
              htmlFor="authorization"
              className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input bg-muted/40 p-4 hover:border-secondary"
            >
              <FileUp className="h-6 w-6 text-secondary" />
              <span>
                <span className="block body-medium">
                  {authorization?.name ?? 'Adjuntar autorización (PDF)'}
                </span>
                <span className="caption-small text-muted-foreground">Máximo 10 MiB</span>
              </span>
            </label>
            <input
              id="authorization"
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              onChange={(event) => selectAuthorization(event.target.files?.[0])}
            />
            {authorization && (
              <p className="caption-small mt-2 text-[hsl(var(--success))]">
                Autorización adjunta · {(authorization.size / 1024).toFixed(0)} KiB
              </p>
            )}
          </EmployeeCard>
        )}

        {settlement && canReadSalary && (
          <EmployeeCard
            title="Previsualización del finiquito"
            description="Estimación con el sueldo promedio indicado y los saldos ingresados."
            icon="signature"
          >
            <dl className="space-y-3">
              <div className="flex justify-between gap-3 body-default">
                <dt className="text-muted-foreground">Indemnización proporcional</dt>
                <dd className="font-medium">{formatMoney(settlement.finiquitoDetalle.indemnizacion)}</dd>
              </div>
              <div className="flex justify-between gap-3 body-default">
                <dt className="text-muted-foreground">Desahucio</dt>
                <dd className="font-medium">{formatMoney(settlement.finiquitoDetalle.desahucio)}</dd>
              </div>
              <div className="flex justify-between gap-3 body-default">
                <dt className="text-muted-foreground">Aguinaldo proporcional</dt>
                <dd className="font-medium">{formatMoney(settlement.finiquitoDetalle.aguinaldoProporcional)}</dd>
              </div>
              <div className="flex justify-between gap-3 body-default">
                <dt className="text-muted-foreground">
                  Vacaciones pendientes ({settlement.finiquitoDetalle.diasVacacionesPendientes} días)
                </dt>
                <dd className="font-medium">{formatMoney(settlement.finiquitoDetalle.vacacionesPendientes)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-border pt-3 body-medium">
                <dt>Total estimado</dt>
                <dd className="text-secondary">{formatMoney(settlement.finiquitoTotal)}</dd>
              </div>
            </dl>
            <p className="caption-small mt-4 text-muted-foreground">
              Es una previsualización para la demo; el resultado definitivo debe validarse con el backend y las reglas vigentes.
            </p>
          </EmployeeCard>
        )}

        {!canReadSalary && (
          <ErrorBanner message="Este perfil no tiene permiso para consultar remuneraciones y finiquitos." />
        )}

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline">
            <Link href={`/personal/${employee.id}`}>Cancelar</Link>
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={!canReadSalary || (hasProtection && !authorization)}
          >
            Revisar finiquito y continuar
          </Button>
        </div>
      </form>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar baja de funcionario</DialogTitle>
            <DialogDescription>
              Esta acción registra la baja y no se puede deshacer desde esta pantalla.
            </DialogDescription>
          </DialogHeader>
          {settlement && (
            <div className="my-4 rounded-md bg-muted p-4">
              <p className="body-medium">{employee.nombres} {employee.apellidos}</p>
              <p className="caption-small mt-1 text-muted-foreground">
                Fecha de baja: {new Intl.DateTimeFormat('es-BO').format(
                  new Date(`${fechaBaja}T00:00:00`),
                )}
              </p>
              <p className="mt-3 body-medium">
                Finiquito estimado: {formatMoney(settlement.finiquitoTotal)}
              </p>
              {hasProtection && (
                <p className="caption-small mt-2 text-[hsl(var(--warning))]">
                  Se adjuntará la autorización ministerial.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Volver
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => void confirmTermination()}
            >
              {saving ? 'Procesando…' : 'Confirmar baja'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
