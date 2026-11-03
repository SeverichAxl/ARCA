'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  BriefcaseBusiness,
  Building2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UsersRound,
} from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { AdminPageTitle, ErrorBanner } from '@/components/admin/admin-components';
import { OrganizationTree } from '@/components/organization/organization-components';
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
import { useOrganization } from '@/hooks/use-organization';
import { AUTH_MODE } from '@/lib/auth';
import {
  getAreaDescendantIds,
  getAreaEmployeeCount,
  getCargoEmployeeCount,
  organizationApi,
  type AreaInput,
  type CargoInput,
  type OrganizationArea,
  type OrganizationCargo,
} from '@/lib/organization-api';

type EditorKind = 'area-create' | 'area-edit' | 'cargo-create' | 'cargo-edit' | null;
type DeleteTarget =
  | { kind: 'area'; item: OrganizationArea }
  | { kind: 'cargo'; item: OrganizationCargo }
  | null;

const EMPTY_AREA: AreaInput = {
  nombre: '',
  padreId: null,
  jefeId: null,
  activa: true,
};
const EMPTY_CARGO: CargoInput = {
  nombre: '',
  descripcion: '',
  activo: true,
};

function flatten(areas: OrganizationArea[]): OrganizationArea[] {
  return areas.flatMap((area) => [area, ...flatten(area.hijos)]);
}

