import { AUTH_MODE } from '@/lib/auth';

const MOCK_EMPLOYEES_KEY = 'arca.mock.employees';
const MOCK_HISTORY_KEY = 'arca.mock.employee-history';
const MOCK_CATALOGS_KEY = 'arca.mock.personal-catalogs';

export type EmployeeStatus = 'EN_PRUEBA' | 'RATIFICADO' | 'INACTIVO';
export type JobProtectionType = 'GESTACION' | 'PROGENITOR' | 'DISCAPACIDAD' | 'TUTOR_DISCAPACIDAD';

export interface EmployeeArea {
  id: string;
  nombre: string;
  padreId?: string | null;
  jefeId?: string | null;
  activa?: boolean;
  creadoEn?: string;
}

export interface EmployeePosition {
  id: string;
  nombre: string;
  descripcion?: string | null;
  activo?: boolean;
  areaId?: string;
}

export interface JobProtection {
  id?: string;
  tipo: JobProtectionType;
  fechaInicio: string;
  fechaFin?: string | null;
  observacion?: string | null;
  estadoActivo?: boolean;
}

export interface Employee {
  id: string;
  codigo?: string;
  nombres: string;
  apellidos: string;
  ci: string;
  ciExpedido?: string | null;
  fechaNacimiento?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  esExtranjero?: boolean;
  areaId: string;
  area: EmployeeArea;
  cargoId: string;
  cargo: EmployeePosition;
  remuneracion?: number | null;
  fechaIngreso: string;
  estado: EmployeeStatus;
  diasPrueba?: number;
  fechaRatificacion?: string | null;
  firmaDisponible?: boolean;
  firmaUrl?: string | null;
  inamovilidades?: JobProtection[];
  inamovilidadActiva?: boolean | JobProtection | JobProtection[];
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface EmployeeFilters {
  nombre: string;
  ci: string;
  areaId: string;
  cargoId: string;
  estado: string;
  inamovilidad: string;
  page: number;
  pageSize: number;
}

export interface PageResult<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface EmployeeCreateInput {
  nombres: string;
  apellidos: string;
  ci: string;
  ciExpedido?: string;
  fechaNacimiento?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  areaId: string;
  cargoId: string;
  remuneracion: number;
  fechaIngreso: string;
  esExtranjero: boolean;
  inamovilidad?: {
    tipo: JobProtectionType;
    fechaInicio: string;
    observacion?: string;
  };
}

export interface EmployeeUpdateInput {
  areaId?: string;
  cargoId?: string;
  remuneracion?: number;
  fechaEfectiva: string;
  motivo: string;
}

export interface EmployeeTerminationInput {
  fechaBaja: string;
  motivo: string;
  aplicaDesahucio: boolean;
  sueldoPromedio: number;
  finiquitoTotal: number;
  finiquitoDetalle: {
    indemnizacion: number;
    desahucio: number;
    aguinaldoProporcional: number;
    vacacionesPendientes: number;
    diasVacacionesPendientes: number;
  };
}

export interface EmployeeHistoryEntry {
  id: string;
  tipo?: string;
  motivo?: string;
  fechaEfectiva?: string;
  creadoEn?: string;
  areaAnterior?: string;
  areaNueva?: string;
  cargoAnterior?: string;
  cargoNuevo?: string;
  remuneracionAnterior?: number;
  remuneracionNueva?: number;
}

export interface EmployeeCatalogs {
  areas: EmployeeArea[];
  cargos: EmployeePosition[];
}

export interface Requester {
  (path: string, options?: RequestInit): Promise<Response>;
}

const MOCK_AREAS: EmployeeArea[] = [
  { id: '00000000-0000-4000-8000-000000000101', nombre: 'Gerencia General', padreId: null, jefeId: null, activa: true },
  { id: '00000000-0000-4000-8000-000000000102', nombre: 'Operaciones', padreId: '00000000-0000-4000-8000-000000000101', jefeId: '00000000-0000-4000-8000-000000000302', activa: true },
  { id: '00000000-0000-4000-8000-000000000103', nombre: 'Tecnología', padreId: '00000000-0000-4000-8000-000000000101', jefeId: '00000000-0000-4000-8000-000000000304', activa: true },
  { id: '00000000-0000-4000-8000-000000000104', nombre: 'Finanzas y Contabilidad', padreId: '00000000-0000-4000-8000-000000000101', jefeId: '00000000-0000-4000-8000-000000000303', activa: true },
  { id: '00000000-0000-4000-8000-000000000105', nombre: 'Gestión Humana', padreId: '00000000-0000-4000-8000-000000000101', jefeId: null, activa: true },
  { id: '00000000-0000-4000-8000-000000000106', nombre: 'Créditos', padreId: '00000000-0000-4000-8000-000000000102', jefeId: null, activa: true },
  { id: '00000000-0000-4000-8000-000000000107', nombre: 'Desarrollo', padreId: '00000000-0000-4000-8000-000000000103', jefeId: null, activa: true },
  { id: '00000000-0000-4000-8000-000000000108', nombre: 'Infraestructura', padreId: '00000000-0000-4000-8000-000000000103', jefeId: null, activa: true },
];

const MOCK_POSITIONS: EmployeePosition[] = [
  { id: '00000000-0000-4000-8000-000000000201', nombre: 'Gerente General', descripcion: 'Dirección ejecutiva', activo: true },
  { id: '00000000-0000-4000-8000-000000000202', nombre: 'Analista de Recursos Humanos', descripcion: 'Gestión de personas', activo: true },
  { id: '00000000-0000-4000-8000-000000000203', nombre: 'Jefe de Tecnología', descripcion: 'Liderazgo de tecnología', activo: true },
  { id: '00000000-0000-4000-8000-000000000204', nombre: 'Contador Senior', descripcion: 'Contabilidad y reportes', activo: true },
  { id: '00000000-0000-4000-8000-000000000205', nombre: 'Oficial de Créditos', descripcion: 'Operaciones de crédito', activo: true },
  { id: '00000000-0000-4000-8000-000000000206', nombre: 'Auxiliar Administrativo', descripcion: 'Soporte administrativo', activo: true },
  { id: '00000000-0000-4000-8000-000000000207', nombre: 'Desarrollador Senior', descripcion: 'Desarrollo de software', activo: true },
  { id: '00000000-0000-4000-8000-000000000208', nombre: 'Analista de Soporte', descripcion: 'Soporte técnico', activo: true },
];

export function getMockCatalogs(): EmployeeCatalogs {
  const raw = sessionStorage.getItem(MOCK_CATALOGS_KEY);
  if (!raw) return { areas: MOCK_AREAS, cargos: MOCK_POSITIONS };
  try {
    return JSON.parse(raw) as EmployeeCatalogs;
  } catch {
    sessionStorage.removeItem(MOCK_CATALOGS_KEY);
    return { areas: MOCK_AREAS, cargos: MOCK_POSITIONS };
  }
}

export function saveMockCatalogs(catalogs: EmployeeCatalogs): void {
  sessionStorage.setItem(MOCK_CATALOGS_KEY, JSON.stringify(catalogs));
}

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function initialMockEmployees(): Employee[] {
  const now = new Date().toISOString();
  return [
    {
      id: '00000000-0000-4000-8000-000000000301',
      codigo: 'EMP-0248',
      nombres: 'María Fernanda Quispe',
      apellidos: 'Mamani',
      ci: '6543210 LP',
      fechaNacimiento: '1992-05-21',
      email: 'mquispe@arca.bo',
      telefono: '+591 720 845 21',
      areaId: MOCK_AREAS[3].id,
      area: MOCK_AREAS[3],
      cargoId: MOCK_POSITIONS[3].id,
      cargo: MOCK_POSITIONS[3],
      remuneracion: 9200,
      fechaIngreso: '2021-03-12',
      estado: 'RATIFICADO',
      firmaDisponible: true,
      creadoEn: now,
      actualizadoEn: now,
    },
    {
      id: '00000000-0000-4000-8000-000000000302',
      codigo: 'EMP-0317',
      nombres: 'Carlos Andrés',
      apellidos: 'Mendoza Rojas',
      ci: '7812345 SC',
      fechaNacimiento: '1994-09-14',
      email: 'cmendoza@arca.bo',
      telefono: '+591 720 845 21',
      areaId: MOCK_AREAS[1].id,
      area: MOCK_AREAS[1],
      cargoId: MOCK_POSITIONS[4].id,
      cargo: MOCK_POSITIONS[4],
      remuneracion: 7800,
      fechaIngreso: isoDaysAgo(62),
      estado: 'EN_PRUEBA',
      diasPrueba: 90,
      firmaDisponible: true,
      creadoEn: now,
      actualizadoEn: now,
    },
    {
      id: '00000000-0000-4000-8000-000000000303',
      codigo: 'EMP-0182',
      nombres: 'Lucía Alejandra',
      apellidos: 'Flores Vargas',
      ci: '5987654 CB',
      fechaNacimiento: '1989-09-14',
      email: 'lflores@arca.bo',
      areaId: MOCK_AREAS[3].id,
      area: MOCK_AREAS[3],
      cargoId: MOCK_POSITIONS[3].id,
      cargo: MOCK_POSITIONS[3],
      remuneracion: 10500,
      fechaIngreso: '2019-07-18',
      estado: 'RATIFICADO',
      firmaDisponible: true,
      inamovilidades: [
        {
          id: 'mock-protection-1',
          tipo: 'GESTACION',
          fechaInicio: isoDaysAgo(20),
          observacion: 'Caso de demostración: fuero activo.',
          estadoActivo: true,
        },
      ],
      creadoEn: now,
      actualizadoEn: now,
    },
    {
      id: '00000000-0000-4000-8000-000000000304',
      codigo: 'EMP-0203',
      nombres: 'Jorge Condori',
      apellidos: 'Ticona',
      ci: '6734521 LP',
      areaId: MOCK_AREAS[2].id,
      area: MOCK_AREAS[2],
      cargoId: MOCK_POSITIONS[2].id,
      cargo: MOCK_POSITIONS[2],
      remuneracion: 12400,
      fechaIngreso: '2020-11-21',
      estado: 'RATIFICADO',
      firmaDisponible: true,
      creadoEn: now,
      actualizadoEn: now,
    },
  ];
}

function readMockEmployees(): Employee[] {
  const raw = sessionStorage.getItem(MOCK_EMPLOYEES_KEY);
  if (raw) {
    try {
      const catalogs = getMockCatalogs();
      return (JSON.parse(raw) as Employee[]).map((employee) => ({
        ...employee,
        area: catalogs.areas.find((area) => area.id === employee.areaId) ?? employee.area,
        cargo: catalogs.cargos.find((cargo) => cargo.id === employee.cargoId) ?? employee.cargo,
      }));
    } catch {
      sessionStorage.removeItem(MOCK_EMPLOYEES_KEY);
    }
  }
  const initial = initialMockEmployees();
  writeMockEmployees(initial);
  return initial;
}

function writeMockEmployees(employees: Employee[]): void {
  sessionStorage.setItem(MOCK_EMPLOYEES_KEY, JSON.stringify(employees));
}

function readMockHistory(): Record<string, EmployeeHistoryEntry[]> {
  const raw = sessionStorage.getItem(MOCK_HISTORY_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, EmployeeHistoryEntry[]>;
  } catch {
    sessionStorage.removeItem(MOCK_HISTORY_KEY);
    return {};
  }
}

function appendMockHistory(employeeId: string, entry: Omit<EmployeeHistoryEntry, 'id' | 'creadoEn'>): void {
  const history = readMockHistory();
  history[employeeId] = [
    {
      ...entry,
      id: crypto.randomUUID(),
      creadoEn: new Date().toISOString(),
    },
    ...(history[employeeId] ?? []),
  ];
  sessionStorage.setItem(MOCK_HISTORY_KEY, JSON.stringify(history));
}

function responsePage<T>(items: T[], page: number, pageSize: number): PageResult<T> {
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    meta: {
      page,
      pageSize,
      total: items.length,
      totalPages: Math.ceil(items.length / pageSize),
    },
  };
}

