'use client';

import { useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Search, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AdminPageTitle,
  ErrorBanner,
  PaginationControls,
} from '@/components/admin/admin-components';
import {
  EmployeeProtectionBadges,
  EmployeeStatusBadge,
  SalaryValue,
} from '@/components/personal/employee-components';
import { useAuth } from '@/components/auth/auth-provider';
import { useEmployeeCatalogs, useEmployeeList } from '@/hooks/use-personal';
import { AUTH_MODE } from '@/lib/auth';
import type { EmployeeFilters } from '@/lib/personal-api';

const PAGE_SIZE = 20;

export default function PersonalPage() {
  const { session } = useAuth();
  const { areas, cargos } = useEmployeeCatalogs();
  const [search, setSearch] = useState('');
  const [areaId, setAreaId] = useState('');
  const [cargoId, setCargoId] = useState('');
  const [status, setStatus] = useState('');
  const [protection, setProtection] = useState('');
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState({
    search: '',
    areaId: '',
    cargoId: '',
    status: '',
    protection: '',
  });

  const filters = useMemo<EmployeeFilters>(() => {
    const query = applied.search.trim();
    const isCi = /^\d[\d\sA-Za-z-]*$/.test(query);
    return {
      nombre: query && !isCi ? query : '',
      ci: query && isCi ? query : '',
      areaId: applied.areaId,
      cargoId: applied.cargoId,
      estado: applied.status,
      inamovilidad: applied.protection,
      page,
      pageSize: PAGE_SIZE,
    };
  }, [applied, page]);

  const { data: employees, meta, loading, error, reload } = useEmployeeList(filters);
  const canCreate = session?.user.permissions.includes('personal:create') ?? false;
  const canReadSalary = session?.user.permissions.includes('personal:read_salary') ?? false;
  const areasById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const cargosById = useMemo(() => new Map(cargos.map((cargo) => [cargo.id, cargo])), [cargos]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setApplied({ search, areaId, cargoId, status, protection });
  };

  const clearFilters = () => {
    setSearch('');
    setAreaId('');
    setCargoId('');
    setStatus('');
    setProtection('');
    setPage(1);
    setApplied({ search: '', areaId: '', cargoId: '', status: '', protection: '' });
  };

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageTitle
        title="Personal"
        description="Gestiona la información laboral de los funcionarios."
        action={
          canCreate ? (
            <Button asChild className="h-10 gap-2">
              <Link href="/personal/nuevo">
                <UserRoundPlus className="h-4 w-4" />
                Nuevo funcionario
              </Link>
            </Button>
          ) : undefined
        }
      />

      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: puedes probar el alta, modificación, ratificación y el bloqueo por inamovilidad.
        </div>
      )}
      {error && (
        <ErrorBanner
          message={error}
        />
      )}

      <form
        onSubmit={applyFilters}
        className="mb-4 grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[minmax(190px,1fr)_repeat(4,minmax(140px,0.75fr))_auto_auto]"
      >
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nombre o CI exacta…"
            className="pl-9"
          />
        </label>
        <select
          aria-label="Filtrar por área"
          value={areaId}
          onChange={(event) => setAreaId(event.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 body-default"
        >
          <option value="">Todas las áreas</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por cargo"
          value={cargoId}
          onChange={(event) => setCargoId(event.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 body-default"
        >
          <option value="">Todos los cargos</option>
          {cargos.map((cargo) => (
            <option key={cargo.id} value={cargo.id}>
              {cargo.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrar por estado"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 body-default"
        >
          <option value="">Todos los estados</option>
          <option value="EN_PRUEBA">En prueba</option>
          <option value="RATIFICADO">Ratificado</option>
          <option value="INACTIVO">Inactivo</option>
        </select>
        <select
          aria-label="Filtrar por inamovilidad"
          value={protection}
          onChange={(event) => setProtection(event.target.value)}
          className="h-10 rounded-md border border-input bg-card px-3 body-default"
        >
          <option value="">Inamovilidad</option>
          <option value="ACTIVA">Con inamovilidad activa</option>
          <option value="INACTIVA">Sin inamovilidad activa</option>
        </select>
        <Button type="submit" variant="outline">
          Aplicar
        </Button>
        <Button type="button" variant="ghost" onClick={clearFilters}>
          Limpiar
        </Button>
      </form>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/70 hover:bg-muted/70">
              <TableHead className="px-4">Funcionario</TableHead>
              <TableHead>CI</TableHead>
              <TableHead>Área / Cargo</TableHead>
              <TableHead>Ingreso</TableHead>
              {canReadSalary && <TableHead>Haber básico</TableHead>}
              <TableHead>Estado</TableHead>
              <TableHead aria-label="Acciones" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={canReadSalary ? 7 : 6} className="h-28 text-center text-muted-foreground">
                  Cargando funcionarios…
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canReadSalary ? 7 : 6} className="h-28 text-center text-muted-foreground">
                  No se encontraron funcionarios con esos filtros.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="px-4">
                    <Link
                      href={`/personal/${employee.id}`}
                      className="flex items-center gap-3 hover:text-secondary"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent caption-small font-semibold text-accent-foreground">
                        {`${employee.nombres} ${employee.apellidos}`
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block body-medium text-card-foreground">
                          {employee.nombres} {employee.apellidos}
                        </span>
                        <span className="caption-small text-muted-foreground">
                          {employee.codigo ?? employee.id.slice(0, 8)}
                        </span>
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="caption-small text-muted-foreground">
                    {employee.ci}
                  </TableCell>
                  <TableCell>
                    <span className="block body-medium text-card-foreground">
                      {employee.area?.nombre ?? areasById.get(employee.areaId)?.nombre ?? employee.areaId}
                    </span>
                    <span className="caption-small text-muted-foreground">
                      {employee.cargo?.nombre ?? cargosById.get(employee.cargoId)?.nombre ?? employee.cargoId}
                    </span>
                  </TableCell>
                  <TableCell className="caption-small text-muted-foreground">
                    {new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' }).format(
                      new Date(employee.fechaIngreso),
                    )}
                  </TableCell>
                  {canReadSalary && (
                    <TableCell className="caption-small text-muted-foreground">
                      <SalaryValue amount={employee.remuneracion} />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <EmployeeStatusBadge status={employee.estado} />
                      <EmployeeProtectionBadges employee={employee} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/personal/${employee.id}`}>Ver ficha</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PaginationControls
          page={page}
          totalPages={meta.totalPages}
          total={meta.total}
          onPageChange={setPage}
        />
      </section>
      <p className="caption-small mt-3 text-muted-foreground">
        Mostrando {employees.length} de {meta.total} funcionarios.
      </p>
      {error && (
        <Button variant="outline" className="mt-3" onClick={() => void reload()}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