export default function AreasAndPositionsPage() {
  const { request } = useAuth();
  const {
    tree,
    areas,
    cargos,
    employees,
    canReadPeople,
    loading,
    error: loadError,
    reload,
  } = useOrganization();
  const [editor, setEditor] = useState<EditorKind>(null);
  const [areaDraft, setAreaDraft] = useState<AreaInput>(EMPTY_AREA);
  const [cargoDraft, setCargoDraft] = useState<CargoInput>(EMPTY_CARGO);
  const [areaEditing, setAreaEditing] = useState<OrganizationArea | null>(null);
  const [cargoEditing, setCargoEditing] = useState<OrganizationCargo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const allAreas = useMemo(() => flatten(tree), [tree]);
  const selectedArea = allAreas.find((area) => area.id === selectedAreaId);

  useEffect(() => {
    if (!selectedAreaId && allAreas.length > 0) setSelectedAreaId(allAreas[0].id);
  }, [allAreas, selectedAreaId]);

  const openNewArea = () => {
    setAreaEditing(null);
    setAreaDraft({ ...EMPTY_AREA, padreId: selectedAreaId || null });
    setActionError(null);
    setEditor('area-create');
  };

  const openEditArea = (area: OrganizationArea) => {
    setAreaEditing(area);
    setAreaDraft(organizationApi.getAreaInput(area));
    setActionError(null);
    setEditor('area-edit');
  };

  const openNewCargo = () => {
    setCargoEditing(null);
    setCargoDraft(EMPTY_CARGO);
    setActionError(null);
    setEditor('cargo-create');
  };

  const openEditCargo = (cargo: OrganizationCargo) => {
    setCargoEditing(cargo);
    setCargoDraft({
      nombre: cargo.nombre,
      descripcion: cargo.descripcion ?? '',
      activo: cargo.activo,
    });
    setActionError(null);
    setEditor('cargo-edit');
  };

  const submitArea = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    try {
      if (editor === 'area-edit' && areaEditing) {
        await organizationApi.updateArea(request, areaEditing.id, areaDraft);
      } else {
        await organizationApi.createArea(request, areaDraft);
      }
      setEditor(null);
      await reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'No se pudo guardar el área.');
    } finally {
      setSaving(false);
    }
  };

  const submitCargo = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    try {
      if (editor === 'cargo-edit' && cargoEditing) {
        await organizationApi.updateCargo(request, cargoEditing.id, cargoDraft);
      } else {
        await organizationApi.createCargo(request, cargoDraft);
      }
      setEditor(null);
      await reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'No se pudo guardar el cargo.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    setActionError(null);
    try {
      if (deleteTarget.kind === 'area') {
        await organizationApi.deleteArea(request, deleteTarget.item.id);
        if (selectedAreaId === deleteTarget.item.id) setSelectedAreaId('');
      } else {
        await organizationApi.deleteCargo(request, deleteTarget.item.id);
      }
      setDeleteTarget(null);
      await reload();
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'No se pudo eliminar el elemento.');
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  const descendantIds = areaEditing
    ? new Set(getAreaDescendantIds(areaEditing))
    : new Set<string>();

  return (
    <div className="mx-auto max-w-[1500px]">
      <AdminPageTitle
        eyebrow="Sistema de Gestión Humana"
        title="Áreas y cargos"
        description="Configura la estructura organizacional de ARCA Ltda."
        action={
          <Button className="h-10 gap-2" onClick={openNewArea}>
            <Plus className="h-4 w-4" />
            Nueva área
          </Button>
        }
      />

      {AUTH_MODE === 'mock' && (
        <div className="mb-4 rounded-md border border-[hsl(var(--warning)/0.25)] bg-[hsl(var(--warning-bg))] px-4 py-3 body-default text-[hsl(var(--warning))]">
          Modo mock: las áreas y cargos se guardan en esta sesión del navegador y se comparten con el módulo de Personal.
        </div>
      )}
      {loadError && <ErrorBanner message={loadError} />}
      {actionError && <ErrorBanner message={actionError} />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <h2 className="heading-h3">Estructura de áreas</h2>
              <p className="caption-small mt-1 text-muted-foreground">
                {areas.length} áreas
                {canReadPeople
                  ? ` · ${employees.length} funcionarios cargados`
                  : ' · integrantes según permisos'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Actualizar estructura"
              onClick={() => void reload()}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </header>
          <div className="p-4 sm:p-5">
            {loading ? (
              <p className="body-default py-8 text-center text-muted-foreground">
                Cargando áreas…
              </p>
            ) : (
              <OrganizationTree
                areas={tree}
                employees={employees}
                canReadPeople={canReadPeople}
                selectedAreaId={selectedAreaId}
                onSelect={(area) => setSelectedAreaId(area.id)}
                compact
              />
            )}
          </div>
          <footer className="border-t border-border bg-muted/40 px-5 py-3 caption-small text-muted-foreground">
            Selecciona un área del árbol para ver su jefe y número de integrantes.
          </footer>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <div>
              <p className="caption-small text-muted-foreground">Catálogo general</p>
              <h2 className="heading-h3 mt-1">Cargos disponibles</h2>
              <p className="caption-small mt-1 text-muted-foreground">
                El contrato del backend administra cargos globales, no asociados a un área.
              </p>
            </div>
            <Button variant="outline" className="gap-2" onClick={openNewCargo}>
              <Plus className="h-4 w-4" />
              Nuevo cargo
            </Button>
          </header>
          <div className="divide-y divide-border">
            {cargos.length === 0 && !loading ? (
              <div className="p-8 text-center">
                <BriefcaseBusiness className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="body-medium mt-3">No hay cargos registrados.</p>
              </div>
            ) : (
              cargos.map((cargo) => {
                const assignedCount = canReadPeople
                  ? getCargoEmployeeCount(cargo.id, employees)
                  : null;
                return (
                  <article
                    key={cargo.id}
                    className="flex items-center gap-3 px-5 py-4 transition hover:bg-muted/30"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <BriefcaseBusiness className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate body-medium">{cargo.nombre}</p>
                      <p className="mt-1 caption-small text-muted-foreground">
                        {cargo.descripcion || 'Sin descripción'}
                        {assignedCount !== null && ` · ${assignedCount} funcionarios`}
                      </p>
                    </div>
                    <span
                      className={`hidden rounded-full px-2 py-1 caption-small sm:inline-flex ${
                        cargo.activo
                          ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success))]'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {cargo.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Editar ${cargo.nombre}`}
                      onClick={() => openEditCargo(cargo)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Eliminar ${cargo.nombre}`}
                      title={
                        assignedCount
                          ? 'No se puede eliminar: tiene funcionarios asignados'
                          : 'Eliminar cargo'
                      }
                      disabled={assignedCount !== null && assignedCount > 0}
                      onClick={() => setDeleteTarget({ kind: 'cargo', item: cargo })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>

      {selectedArea && (
        <section className="mt-5 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="caption-small text-muted-foreground">Área seleccionada</p>
              <h2 className="heading-h3 mt-1">{selectedArea.nombre}</h2>
              <p className="caption-small mt-1 text-muted-foreground">
                {selectedArea.padreId
                  ? `Depende de ${allAreas.find((area) => area.id === selectedArea.padreId)?.nombre ?? 'otra área'}`
                  : 'Área raíz'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="gap-2" onClick={() => openEditArea(selectedArea)}>
                <Pencil className="h-4 w-4" />
                Editar área
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                disabled={
                  (canReadPeople && getAreaEmployeeCount(selectedArea.id, employees) > 0) ||
                  selectedArea.hijos.length > 0
                }
                title={
                  selectedArea.hijos.length > 0
                    ? 'No se puede eliminar: tiene subáreas'
                    : canReadPeople && getAreaEmployeeCount(selectedArea.id, employees) > 0
                      ? 'No se puede eliminar: tiene funcionarios asignados'
                      : 'Eliminar área'
                }
                onClick={() => setDeleteTarget({ kind: 'area', item: selectedArea })}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar área
              </Button>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 caption-small">
              <Building2 className="h-4 w-4 text-secondary" />
              {selectedArea.activa ? 'Activa' : 'Inactiva'}
            </span>
            {canReadPeople && (
              <span className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 caption-small">
                <UsersRound className="h-4 w-4 text-secondary" />
                {getAreaEmployeeCount(selectedArea.id, employees)} funcionarios asignados
              </span>
            )}
            {canReadPeople && selectedArea.jefeId && (
              <span className="inline-flex items-center gap-2 rounded-md bg-muted px-3 py-2 caption-small">
                Jefe:{' '}
                {employees.find((employee) => employee.id === selectedArea.jefeId)
                  ? `${employees.find((employee) => employee.id === selectedArea.jefeId)?.nombres} ${employees.find((employee) => employee.id === selectedArea.jefeId)?.apellidos}`
                  : 'fuera del ámbito visible'}
              </span>
            )}
          </div>
        </section>
      )}

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setEditor(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          {(editor === 'area-create' || editor === 'area-edit') && (
            <form onSubmit={submitArea}>
              <DialogHeader>
                <DialogTitle>{editor === 'area-edit' ? 'Editar área' : 'Crear área'}</DialogTitle>
                <DialogDescription>
                  Define el nombre, su posición jerárquica y el jefe responsable.
                </DialogDescription>
              </DialogHeader>
              {actionError && <ErrorBanner message={actionError} />}
              <div className="my-5 space-y-4">
                <label className="block space-y-1.5">
                  <span className="caption-small font-medium">Nombre *</span>
                  <Input
                    required
                    maxLength={120}
                    value={areaDraft.nombre}
                    onChange={(event) =>
                      setAreaDraft((current) => ({ ...current, nombre: event.target.value }))
                    }
                    placeholder="Ej. Tecnología"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="caption-small font-medium">Área padre</span>
                  <select
                    value={areaDraft.padreId ?? ''}
                    onChange={(event) =>
                      setAreaDraft((current) => ({
                        ...current,
                        padreId: event.target.value || null,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"
                  >
                    <option value="">Sin área padre (raíz)</option>
                    {allAreas
                      .filter((area) => !descendantIds.has(area.id))
                      .map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.nombre}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="caption-small font-medium">Jefe de área</span>
                  <select
                    value={areaDraft.jefeId ?? ''}
                    onChange={(event) =>
                      setAreaDraft((current) => ({
                        ...current,
                        jefeId: event.target.value || null,
                      }))
                    }
                    disabled={!canReadPeople}
                    className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm disabled:opacity-60"
                  >
                    <option value="">
                      {canReadPeople ? 'Sin jefe asignado' : 'Personal no disponible para este rol'}
                    </option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.nombres} {employee.apellidos}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={areaDraft.activa}
                    onChange={(event) =>
                      setAreaDraft((current) => ({ ...current, activa: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-input text-secondary focus:ring-ring"
                  />
                  <span className="body-default">Área activa</span>
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar área'}
                </Button>
              </DialogFooter>
            </form>
          )}

          {(editor === 'cargo-create' || editor === 'cargo-edit') && (
            <form onSubmit={submitCargo}>
              <DialogHeader>
                <DialogTitle>{editor === 'cargo-edit' ? 'Editar cargo' : 'Crear cargo'}</DialogTitle>
                <DialogDescription>
                  El catálogo de cargos es global según el contrato actual del backend.
                </DialogDescription>
              </DialogHeader>
              {actionError && <ErrorBanner message={actionError} />}
              <div className="my-5 space-y-4">
                <label className="block space-y-1.5">
                  <span className="caption-small font-medium">Nombre *</span>
                  <Input
                    required
                    maxLength={120}
                    value={cargoDraft.nombre}
                    onChange={(event) =>
                      setCargoDraft((current) => ({ ...current, nombre: event.target.value }))
                    }
                    placeholder="Ej. Analista"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="caption-small font-medium">Descripción</span>
                  <textarea
                    maxLength={500}
                    value={cargoDraft.descripcion}
                    onChange={(event) =>
                      setCargoDraft((current) => ({ ...current, descripcion: event.target.value }))
                    }
                    className="min-h-24 w-full rounded-md border border-input bg-card px-3 py-2 body-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Describe brevemente las funciones del cargo"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={cargoDraft.activo}
                    onChange={(event) =>
                      setCargoDraft((current) => ({ ...current, activo: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-input text-secondary focus:ring-ring"
                  />
                  <span className="body-default">Cargo activo</span>
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar cargo'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Eliminar {deleteTarget?.kind === 'area' ? 'área' : 'cargo'}
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. El backend bloqueará la eliminación si existen funcionarios asignados
              {deleteTarget?.kind === 'area' ? ' o subáreas' : ''}.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="my-4 rounded-md bg-muted p-3 body-medium">
              {deleteTarget.item.nombre}
              {deleteTarget.kind === 'area' && canReadPeople
                ? ` · ${getAreaEmployeeCount(deleteTarget.item.id, employees)} funcionarios`
                : null}
              {deleteTarget.kind === 'cargo' && canReadPeople
                ? ` · ${getCargoEmployeeCount(deleteTarget.item.id, employees)} funcionarios`
                : null}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="destructive" disabled={saving} onClick={() => void remove()}>
              {saving ? 'Eliminando…' : 'Confirmar eliminación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
