'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  UsersRound,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  getAreaEmployeeCount,
  type OrganizationArea,
} from '@/lib/organization-api';
import type { Employee } from '@/lib/personal-api';

export function OrganizationTree({
  areas,
  employees,
  canReadPeople,
  selectedAreaId,
  onSelect,
  compact = false,
}: {
  areas: OrganizationArea[];
  employees: Employee[];
  canReadPeople: boolean;
  selectedAreaId?: string;
  onSelect?: (area: OrganizationArea) => void;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(areas.flatMap((area) => collectAreaIds(area))),
  );

  useEffect(() => {
    setExpanded(new Set(areas.flatMap((area) => collectAreaIds(area))));
  }, [areas]);

  if (!areas.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="body-medium mt-3">Todavía no hay áreas registradas.</p>
        <p className="caption-small mt-1 text-muted-foreground">
          Crea un área para comenzar la estructura organizacional.
        </p>
      </div>
    );
  }

  const renderNode = (area: OrganizationArea, depth: number) => {
    const members = employees.filter((employee) => employee.areaId === area.id);
    const chief = canReadPeople
      ? employees.find((employee) => employee.id === area.jefeId)
      : undefined;
    const selected = area.id === selectedAreaId;
    const children = area.hijos ?? [];

    return (
      <div
        key={area.id}
        className={compact ? 'relative' : 'relative flex shrink-0 flex-col items-center'}
      >
        {compact ? (
          <div
            className={`flex items-center gap-2 rounded-md border p-2 ${
              selected
                ? 'border-secondary bg-accent'
                : 'border-border bg-card hover:border-secondary/50'
            }`}
            style={{ marginLeft: depth ? 16 : 0 }}
          >
            {children.length ? (
              <button
                type="button"
                aria-label={`Expandir o contraer ${area.nombre}`}
                onClick={() => toggleArea(area.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-muted"
              >
                {expanded.has(area.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-6" />
            )}
            <button
              type="button"
              onClick={() => onSelect?.(area)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate body-medium">{area.nombre}</span>
              <span className="caption-small text-muted-foreground">
                {canReadPeople
                  ? `${getAreaEmployeeCount(area.id, employees)} funcionarios`
                  : area.activa
                    ? 'Área activa'
                    : 'Área inactiva'}
              </span>
            </button>
            <span className="h-2 w-2 shrink-0 rounded-full bg-secondary" />
          </div>
        ) : (
          <article
            className={`w-64 rounded-xl border bg-card p-4 shadow-sm transition ${
              selected ? 'border-secondary ring-2 ring-secondary/20' : 'border-border'
            } ${!area.activa ? 'opacity-60' : ''}`}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Building2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate body-medium">{area.nombre}</p>
                <p className="caption-small mt-1 text-muted-foreground">
                  {area.activa ? 'Área activa' : 'Área inactiva'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 caption-small text-muted-foreground">
              <CircleUserRound className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {canReadPeople
                  ? chief
                    ? `${chief.nombres} ${chief.apellidos}`
                    : area.jefeId
                      ? 'Jefatura fuera de tu ámbito'
                      : 'Jefatura sin asignar'
                  : 'Jefatura no disponible'}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 caption-small text-muted-foreground">
              <UsersRound className="h-3.5 w-3.5 shrink-0" />
              <span>
                {canReadPeople
                  ? `${getAreaEmployeeCount(area.id, employees)} integrantes`
                  : 'Integrantes no disponibles'}
              </span>
            </div>
            {canReadPeople && members.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {members.slice(0, 4).map((member) => (
                  <span
                    key={member.id}
                    title={`${member.nombres} ${member.apellidos} · ${member.cargo?.nombre ?? member.cargoId}`}
                    className="max-w-full truncate rounded-full bg-muted px-2 py-1 caption-small text-muted-foreground"
                  >
                    {member.nombres} · {member.cargo?.nombre ?? member.cargoId}
                  </span>
                ))}
                {members.length > 4 && (
                  <span className="rounded-full bg-muted px-2 py-1 caption-small text-muted-foreground">
                    +{members.length - 4}
                  </span>
                )}
              </div>
            )}
          </article>
        )}

        {children.length > 0 && (!compact || expanded.has(area.id)) && (
          <div
            className={
              compact
                ? 'mt-2 space-y-2 border-l border-border pl-2'
                : 'relative mt-10 flex items-start justify-center gap-4 border-t border-border px-3 pt-7'
            }
          >
            {!compact &&
              children.map((child) => (
                <div key={child.id} className="relative flex flex-col items-center">
                  <span className="absolute -top-7 h-7 border-l border-border" />
                  {renderNode(child, depth + 1)}
                </div>
              ))}
            {compact &&
              children.map((child) => (
                <div key={child.id}>{renderNode(child, depth + 1)}</div>
              ))}
          </div>
        )}
      </div>
    );
  };

  function toggleArea(areaId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(areaId)) next.delete(areaId);
      else next.add(areaId);
      return next;
    });
  }

  return (
    <div className={compact ? 'space-y-2' : 'flex min-w-max items-start justify-center gap-10 px-8 py-8'}>
      {areas.map((area) => renderNode(area, 0))}
    </div>
  );
}

export function OrganizationChart({
  areas,
  employees,
  canReadPeople,
}: {
  areas: OrganizationArea[];
  employees: Employee[];
  canReadPeople: boolean;
}) {
  const [zoom, setZoom] = useState(100);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3">
        <div>
          <p className="body-medium">Estructura jerárquica</p>
          <p className="caption-small text-muted-foreground">
            {areas.reduce((count, area) => count + countAreas(area), 0)} áreas · vista según permisos
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background p-1">
          <button
            type="button"
            aria-label="Alejar organigrama"
            onClick={() => setZoom((current) => Math.max(70, current - 10))}
            disabled={zoom <= 70}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-12 text-center caption-small text-muted-foreground">{zoom}%</span>
          <button
            type="button"
            aria-label="Acercar organigrama"
            onClick={() => setZoom((current) => Math.min(120, current + 10))}
            disabled={zoom >= 120}
            className="flex h-8 w-8 items-center justify-center rounded hover:bg-muted disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="h-8 rounded px-2 caption-small hover:bg-muted"
          >
            Ajustar
          </button>
        </div>
      </div>
      {!canReadPeople && (
        <p className="border-b border-border bg-muted/50 px-4 py-2 caption-small text-muted-foreground">
          El backend restringe la información de funcionarios a roles con permiso personal:read. Se muestra la jerarquía disponible.
        </p>
      )}
      <div className="max-h-[calc(100vh-260px)] min-h-[440px] overflow-auto">
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${zoom / 100})`,
            width: `${10000 / zoom}%`,
          }}
        >
          <OrganizationTree
            areas={areas}
            employees={employees}
            canReadPeople={canReadPeople}
            compact={false}
          />
        </div>
      </div>
    </section>
  );
}

function collectAreaIds(area: OrganizationArea): string[] {
  return [area.id, ...area.hijos.flatMap((child) => collectAreaIds(child))];
}

function countAreas(area: OrganizationArea): number {
  return 1 + area.hijos.reduce((count, child) => count + countAreas(child), 0);
}
