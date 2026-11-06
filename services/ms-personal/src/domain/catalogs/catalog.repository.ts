import type {
  AreaListQuery,
  AreaRecord,
  CargoListQuery,
  CargoRecord,
  Page,
} from './catalog.models';

export const CATALOG_REPOSITORY = Symbol('CATALOG_REPOSITORY');

export interface CreateAreaData {
  nombre: string;
  padreId: string | null;
  jefeId: string | null;
  activa: boolean;
}
export type UpdateAreaData = Partial<CreateAreaData>;

export interface AreaUpdatedEventPayload {
  areaId: string;
  nombre: string;
  padreId: string | null;
  jefeEmpleadoId: string | null;
  [key: string]: string | null;
}

export interface CreateCargoData {
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export type UpdateCargoData = Partial<CreateCargoData>;

export interface CatalogRepository {
  listAreas(query: AreaListQuery): Promise<Page<AreaRecord>>;
  listAllAreas(): Promise<AreaRecord[]>;
  findAreaById(id: string): Promise<AreaRecord | null>;
  createArea(data: CreateAreaData, emitEvent?: boolean): Promise<AreaRecord>;
  updateArea(id: string, data: UpdateAreaData, emitEvent?: boolean): Promise<AreaRecord>;
  deleteArea(id: string): Promise<void>;
  countAreaChildren(id: string): Promise<number>;
  countAreaEmployees(id: string): Promise<number>;
  areaNameExists(nombre: string, padreId: string | null, excludeId?: string): Promise<boolean>;
  employeeExists(id: string): Promise<boolean>;

  listCargos(query: CargoListQuery): Promise<Page<CargoRecord>>;
  findCargoById(id: string): Promise<CargoRecord | null>;
  createCargo(data: CreateCargoData): Promise<CargoRecord>;
  updateCargo(id: string, data: UpdateCargoData): Promise<CargoRecord>;
  deleteCargo(id: string): Promise<void>;
  countCargoEmployees(id: string): Promise<number>;
  cargoNameExists(nombre: string, excludeId?: string): Promise<boolean>;
}
