export const ORG_CATALOG_PORT = Symbol('ORG_CATALOG_PORT');

export interface AreaResumen {
  id: string;
  jefeId: string | null;
  activa: boolean;
}

export interface CargoResumen {
  id: string;
  activo: boolean;
}

/**
 * Puerto pequeño hacia el catálogo de áreas y cargos. El módulo de empleados no
 * importa ni modifica el código de catálogos (propiedad de otro equipo).
 */
export interface OrgCatalogPort {
  findArea(id: string): Promise<AreaResumen | null>;
  findCargo(id: string): Promise<CargoResumen | null>;
  findAreaIdsLedBy(empleadoId: string): Promise<string[]>;
}
