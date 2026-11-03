export interface AreaRecord {
  id: string;
  nombre: string;
  padreId: string | null;
  jefeId: string | null;
  activa: boolean;
  creadoEn: Date;
}
export interface CargoRecord {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

export interface AreaTreeNode extends AreaRecord {
  hijos: AreaTreeNode[];
}

export interface Page<T> {
  data: T[];
  total: number;
}

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface AreaListQuery extends PageQuery {
  activa?: boolean;
  padreId?: string | null;
}

export interface CargoListQuery extends PageQuery {
  activo?: boolean;
}
