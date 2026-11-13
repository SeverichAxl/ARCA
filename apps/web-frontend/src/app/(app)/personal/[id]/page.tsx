'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  CalendarCheck2,
  FileText,
  Pencil,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AdminPageTitle, ErrorBanner } from '@/components/admin/admin-components';
import { EmptyState } from '@/components/empty-state';
import { EmployeeContractsPanel } from '@/components/personal/employee-contracts-panel';
import {
  EmployeeCard,
  EmployeeField,
  EmployeeProtectionAlert,
  EmployeeProtectionBadges,
  EmployeeStatusBadge,
  SalaryValue,
} from '@/components/personal/employee-components';
import { ErrorAlert } from '@/components/shared/error-alert';
import { LoadingSkeleton } from '@/components/shared/loading-skeleton';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEmployee, useEmployeeCatalogs } from '@/hooks/use-personal';
import { AUTH_MODE } from '@/lib/auth';
import { activeProtections, personalApi } from '@/lib/personal-api';
import {
  canGenerateContracts,
  canViewContracts,
  hasHistoryAmount,
  mapEmployeeFicha,
  resolveCatalogName,
  showsPayslipsTab,
} from '@/lib/personal-ficha';

const today = () => new Date().toISOString().slice(0, 10);

function getEarliestRatificationDate(fechaIngreso: string, diasPrueba = 90): string {
  const date = new Date(`${fechaIngreso}T00:00:00`);
  date.setDate(date.getDate() + diasPrueba);
  return date.toISOString().slice(0, 10);
}