async function jsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `La solicitud falló (${response.status}).`;
    try {
      const body = (await response.json()) as { message?: unknown; code?: unknown };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(' ');
      if (body.code === 'PERS_INAMOVILIDAD_ACTIVA') {
        message = 'La baja está bloqueada por una inamovilidad activa. Adjunta la autorización del Ministerio de Trabajo.';
      }
    } catch {
      message = `La solicitud falló (${response.status}).`;
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function buildQuery(filters: EmployeeFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== '' && value !== undefined) params.set(key, String(value));
  }
  return params.toString();
}

export const personalApi = {
  async listCatalogs(request: Requester): Promise<EmployeeCatalogs> {
    if (AUTH_MODE === 'mock') return getMockCatalogs();
    const [areasResponse, positionsResponse] = await Promise.all([
      request('/personal/areas?page=1&pageSize=100'),
      request('/personal/cargos?page=1&pageSize=100'),
    ]);
    const areas = await jsonResponse<{ data: EmployeeArea[] }>(areasResponse);
    const cargos = await jsonResponse<{ data: EmployeePosition[] }>(positionsResponse);
    return { areas: areas.data, cargos: cargos.data };
  },

  async listEmployees(
    request: Requester,
    filters: EmployeeFilters,
  ): Promise<PageResult<Employee>> {
    if (AUTH_MODE === 'mock') {
      const query = filters.nombre.trim().toLowerCase();
      const rows = readMockEmployees().filter((employee) => {
        const fullName = `${employee.nombres} ${employee.apellidos}`.toLowerCase();
        const protectedEmployee =
          activeProtections(employee).length > 0;
        return (
          (!query || fullName.includes(query)) &&
          (!filters.ci || employee.ci.toLowerCase() === filters.ci.toLowerCase()) &&
          (!filters.areaId || employee.areaId === filters.areaId) &&
          (!filters.cargoId || employee.cargoId === filters.cargoId) &&
          (!filters.estado || employee.estado === filters.estado) &&
          (!filters.inamovilidad ||
            (filters.inamovilidad === 'ACTIVA' ? protectedEmployee : !protectedEmployee))
        );
      });
      return responsePage(rows, filters.page, filters.pageSize);
    }
    const response = await request(`/personal/employees?${buildQuery(filters)}`);
    return jsonResponse<PageResult<Employee>>(response);
  },

  async getEmployee(request: Requester, employeeId: string): Promise<Employee> {
    if (AUTH_MODE === 'mock') {
      const employee = readMockEmployees().find((item) => item.id === employeeId);
      if (!employee) throw new Error('No se encontró el funcionario.');
      return employee;
    }
    return jsonResponse<Employee>(
      await request(`/personal/employees/${encodeURIComponent(employeeId)}`),
    );
  },

  async listHistory(
    request: Requester,
    employeeId: string,
  ): Promise<PageResult<EmployeeHistoryEntry>> {
    if (AUTH_MODE === 'mock') {
      const employee = await this.getEmployee(request, employeeId);
      const entries = readMockHistory()[employeeId];
      if (entries) return responsePage(entries, 1, 20);
      return {
        data: [
          {
            id: `mock-history-${employee.id}`,
            tipo: 'ALTA',
            motivo: 'Alta inicial del funcionario',
            fechaEfectiva: employee.fechaIngreso,
            areaNueva: employee.area.nombre,
            cargoNuevo: employee.cargo.nombre,
            remuneracionNueva: employee.remuneracion ?? undefined,
            creadoEn: employee.creadoEn,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };
    }
    return jsonResponse<PageResult<EmployeeHistoryEntry>>(
      await request(`/personal/employees/${encodeURIComponent(employeeId)}/historial`),
    );
  },

  async createEmployee(
    request: Requester,
    input: EmployeeCreateInput,
    signature: File,
  ): Promise<Employee> {
    if (!isSignatureFile(signature)) {
      throw new Error('Adjunta una firma gráfica PNG o JPEG de máximo 5 MiB.');
    }
    if (AUTH_MODE === 'mock') {
      const employees = readMockEmployees();
      if (employees.some((employee) => employee.ci.toLowerCase() === input.ci.toLowerCase())) {
        throw new Error('Esta CI ya está registrada en el sistema.');
      }
      const catalogs = getMockCatalogs();
      const area = catalogs.areas.find((item) => item.id === input.areaId);
      const cargo = catalogs.cargos.find((item) => item.id === input.cargoId);
      if (!area || !cargo) throw new Error('Selecciona un área y cargo válidos.');
      if (
        input.esExtranjero &&
        (employees.filter((employee) => employee.esExtranjero).length + 1) /
          (employees.length + 1) >
          0.15
      ) {
        throw new Error('Se excedería el límite del 15% de personal extranjero.');
      }
      const now = new Date().toISOString();
      const employee: Employee = {
        ...input,
        id: crypto.randomUUID(),
        codigo: `EMP-${String(employees.length + 1).padStart(4, '0')}`,
        area,
        cargo,
        estado: 'EN_PRUEBA',
        diasPrueba: 90,
        firmaDisponible: true,
        inamovilidades: input.inamovilidad
          ? [{ ...input.inamovilidad, id: crypto.randomUUID(), estadoActivo: true }]
          : [],
        creadoEn: now,
        actualizadoEn: now,
      };
      employees.unshift(employee);
      writeMockEmployees(employees);
      appendMockHistory(employee.id, {
        tipo: 'ALTA',
        motivo: 'Alta inicial del funcionario',
        fechaEfectiva: employee.fechaIngreso,
        areaNueva: employee.area.nombre,
        cargoNuevo: employee.cargo.nombre,
        remuneracionNueva: employee.remuneracion ?? undefined,
      });
      return employee;
    }

    const body = new FormData();
    body.append(
      'datos',
      JSON.stringify({ ...input, remuneracion: input.remuneracion.toFixed(2) }),
    );
    body.append('firma', signature, signature.name);
    return jsonResponse<Employee>(
      await request('/personal/employees', { method: 'POST', body }),
    );
  },

  async updateEmployee(
    request: Requester,
    employeeId: string,
    input: EmployeeUpdateInput,
  ): Promise<Employee> {
    if (AUTH_MODE === 'mock') {
      const employees = readMockEmployees();
      const employee = employees.find((item) => item.id === employeeId);
      if (!employee) throw new Error('No se encontró el funcionario.');
      const previousArea = employee.area.nombre;
      const previousPosition = employee.cargo.nombre;
      const previousSalary = employee.remuneracion;
      if (input.areaId) {
        const area = getMockCatalogs().areas.find((item) => item.id === input.areaId);
        if (!area) throw new Error('Selecciona un área válida.');
        employee.area = area;
        employee.areaId = area.id;
      }
      if (input.cargoId) {
        const position = getMockCatalogs().cargos.find((item) => item.id === input.cargoId);
        if (!position) throw new Error('Selecciona un cargo válido.');
        employee.cargo = position;
        employee.cargoId = position.id;
      }
      if (input.remuneracion !== undefined) employee.remuneracion = input.remuneracion;
      employee.actualizadoEn = new Date().toISOString();
      writeMockEmployees(employees);
      appendMockHistory(employee.id, {
        tipo: 'MODIFICACION',
        motivo: input.motivo,
        fechaEfectiva: input.fechaEfectiva,
        areaAnterior: previousArea !== employee.area.nombre ? previousArea : undefined,
        areaNueva: previousArea !== employee.area.nombre ? employee.area.nombre : undefined,
        cargoAnterior: previousPosition !== employee.cargo.nombre ? previousPosition : undefined,
        cargoNuevo: previousPosition !== employee.cargo.nombre ? employee.cargo.nombre : undefined,
        remuneracionAnterior:
          previousSalary !== employee.remuneracion ? previousSalary ?? undefined : undefined,
        remuneracionNueva:
          previousSalary !== employee.remuneracion
            ? employee.remuneracion ?? undefined
            : undefined,
      });
      return employee;
    }
    return jsonResponse<Employee>(
      await request(`/personal/employees/${encodeURIComponent(employeeId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...input,
          ...(input.remuneracion !== undefined
            ? { remuneracion: input.remuneracion.toFixed(2) }
            : {}),
        }),
      }),
    );
  },

  async ratifyEmployee(
    request: Requester,
    employeeId: string,
    fechaRatificacion: string,
    motivo?: string,
  ): Promise<Employee> {
    if (AUTH_MODE === 'mock') {
      const employees = readMockEmployees();
      const employee = employees.find((item) => item.id === employeeId);
      if (!employee) throw new Error('No se encontró el funcionario.');
      if (employee.estado !== 'EN_PRUEBA') throw new Error('El funcionario no está en periodo de prueba.');
      const canRatifyDate = new Date(employee.fechaIngreso);
      canRatifyDate.setDate(canRatifyDate.getDate() + (employee.diasPrueba ?? 90));
      if (new Date(`${fechaRatificacion}T00:00:00`) < canRatifyDate) {
        throw new Error('No se puede ratificar antes de cumplir los 90 días de prueba.');
      }
      employee.estado = 'RATIFICADO';
      employee.fechaRatificacion = fechaRatificacion;
      employee.actualizadoEn = new Date().toISOString();
      writeMockEmployees(employees);
      appendMockHistory(employee.id, {
        tipo: 'RATIFICACION',
        motivo: motivo?.trim() || 'Ratificación al concluir el periodo de prueba',
        fechaEfectiva: fechaRatificacion,
      });
      return employee;
    }
    return jsonResponse<Employee>(
      await request(`/personal/employees/${encodeURIComponent(employeeId)}/ratificar`, {
        method: 'POST',
        body: JSON.stringify({
          fechaRatificacion,
          ...(motivo?.trim() ? { motivo: motivo.trim() } : {}),
        }),
      }),
    );
  },

  async terminateEmployee(
    request: Requester,
    employeeId: string,
    input: EmployeeTerminationInput,
    authorization?: File,
  ): Promise<unknown> {
    if (authorization && !isAuthorizationFile(authorization)) {
      throw new Error('La autorización del Ministerio debe ser un PDF de máximo 10 MiB.');
    }
    if (AUTH_MODE === 'mock') {
      const employees = readMockEmployees();
      const employee = employees.find((item) => item.id === employeeId);
      if (!employee) throw new Error('No se encontró el funcionario.');
      if (
        activeProtections(employee).length > 0 &&
        !authorization
      ) {
        throw new Error(
          'PERS_INAMOVILIDAD_ACTIVA: La baja está bloqueada por una inamovilidad activa. Adjunta la autorización del Ministerio de Trabajo.',
        );
      }
      employee.estado = 'INACTIVO';
      employee.actualizadoEn = new Date().toISOString();
      writeMockEmployees(employees);
      appendMockHistory(employee.id, {
        tipo: 'BAJA',
        motivo: input.motivo,
        fechaEfectiva: input.fechaBaja,
      });
      return {
        id: crypto.randomUUID(),
        empleadoId: employee.id,
        fechaBaja: input.fechaBaja,
        estado: 'INACTIVO',
        finiquitoRegistrado: true,
        finiquitoTotal: input.finiquitoTotal,
        finiquitoDetalle: input.finiquitoDetalle,
      };
    }
    const body = new FormData();
    body.append('datos', new Blob([JSON.stringify(input)], { type: 'application/json' }));
    if (authorization) body.append('autorizacionMinisterio', authorization, authorization.name);
    return jsonResponse<unknown>(
      await request(`/personal/employees/${encodeURIComponent(employeeId)}/baja`, {
        method: 'POST',
        body,
      }),
    );
  },
};

export function activeProtections(employee: Employee): JobProtection[] {
  const list = [...(employee.inamovilidades ?? [])];
  if (Array.isArray(employee.inamovilidadActiva)) list.push(...employee.inamovilidadActiva);
  else if (employee.inamovilidadActiva && typeof employee.inamovilidadActiva === 'object') {
    list.push(employee.inamovilidadActiva);
  } else if (employee.inamovilidadActiva === true && list.length === 0) {
    list.push({
      tipo: 'GESTACION',
      fechaInicio: employee.fechaIngreso,
      estadoActivo: true,
    });
  }
  return list.filter((item) => {
    const hasEnded = item.fechaFin && new Date(`${item.fechaFin}T23:59:59`).getTime() < Date.now();
    return item.estadoActivo !== false && !hasEnded;
  });
}

export function isSignatureFile(file: File): boolean {
  return (
    file.size <= 5 * 1024 * 1024 &&
    (file.type === 'image/png' || file.type === 'image/jpeg')
  );
}

export function isAuthorizationFile(file: File): boolean {
  return file.size <= 10 * 1024 * 1024 && file.type === 'application/pdf';
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'No disponible';
  return new Intl.NumberFormat('es-BO', {
    style: 'currency',
    currency: 'BOB',
    minimumFractionDigits: 2,
  }).format(value);
}

export function calculateTerminationSettlement(
  employee: Employee,
  fechaBaja: string,
  sueldoPromedio = employee.remuneracion ?? 0,
  diasVacacionesPendientes = 0,
  aplicaDesahucio = false,
): EmployeeTerminationInput {
  const dailySalary = sueldoPromedio / 30;
  const hireDate = new Date(`${employee.fechaIngreso}T00:00:00`);
  const terminationDate = new Date(`${fechaBaja}T00:00:00`);
  const daysWorked = Math.max(
    0,
    Math.floor((terminationDate.getTime() - hireDate.getTime()) / 86_400_000) + 1,
  );
  const indemnizacion = (sueldoPromedio * daysWorked) / 360;
  const yearStart = new Date(terminationDate.getFullYear(), 0, 1);
  const daysInYear = Math.max(
    0,
    Math.floor(
      (terminationDate.getTime() - Math.max(yearStart.getTime(), hireDate.getTime())) /
        86_400_000,
    ) + 1,
  );
  const aguinaldoProporcional = (sueldoPromedio * daysInYear) / 360;
  const desahucio = aplicaDesahucio ? sueldoPromedio * 3 : 0;
  const vacacionesPendientes = dailySalary * diasVacacionesPendientes;
  const round = (amount: number) => Math.round(amount * 100) / 100;
  const finiquitoDetalle = {
    indemnizacion: round(indemnizacion),
    desahucio: round(desahucio),
    aguinaldoProporcional: round(aguinaldoProporcional),
    vacacionesPendientes: round(vacacionesPendientes),
    diasVacacionesPendientes,
  };

  return {
    fechaBaja,
    motivo: '',
    aplicaDesahucio,
    sueldoPromedio: round(sueldoPromedio),
    finiquitoDetalle,
    finiquitoTotal: round(
      finiquitoDetalle.indemnizacion +
        finiquitoDetalle.desahucio +
        finiquitoDetalle.aguinaldoProporcional +
        finiquitoDetalle.vacacionesPendientes,
    ),
  };
}
