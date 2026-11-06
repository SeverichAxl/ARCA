'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { AdminPageTitle, ErrorBanner } from '@/components/admin/admin-components';
import { EmployeeCard } from '@/components/personal/employee-components';
import { useAuth } from '@/components/auth/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEmployee, useEmployeeCatalogs } from '@/hooks/use-personal';
import { AUTH_MODE } from '@/lib/auth';
import { personalApi, type EmployeeUpdateInput } from '@/lib/personal-api';

export default function UpdateEmployeePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { request } = useAuth();
  const { employee, loading, error: loadError } = useEmployee(id);
  const { areas, cargos, loading: catalogsLoading, error: catalogsError } = useEmployeeCatalogs();
  const [areaId, setAreaId] = useState('');
  const [cargoId, setCargoId] = useState('');
  const [remuneracion, setRemuneracion] = useState('');
  const [fechaEfectiva, setFechaEfectiva] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!employee) return;
    setAreaId(employee.areaId);
    setCargoId(employee.cargoId);
    setRemuneracion(employee.remuneracion === null || employee.remuneracion === undefined
      ? ''
      : String(employee.remuneracion));
  }, [employee]);

  const eligiblePositions = cargos.filter((position) => !position.areaId || position.areaId === areaId);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employee) return;
    setError(null);
    const input: EmployeeUpdateInput = {
      fechaEfectiva,
      motivo: motivo.trim(),
      ...(areaId !== employee.areaId ? { areaId } : {}),
      ...(cargoId !== employee.cargoId ? { cargoId } : {}),
      ...(remuneracion !== '' &&
      Number(remuneracion) !== Number(employee.remuneracion)
        ? { remuneracion: Number(remuneracion) }
        : {}),
    };
    if (!input.areaId && !input.cargoId && input.remuneracion === undefined) {
      setError('Modifica al menos un dato laboral antes de guardar.');
      return;
    }

    setSaving(true);
    try {
      await personalApi.updateEmployee(request, employee.id, input);
      router.replace(`/personal/${employee.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se pudieron guardar los cambios.');
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

  const disabled = employee.estado === 'INACTIVO';

  return (
    <div className="mx-auto max-w-4xl">
      <Button asChild variant="ghost" className="mb-3 -ml-3">
        <Link href={`/personal/${employee.id}`}>
          <ArrowLeft className="h-4 w-4" />
          Volver al expediente
        </Link>
      </Button>
      <AdminPageTitle
        eyebrow="Movimiento laboral"
        title="Modificar funcionario"
        description={`Actualiza el área, cargo o haber básico de ${employee.nombres} ${employee.apellidos}.`}
      />
      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: el cambio se añadirá al historial laboral de esta sesión.
        </div>
      )}
      {error && <ErrorBanner message={error} />}
      {catalogsError && <ErrorBanner message={catalogsError} />}
      {disabled && <ErrorBanner message="No se puede modificar un expediente dado de baja." />}

      <form onSubmit={submit} className="space-y-5">
        <EmployeeCard
          title="Nueva asignación laboral"
          description="Los datos omitidos permanecerán sin cambios."
          icon="work"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="caption-small font-medium">Área</span>
              <select
                value={areaId}
                onChange={(event) => {
                  setAreaId(event.target.value);
                  if (cargos.some((position) => position.id === cargoId && position.areaId !== event.target.value)) {
                    setCargoId('');
                  }
                }}
                disabled={catalogsLoading || disabled}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                {areas.map((area) => <option key={area.id} value={area.id}>{area.nombre}</option>)}
              </select>
              <span className="caption-small text-muted-foreground">
                Actual: {employee.area?.nombre ?? 'No disponible'}
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="caption-small font-medium">Cargo</span>
              <select
                value={cargoId}
                onChange={(event) => setCargoId(event.target.value)}
                disabled={catalogsLoading || disabled}
                className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
              >
                {eligiblePositions.map((position) => <option key={position.id} value={position.id}>{position.nombre}</option>)}
              </select>
              <span className="caption-small text-muted-foreground">
                Actual: {employee.cargo?.nombre ?? 'No disponible'}
              </span>
            </label>
            <label className="space-y-1.5">
              <span className="caption-small font-medium">Haber básico (Bs)</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={remuneracion}
                onChange={(event) => setRemuneracion(event.target.value)}
                disabled={disabled}
              />
              <span className="caption-small text-muted-foreground">
                Actual: {employee.remuneracion === null || employee.remuneracion === undefined
                  ? 'No disponible'
                  : `Bs ${Number(employee.remuneracion).toFixed(2)}`}
              </span>
            </label>
          </div>
        </EmployeeCard>

        <EmployeeCard
          title="Vigencia y motivo"
          description="Estos datos quedan registrados en el historial laboral."
          icon="signature"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="caption-small font-medium">Fecha efectiva *</span>
              <Input
                type="date"
                required
                value={fechaEfectiva}
                onChange={(event) => setFechaEfectiva(event.target.value)}
                disabled={disabled}
              />
            </label>
            <label className="space-y-1.5 sm:col-span-2">
              <span className="caption-small font-medium">Motivo *</span>
              <textarea
                required
                minLength={3}
                maxLength={500}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
                disabled={disabled}
                className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 body-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe el motivo del cambio laboral"
              />
            </label>
          </div>
        </EmployeeCard>

        <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button asChild type="button" variant="outline">
            <Link href={`/personal/${employee.id}`}>Cancelar</Link>
          </Button>
          <Button type="submit" disabled={saving || disabled || catalogsLoading}>
            {saving ? 'Guardando…' : 'Guardar modificación'}
          </Button>
        </div>
      </form>
    </div>
  );
}