function formatDateOnly(value?: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-BO').format(new Date(`${value}T00:00:00`));
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

function historyChange(
  previousId: string | null | undefined,
  nextId: string | null | undefined,
  previousName: string | null | undefined,
  nextName: string | null | undefined,
  catalog: ReadonlyMap<string, { nombre: string }>,
  neutralLabel: string,
): string | null {
  const hasPrevious = Boolean(previousId || previousName);
  const hasNext = Boolean(nextId || nextName);
  if (!hasPrevious && !hasNext) return null;

  const previous = hasPrevious
    ? resolveCatalogName(previousId, previousName, catalog, neutralLabel)
    : '';
  const next = hasNext
    ? resolveCatalogName(nextId, nextName, catalog, neutralLabel)
    : '';

  if (previous && next && previous !== next) return `${previous} → ${next}`;
  return next || previous || null;
}

export default function EmployeeDetailsPage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const { request, session } = useAuth();
  const {
    employee,
    history,
    loading,
    error,
    historyLoading,
    historyError,
    reload,
    reloadHistory,
  } = useEmployee(employeeId);
  const { areas, cargos } = useEmployeeCatalogs();
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
  const canViewEmployeeContracts = canViewContracts(permissions);
  const canGenerateEmployeeContracts = canGenerateContracts(permissions);
  const showPayslips = showsPayslipsTab(permissions);
  const protections = employee ? activeProtections(employee) : [];

  const areasById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const cargosById = useMemo(() => new Map(cargos.map((cargo) => [cargo.id, cargo])), [cargos]);
  const ficha = employee
    ? mapEmployeeFicha(employee, {
        canReadSalary,
        areas: areasById,
        cargos: cargosById,
      })
    : null;

  const earliestRatificationDate = useMemo(
    () => (employee ? getEarliestRatificationDate(employee.fechaIngreso, employee.diasPrueba) : ''),
    [employee],
  );
  const ratificationAllowed =
    !!employee &&
    employee.estado === 'EN_PRUEBA' &&
    today() >= earliestRatificationDate;

  const catalogNamesUnavailable =
    ficha?.area === 'Área no disponible' || ficha?.cargo === 'Cargo no disponible';

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

  const fullName = ficha?.fullName ?? '';

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
        description="Ficha consolidada: datos personales, trayectoria, contratos, licencias y boletas."
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
            Ratificación habilitada desde el {formatDateOnly(earliestRatificationDate)}
          </span>
        )}
      </div>

      {protections.length > 0 && <div className="mb-5"><EmployeeProtectionAlert protections={protections} /></div>}

      <Tabs defaultValue="datos">
        <TabsList className="mb-5 flex h-auto w-full flex-wrap justify-start gap-1 p-1">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="trayectoria">Trayectoria</TabsTrigger>
          {(canViewEmployeeContracts || canGenerateEmployeeContracts) && (
            <TabsTrigger value="contratos">Contratos</TabsTrigger>
          )}
          <TabsTrigger value="licencias">Licencias</TabsTrigger>
          {showPayslips && <TabsTrigger value="boletas">Boletas</TabsTrigger>}
        </TabsList>

        <TabsContent value="datos" className="space-y-5">
          <div className="grid gap-5 lg:grid-cols-2">
            <EmployeeCard title="Datos personales" description="Identificación y contacto." icon="personal">
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <EmployeeField label="Nombres" value={employee.nombres} />
                <EmployeeField label="Apellidos" value={employee.apellidos} />
                <EmployeeField label="Cédula de identidad" value={ficha?.ci} />
                <EmployeeField label="CI expedida en" value={employee.ciExpedido} />
                <EmployeeField
                  label="Fecha de nacimiento"
                  value={employee.fechaNacimiento ? formatDateOnly(employee.fechaNacimiento) : '—'}
                />
                <EmployeeField label="Correo electrónico" value={employee.email} />
                <EmployeeField label="Teléfono" value={employee.telefono} />
                <EmployeeField label="Dirección" value={employee.direccion} />
                <EmployeeField label="Funcionario extranjero" value={employee.esExtranjero ? 'Sí' : 'No'} />
              </dl>
            </EmployeeCard>

            <EmployeeCard title="Datos laborales" description="Situación y asignación actual." icon="work">
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <EmployeeField label="Área" value={ficha?.area} />
                <EmployeeField label="Cargo" value={ficha?.cargo} />
                <EmployeeField label="Fecha de ingreso" value={formatDateOnly(employee.fechaIngreso)} />
                <EmployeeField label="Estado" value={<EmployeeStatusBadge status={employee.estado} />} />
                {ficha?.remuneracion !== undefined && (
                  <EmployeeField label="Haber básico" value={<SalaryValue amount={ficha.remuneracion} />} />
                )}
                <EmployeeField
                  label="Periodo de prueba"
                  value={`${employee.diasPrueba ?? 90} días`}
                />
                {employee.fechaRatificacion && (
                  <EmployeeField
                    label="Fecha de ratificación"
                    value={formatDateOnly(employee.fechaRatificacion)}
                  />
                )}
                <EmployeeField label="Firma gráfica" value={employee.firmaDisponible ? 'Registrada' : 'No disponible'} />
              </dl>
              {catalogNamesUnavailable && (
                <p className="caption-small mt-4 text-muted-foreground">
                  Los nombres de área y cargo no están disponibles para tu rol. Se muestran
                  etiquetas neutrales en lugar de inventar datos.
                </p>
              )}
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
                        Desde {formatDateOnly(protection.fechaInicio)}
                        {protection.fechaFin
                          ? ` hasta ${formatDateOnly(protection.fechaFin)}`
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

            <EmployeeCard
              title="Resumen del expediente"
              description="Datos clave para la revisión del funcionario."
              icon="signature"
            >
              <dl className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
                <EmployeeField label="Identificador" value={employee.codigo ?? employee.id} />
                <EmployeeField label="Fecha de ingreso" value={formatDateOnly(employee.fechaIngreso)} />
                <EmployeeField
                  label="Días de prueba"
                  value={`${employee.diasPrueba ?? 90} días`}
                />
                <EmployeeField
                  label="Protección activa"
                  value={protections.length ? `${protections.length} registro(s)` : 'Sin protección activa'}
                />
              </dl>
            </EmployeeCard>
          </div>
        </TabsContent>

        <TabsContent value="trayectoria">
          <EmployeeCard
            title="Trayectoria laboral"
            description="Altas, modificaciones, ratificaciones y bajas del expediente."
            icon="signature"
          >
            {historyLoading ? (
              <LoadingSkeleton variant="table" rows={4} />
            ) : historyError ? (
              <ErrorAlert
                error={historyError}
                title="No se pudo cargar la trayectoria laboral"
                onRetry={() => void reloadHistory()}
              />
            ) : history.length ? (
              <ol className="space-y-4">
                {history.map((entry) => {
                  const areaChange = historyChange(
                    entry.areaAnteriorId,
                    entry.areaNuevaId,
                    entry.areaAnterior,
                    entry.areaNueva,
                    areasById,
                    'Área no disponible',
                  );
                  const cargoChange = historyChange(
                    entry.cargoAnteriorId,
                    entry.cargoNuevoId,
                    entry.cargoAnterior,
                    entry.cargoNuevo,
                    cargosById,
                    'Cargo no disponible',
                  );
                  const showPreviousAmount =
                    canReadSalary && hasHistoryAmount(entry.remuneracionAnterior);
                  const showNextAmount =
                    canReadSalary && hasHistoryAmount(entry.remuneracionNueva);

                  return (
                    <li key={entry.id} className="relative border-l border-border pb-1 pl-4">
                      <span className="absolute -left-1 top-1 h-2 w-2 rounded-full bg-secondary" />
                      <p className="body-medium">{historyLabel(entry.tipo)}</p>
                      <p className="caption-small mt-1 text-muted-foreground">
                        {entry.fechaEfectiva ? formatDateOnly(entry.fechaEfectiva) : 'Fecha no disponible'}
                        {entry.motivo ? ` · ${entry.motivo}` : ''}
                      </p>
                      {(areaChange || cargoChange) && (
                        <div className="caption-small mt-1 space-y-0.5 text-muted-foreground">
                          {areaChange && <p>Área: {areaChange}</p>}
                          {cargoChange && <p>Cargo: {cargoChange}</p>}
                        </div>
                      )}
                      {(showPreviousAmount || showNextAmount) && (
                        <p className="caption-small mt-1 text-muted-foreground">
                          Haber: {showPreviousAmount ? <SalaryValue amount={entry.remuneracionAnterior} /> : '—'}{' '}
                          → {showNextAmount ? <SalaryValue amount={entry.remuneracionNueva} /> : '—'}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="body-default text-muted-foreground">No hay movimientos registrados.</p>
            )}
          </EmployeeCard>
        </TabsContent>

        {(canViewEmployeeContracts || canGenerateEmployeeContracts) && (
          <TabsContent value="contratos">
            <EmployeeContractsPanel
              employeeId={employee.id}
              canView={canViewEmployeeContracts}
              canGenerate={canGenerateEmployeeContracts}
            />
          </TabsContent>
        )}

        <TabsContent value="licencias">
          <EmployeeCard
            title="Licencias"
            description="Licencias y permisos registrados para el funcionario."
            icon="protection"
          >
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No disponible todavía"
              description="El servicio de vacaciones aún no expone un endpoint de licencias por funcionario. La sección se habilitará cuando el backend lo publique."
              badge={null}
            />
          </EmployeeCard>
        </TabsContent>

        {showPayslips && (
          <TabsContent value="boletas">
            <EmployeeCard
              title="Boletas de pago"
              description="Historial de boletas emitidas al funcionario."
              icon="work"
            >
              <EmptyState
                icon={<ReceiptText className="h-6 w-6" />}
                title="No disponible todavía"
                description="Todavía no existe un endpoint para listar las boletas de un funcionario desde su ficha. La consulta por planilla sigue disponible en el módulo de boletas."
                badge={null}
              />
            </EmployeeCard>
          </TabsContent>
        )}
      </Tabs>

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
