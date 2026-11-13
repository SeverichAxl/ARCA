import { AUTH_MODE } from '@/lib/auth';
import {
  getMockCatalogs,
  personalApi,
  saveMockCatalogs,
  type Employee,
  type EmployeeArea,
  type EmployeeCatalogs,
  type Requester,
} from '@/lib/personal-api';

export interface OrganizationArea {
  id: string;
  nombre: string;
  padreId: string | null;
  jefeId: string | null;
  activa: boolean;
  creadoEn?: string;
  hijos: OrganizationArea[];
}

export interface OrganizationCargo {
  id: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
}

export interface OrganizationSnapshot {
  tree: OrganizationArea[];
  areas: OrganizationArea[];
  cargos: OrganizationCargo[];
  employees: Employee[];
  canReadPeople: boolean;
  canManageCatalogs: boolean;
}

export interface AreaInput {
  nombre: string;
  padreId: string | null;
  jefeId: string | null;
  activa: boolean;
}

export interface CargoInput {
  nombre: string;
  descripcion: string;
  activo: boolean;
}

const EMPTY_EMPLOYEE_FILTERS = {
  nombre: '',
  ci: '',
  areaId: '',
  cargoId: '',
  estado: '',
  inamovilidad: '',
  page: 1,
  pageSize: 100,
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `La solicitud falló (${response.status}).`;
    try {
      const body = (await response.json()) as { message?: unknown; code?: unknown };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(' ');
      if (body.code === 'PERS_CICLO_JERARQUIA') {
        message = 'No se puede mover el área debajo de sí misma o de una de sus áreas descendientes.';
      } else if (body.code === 'PERS_AREA_CON_EMPLEADOS') {
        message = 'No se puede eliminar el área porque tiene funcionarios asignados.';
      } else if (body.code === 'PERS_AREA_CON_HIJAS') {
        message = 'No se puede eliminar el área porque tiene áreas dependientes.';
      } else if (body.code === 'PERS_CARGO_CON_EMPLEADOS') {
        message = 'No se puede eliminar el cargo porque tiene funcionarios asignados.';
      }
    } catch {
      message = `La solicitud falló (${response.status}).`;
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function flattenTree(areas: OrganizationArea[]): OrganizationArea[] {
  return areas.flatMap((area) => [area, ...flattenTree(area.hijos)]);
}

function buildTree(areas: OrganizationArea[]): OrganizationArea[] {
  const nodes = new Map<string, OrganizationArea>();
  for (const area of areas) {
    nodes.set(area.id, {
        ...area,
        padreId: area.padreId ?? null,
        jefeId: area.jefeId ?? null,
        activa: area.activa ?? true,
        hijos: [],
    });
  }
  const roots: OrganizationArea[] = [];
  for (const node of nodes.values()) {
    if (node.padreId && nodes.has(node.padreId)) {
      nodes.get(node.padreId)?.hijos.push(node);
    } else {
      roots.push(node);
    }
  }
  const sort = (items: OrganizationArea[]): OrganizationArea[] =>
    items
      .sort((left, right) => left.nombre.localeCompare(right.nombre))
      .map((item) => ({ ...item, hijos: sort(item.hijos) }));
  return sort(roots);
}

function normalizeArea(area: EmployeeArea): OrganizationArea {
  return {
    ...area,
    padreId: area.padreId ?? null,
    jefeId: area.jefeId ?? null,
    activa: area.activa ?? true,
    hijos: [],
  };
}

async function listAllEmployees(request: Requester): Promise<Employee[]> {
  const firstPage = await personalApi.listEmployees(request, EMPTY_EMPLOYEE_FILTERS);
  const pages = await Promise.all(
    Array.from({ length: Math.max(0, firstPage.meta.totalPages - 1) }, (_, index) =>
      personalApi.listEmployees(request, {
        ...EMPTY_EMPLOYEE_FILTERS,
        page: index + 2,
      }),
    ),
  );
  return [...firstPage.data, ...pages.flatMap((page) => page.data)];
}

function currentMockEmployees(): Employee[] {
  const raw = sessionStorage.getItem('arca.mock.employees');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Employee[];
  } catch {
    return [];
  }
}

function toAreaInput(area: OrganizationArea): AreaInput {
  return {
    nombre: area.nombre,
    padreId: area.padreId,
    jefeId: area.jefeId,
    activa: area.activa,
  };
}

function ensureUniqueAreaName(
  areas: OrganizationArea[],
  nombre: string,
  padreId: string | null,
  excludeId?: string,
): void {
  if (
    areas.some(
      (area) =>
        area.id !== excludeId &&
        area.padreId === padreId &&
        area.nombre.trim().toLocaleLowerCase() === nombre.trim().toLocaleLowerCase(),
    )
  ) {
    throw new Error('Ya existe un área con ese nombre bajo el mismo nivel jerárquico.');
  }
}

function ensureNoCycle(
  areas: OrganizationArea[],
  areaId: string,
  proposedParentId: string | null,
): void {
  if (proposedParentId === areaId) {
    throw new Error('Un área no puede ser su propia área padre.');
  }
  const byId = new Map(areas.map((area) => [area.id, area]));
  let current = proposedParentId;
  while (current) {
    if (current === areaId) {
      throw new Error('No se puede crear un ciclo en la jerarquía de áreas.');
    }
    current = byId.get(current)?.padreId ?? null;
  }
}

function saveAreaCatalogs(
  catalogs: EmployeeCatalogs,
  areas: OrganizationArea[],
): void {
  saveMockCatalogs({
    ...catalogs,
    areas: areas.map(({ hijos: _children, ...area }) => area),
  });
}

async function loadMockSnapshot(
  request: Requester,
  canReadPeople: boolean,
  canManageCatalogs: boolean,
): Promise<OrganizationSnapshot> {
  const catalogs = getMockCatalogs();
  const tree = buildTree(catalogs.areas.map(normalizeArea));
  const employees = canReadPeople ? await listAllEmployees(request) : [];
  const cargos = canManageCatalogs
    ? catalogs.cargos.map((cargo) => ({ ...cargo, activo: cargo.activo ?? true }))
    : Array.from(
        new Map(
          employees.map((employee) => [
            employee.cargoId,
            {
              id: employee.cargoId,
              nombre: employee.cargo?.nombre ?? employee.cargoId,
              activo: true,
            },
          ]),
        ).values(),
      );
  return {
    tree,
    areas: flattenTree(tree),
    cargos,
    employees,
    canReadPeople,
    canManageCatalogs,
  };
}

export const organizationApi = {
  async load(
    request: Requester,
    permissions: readonly string[],
  ): Promise<OrganizationSnapshot> {
    const canReadPeople = permissions.includes('personal:read');
    const canManageCatalogs = permissions.includes('catalogo:manage');
    if (AUTH_MODE === 'mock') {
      return loadMockSnapshot(request, canReadPeople, canManageCatalogs);
    }

    const tasks: [
      Promise<{ data: OrganizationArea[] }>,
      Promise<{ data: OrganizationArea[] } | null>,
      Promise<{ data: OrganizationCargo[] } | null>,
      Promise<Employee[]>,
    ] = [
      request('/personal/areas/tree').then((response) =>
        parseResponse<{ data: OrganizationArea[] }>(response),
      ),
      canManageCatalogs
        ? request('/personal/areas?page=1&pageSize=100').then((response) =>
            parseResponse<{ data: OrganizationArea[] }>(response),
          )
        : Promise.resolve(null),
      canManageCatalogs
        ? request('/personal/cargos?page=1&pageSize=100').then((response) =>
            parseResponse<{ data: OrganizationCargo[] }>(response),
          )
        : Promise.resolve(null),
      canReadPeople ? listAllEmployees(request) : Promise.resolve([]),
    ];
    const [treeResult, areasResult, cargosResult, employees] = await Promise.all(tasks);
    const tree = treeResult.data;
    const areas = areasResult?.data ?? flattenTree(tree);
    const cargos =
      cargosResult?.data ??
      Array.from(
        new Map(
          employees.map((employee) => [
            employee.cargoId,
            {
              id: employee.cargoId,
              nombre: employee.cargo?.nombre ?? employee.cargoId,
              activo: true,
            },
          ]),
        ).values(),
      );
    const areasById = new Map(areas.map((area) => [area.id, area]));
    const cargosById = new Map(cargos.map((cargo) => [cargo.id, cargo]));
    const organizationEmployees = employees.map((employee) => ({
      ...employee,
      area:
        employee.area ??
        areasById.get(employee.areaId) ?? {
          id: employee.areaId,
          nombre: employee.areaId,
        },
      cargo:
        employee.cargo ??
        cargosById.get(employee.cargoId) ?? {
          id: employee.cargoId,
          nombre: employee.cargoId,
        },
    }));
    return {
      tree,
      areas,
      cargos,
      employees: organizationEmployees,
      canReadPeople,
      canManageCatalogs,
    };
  },

  async createArea(request: Requester, input: AreaInput): Promise<void> {
    if (AUTH_MODE !== 'mock') {
      await parseResponse<OrganizationArea>(
        await request('/personal/areas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
      return;
    }
    const catalogs = getMockCatalogs();
    const areas = catalogs.areas.map(normalizeArea);
    ensureUniqueAreaName(areas, input.nombre, input.padreId);
    if (input.padreId && !areas.some((area) => area.id === input.padreId)) {
      throw new Error('Selecciona un área padre válida.');
    }
    if (input.jefeId && !currentMockEmployees().some((employee) => employee.id === input.jefeId)) {
      throw new Error('Selecciona un funcionario válido como jefe.');
    }
    areas.push({
      ...input,
      id: crypto.randomUUID(),
      creadoEn: new Date().toISOString(),
      hijos: [],
    });
    saveAreaCatalogs(catalogs, areas);
  },

  async updateArea(
    request: Requester,
    areaId: string,
    input: AreaInput,
  ): Promise<void> {
    if (AUTH_MODE !== 'mock') {
      await parseResponse<OrganizationArea>(
        await request(`/personal/areas/${encodeURIComponent(areaId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
      return;
    }
    const catalogs = getMockCatalogs();
    const areas = catalogs.areas.map(normalizeArea);
    const area = areas.find((item) => item.id === areaId);
    if (!area) throw new Error('No se encontró el área.');
    ensureUniqueAreaName(areas, input.nombre, input.padreId, areaId);
    ensureNoCycle(areas, areaId, input.padreId);
    if (input.padreId && !areas.some((item) => item.id === input.padreId)) {
      throw new Error('Selecciona un área padre válida.');
    }
    if (input.jefeId && !currentMockEmployees().some((employee) => employee.id === input.jefeId)) {
      throw new Error('Selecciona un funcionario válido como jefe.');
    }
    Object.assign(area, input);
    saveAreaCatalogs(catalogs, areas);
  },

  async deleteArea(request: Requester, areaId: string): Promise<void> {
    if (AUTH_MODE !== 'mock') {
      await parseResponse<void>(
        await request(`/personal/areas/${encodeURIComponent(areaId)}`, { method: 'DELETE' }),
      );
      return;
    }
    const catalogs = getMockCatalogs();
    const areas = catalogs.areas.map(normalizeArea);
    if (!areas.some((area) => area.id === areaId)) throw new Error('No se encontró el área.');
    if (areas.some((area) => area.padreId === areaId)) {
      throw new Error('No se puede eliminar el área porque tiene áreas dependientes.');
    }
    if (currentMockEmployees().some((employee) => employee.areaId === areaId)) {
      throw new Error('No se puede eliminar el área porque tiene funcionarios asignados.');
    }
    saveAreaCatalogs(catalogs, areas.filter((area) => area.id !== areaId));
  },

  async createCargo(request: Requester, input: CargoInput): Promise<void> {
    if (AUTH_MODE !== 'mock') {
      await parseResponse<OrganizationCargo>(
        await request('/personal/cargos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
      return;
    }
    const catalogs = getMockCatalogs();
    if (catalogs.cargos.some((cargo) => cargo.nombre.toLowerCase() === input.nombre.toLowerCase())) {
      throw new Error('Ya existe un cargo con ese nombre.');
    }
    saveMockCatalogs({
      ...catalogs,
      cargos: [...catalogs.cargos, { ...input, id: crypto.randomUUID() }],
    });
  },

  async updateCargo(
    request: Requester,
    cargoId: string,
    input: CargoInput,
  ): Promise<void> {
    if (AUTH_MODE !== 'mock') {
      await parseResponse<OrganizationCargo>(
        await request(`/personal/cargos/${encodeURIComponent(cargoId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
      );
      return;
    }
    const catalogs = getMockCatalogs();
    if (
      catalogs.cargos.some(
        (cargo) =>
          cargo.id !== cargoId && cargo.nombre.toLowerCase() === input.nombre.toLowerCase(),
      )
    ) {
      throw new Error('Ya existe un cargo con ese nombre.');
    }
    const cargo = catalogs.cargos.find((item) => item.id === cargoId);
    if (!cargo) throw new Error('No se encontró el cargo.');
    saveMockCatalogs({
      ...catalogs,
      cargos: catalogs.cargos.map((item) =>
        item.id === cargoId ? { ...item, ...input } : item,
      ),
    });
  },

  async deleteCargo(request: Requester, cargoId: string): Promise<void> {
    if (AUTH_MODE !== 'mock') {
      await parseResponse<void>(
        await request(`/personal/cargos/${encodeURIComponent(cargoId)}`, { method: 'DELETE' }),
      );
      return;
    }
    const catalogs = getMockCatalogs();
    if (!catalogs.cargos.some((cargo) => cargo.id === cargoId)) {
      throw new Error('No se encontró el cargo.');
    }
    if (currentMockEmployees().some((employee) => employee.cargoId === cargoId)) {
      throw new Error('No se puede eliminar el cargo porque tiene funcionarios asignados.');
    }
    saveMockCatalogs({
      ...catalogs,
      cargos: catalogs.cargos.filter((cargo) => cargo.id !== cargoId),
    });
  },

  getAreaInput(area: OrganizationArea): AreaInput {
    return toAreaInput(area);
  },
};

export function getAreaEmployeeCount(areaId: string, employees: Employee[]): number {
  return employees.filter((employee) => employee.areaId === areaId).length;
}

export function getCargoEmployeeCount(cargoId: string, employees: Employee[]): number {
  return employees.filter((employee) => employee.cargoId === cargoId).length;
}

export function getAreaDescendantIds(area: OrganizationArea): string[] {
  return [area.id, ...flattenTree(area.hijos).map((child) => child.id)];
}
