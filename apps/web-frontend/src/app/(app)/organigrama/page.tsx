'use client';

import Link from 'next/link';
import { Building2, Network, UsersRound } from 'lucide-react';
import { AdminPageTitle, ErrorBanner, MetricCard } from '@/components/admin/admin-components';
import { OrganizationChart } from '@/components/organization/organization-components';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/hooks/use-organization';
import { AUTH_MODE } from '@/lib/auth';
import type { OrganizationArea } from '@/lib/organization-api';

export default function OrganizationChartPage() {
  const {
    tree,
    areas,
    employees,
    canReadPeople,
    canManageCatalogs,
    loading,
    error,
    reload,
  } = useOrganization();

  const activeAreas = areas.filter((area) => area.activa).length;
  const totalMembers = canReadPeople ? employees.length : null;

  return (
    <div className="mx-auto max-w-[1600px]">
      <AdminPageTitle
        eyebrow="Sistema de Gestión Humana"
        title="Organigrama"
        description="Estructura jerárquica y equipos de ARCA Ltda."
        action={
          canManageCatalogs ? (
            <Button asChild variant="outline" className="gap-2">
              <Link href="/areas-cargos">
                <Building2 className="h-4 w-4" />
                Administrar áreas y cargos
              </Link>
            </Button>
          ) : undefined
        }
      />

      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: el organigrama usa el mismo catálogo de prueba que la administración de áreas.
        </div>
      )}
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
          <Button variant="outline" onClick={() => void reload()}>
            Reintentar
          </Button>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <MetricCard label="Áreas registradas" value={loading ? '…' : areas.length} description={`${activeAreas} activas`} />
        <MetricCard
          label="Funcionarios"
          value={loading ? '…' : totalMembers ?? 'Restringido'}
          description={canReadPeople ? 'Personas visibles para tu rol' : 'Requiere permiso personal:read'}
        />
        <MetricCard
          label="Niveles jerárquicos"
          value={loading ? '…' : treeDepth(tree)}
          description="Profundidad del árbol organizacional"
        />
      </div>

      {loading ? (
        <div className="flex min-h-96 items-center justify-center rounded-xl border border-border bg-card">
          <div className="text-center">
            <Network className="mx-auto h-8 w-8 animate-pulse text-secondary" />
            <p className="body-default mt-3 text-muted-foreground">Cargando organigrama…</p>
          </div>
        </div>
      ) : tree.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="heading-h3 mt-4">No hay áreas disponibles</h2>
          <p className="body-default mt-2 text-muted-foreground">
            {canManageCatalogs
              ? 'Crea la primera área para comenzar a construir la estructura.'
              : 'No hay áreas en tu ámbito de acceso.'}
          </p>
          {canManageCatalogs && (
            <Button asChild className="mt-4">
              <Link href="/areas-cargos">Administrar áreas y cargos</Link>
            </Button>
          )}
        </div>
      ) : (
        <OrganizationChart
          areas={tree}
          employees={employees}
          canReadPeople={canReadPeople}
        />
      )}

      {!canReadPeople && (
        <p className="mt-3 flex items-center gap-2 caption-small text-muted-foreground">
          <UsersRound className="h-4 w-4" />
          Tu rol puede consultar la jerarquía, pero el backend no habilita los datos personales del equipo.
        </p>
      )}
    </div>
  );
}

function treeDepth(roots: OrganizationArea[]): number {
  if (!roots.length) return 0;
  const depth = (node: OrganizationArea): number =>
    1 + Math.max(0, ...node.hijos.map(depth));
  return Math.max(...roots.map(depth));
}
