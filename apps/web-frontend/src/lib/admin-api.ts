import { AUTH_MODE, ROLE_LABELS, ROLE_PERMISSIONS, type RoleCode } from '@/lib/auth';

const MOCK_USERS_KEY = 'arca.mock.users';
const MOCK_AUDIT_KEY = 'arca.mock.audit';
const MOCK_ROLE_IDS: Record<RoleCode, string> = {
  ADMIN_GENERAL: '00000000-0000-4000-8000-000000000001',
  RRHH_OPERATIVO: '00000000-0000-4000-8000-000000000002',
  ENCARGADO_NOMINA: '00000000-0000-4000-8000-000000000003',
  JEFE_AREA: '00000000-0000-4000-8000-000000000004',
  FUNCIONARIO: '00000000-0000-4000-8000-000000000005',
  GERENCIA: '00000000-0000-4000-8000-000000000006',
  AUDITOR: '00000000-0000-4000-8000-000000000007',
};

export type UserStatus = 'ACTIVO' | 'INACTIVO' | 'BLOQUEADO';

export interface AdminRole {
  id: string;
  codigo: RoleCode;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
}

export interface AdminUser {
  id: string;
  username: string;
  email: string | null;
  estado: UserStatus;
  empleadoId: string | null;
  rol: { id: string; codigo: RoleCode; nombre: string };
  creadoEn: string;
  actualizadoEn: string;
  bloqueadoHasta?: string | null;
}

export interface AuditEntry {
  id: string;
  eventId: string;
  usuarioId: string | null;
  usuarioNombre?: string;
  ipOrigen: string | null;
  modulo: string;
  accion: string;
  metodo: string | null;
  recurso: string | null;
  resultado: string;
  payload: unknown;
  ocurridoEn: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PageResult<T> {
  data: T[];
  meta: PageMeta;
}

export interface Requester {
  (path: string, options?: RequestInit): Promise<Response>;
}

export interface UserFilters {
  q: string;
  estado: string;
  rol: string;
  page: number;
  pageSize: number;
}

export interface AuditFilters {
  usuarioId: string;
  modulo: string;
  desde: string;
  hasta: string;
  page: number;
  pageSize: number;
}

export interface NewUser {
  username: string;
  email?: string;
  password: string;
  rolId: string;
}

function getMockRoles(): AdminRole[] {
  return (Object.keys(ROLE_LABELS) as RoleCode[]).map((codigo) => ({
    id: MOCK_ROLE_IDS[codigo],
    codigo,
    nombre: ROLE_LABELS[codigo],
    descripcion: null,
    permisos: [...ROLE_PERMISSIONS[codigo]],
  }));
}

function createMockUsers(): AdminUser[] {
  const now = new Date();
  const ago = (days: number, hours: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - days);
    date.setHours(hours, 20, 0, 0);
    return date.toISOString();
  };
  const makeUser = (
    id: number,
    username: string,
    email: string,
    role: RoleCode,
    status: UserStatus,
    daysAgo: number,
    hour: number,
    bloqueadoHasta?: string,
  ): AdminUser => ({
    id: `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`,
    username,
    email,
    estado: status,
    empleadoId: null,
    rol: { id: MOCK_ROLE_IDS[role], codigo: role, nombre: ROLE_LABELS[role] },
    creadoEn: ago(daysAgo, hour),
    actualizadoEn: ago(daysAgo, hour),
    bloqueadoHasta,
  });

  return [
    makeUser(101, 'patricia.rojas', 'projas@arca.bo', 'RRHH_OPERATIVO', 'ACTIVO', 1, 8),
    makeUser(
      102,
      'jorge.condori',
      'jcondori@arca.bo',
      'JEFE_AREA',
      'ACTIVO',
      2,
      9,
      new Date(now.getTime() + 38 * 60_000).toISOString(),
    ),
    makeUser(103, 'ana.paredes', 'aparedes@arca.bo', 'AUDITOR', 'ACTIVO', 3, 10),
    makeUser(104, 'rodrigo.salvatierra', 'rsalvatierra@arca.bo', 'GERENCIA', 'BLOQUEADO', 4, 11),
    makeUser(105, 'lucia.villarroel', 'lvillarroel@arca.bo', 'FUNCIONARIO', 'INACTIVO', 5, 12),
    makeUser(106, 'admin.general', 'admin@arca.bo', 'ADMIN_GENERAL', 'ACTIVO', 6, 13),
  ];
}

function mockUsers(): AdminUser[] {
  const stored = sessionStorage.getItem(MOCK_USERS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as AdminUser[];
    } catch {
      sessionStorage.removeItem(MOCK_USERS_KEY);
    }
  }
  const initial = createMockUsers();
  saveMockUsers(initial);
  return initial;
}

function saveMockUsers(users: AdminUser[]): void {
  sessionStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

function createMockAudit(users: AdminUser[]): AuditEntry[] {
  const records = [
    {
      userIndex: 0,
      ip: '10.24.8.142',
      module: 'personal',
      action: 'remuneracion modificada',
      method: 'PATCH',
      resource: '/api/personal/empleados/284',
      payload: { antes: { remuneracion: '***' }, despues: { remuneracion: '***' } },
    },
    {
      userIndex: 2,
      ip: '10.24.9.021',
      module: 'vacaciones',
      action: 'solicitud aprobada',
      method: 'PATCH',
      resource: '/api/vacaciones/492',
      payload: { antes: { estado: 'PENDIENTE' }, despues: { estado: 'APROBADA' } },
    },
    {
      userIndex: 5,
      ip: '10.24.8.105',
      module: 'auth',
      action: 'USUARIO_CREAR',
      method: 'POST',
      resource: '/api/auth/usuarios',
      payload: { antes: null, despues: { username: 'nuevo.usuario', estado: 'ACTIVO' } },
    },
    {
      userIndex: -1,
      ip: '127.0.0.1',
      module: 'auth',
      action: 'USUARIO_BLOQUEAR',
      method: 'PATCH',
      resource: '/api/auth/usuarios/88/estado',
      payload: { antes: { estado: 'ACTIVO' }, despues: { estado: 'BLOQUEADO' } },
    },
    {
      userIndex: 1,
      ip: '10.24.9.021',
      module: 'auth',
      action: 'LOGIN_FALLIDO',
      method: 'POST',
      resource: '/api/auth/login',
      payload: { antes: null, despues: { motivo: 'CREDENCIALES_INVALIDAS' } },
    },
    {
      userIndex: 0,
      ip: '10.24.8.142',
      module: 'auth',
      action: 'USUARIO_ASIGNAR_ROL',
      method: 'PUT',
      resource: '/api/auth/usuarios/101/rol',
      payload: { antes: { rol: 'FUNCIONARIO' }, despues: { rol: 'RRHH_OPERATIVO' } },
    },
  ];

  return records.map((record, index) => {
    const date = new Date(Date.now() - (index + 1) * 3_600_000);
    return {
      id: `mock-audit-${index + 1}`,
      eventId: `mock-event-${index + 1}`,
      usuarioId: record.userIndex < 0 ? null : users[record.userIndex].id,
      usuarioNombre: record.userIndex < 0 ? 'Sistema' : users[record.userIndex].username,
      ipOrigen: record.ip,
      modulo: record.module,
      accion: record.action,
      metodo: record.method,
      recurso: record.resource,
      resultado: 'EXITO',
      payload: record.payload,
      ocurridoEn: date.toISOString(),
    };
  });
}

function mockAudit(): AuditEntry[] {
  const stored = sessionStorage.getItem(MOCK_AUDIT_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as AuditEntry[];
    } catch {
      sessionStorage.removeItem(MOCK_AUDIT_KEY);
    }
  }
  const initial = createMockAudit(mockUsers());
  saveMockAudit(initial);
  return initial;
}

function saveMockAudit(records: AuditEntry[]): void {
  sessionStorage.setItem(MOCK_AUDIT_KEY, JSON.stringify(records));
}

function recordMockAudit(
  user: AdminUser,
  accion: string,
  metodo: string,
  recurso: string,
  antes: unknown,
  despues: unknown,
): void {
  const entries = mockAudit();
  entries.unshift({
    id: crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    usuarioId: user.id,
    usuarioNombre: user.username,
    ipOrigen: '127.0.0.1',
    modulo: 'auth',
    accion,
    metodo,
    recurso,
    resultado: 'EXITO',
    payload: { antes, despues },
    ocurridoEn: new Date().toISOString(),
  });
  saveMockAudit(entries);
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `La solicitud falló (${response.status}).`;
    try {
      const body = (await response.json()) as { message?: unknown; code?: unknown };
      if (typeof body.message === 'string') message = body.message;
      else if (Array.isArray(body.message)) message = body.message.join(' ');
      else if (typeof body.code === 'string') message = `${body.code}: ${message}`;
    } catch {
      message = `La solicitud falló (${response.status}).`;
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

function pageResult<T>(rows: T[], page: number, pageSize: number): PageResult<T> {
  const start = (page - 1) * pageSize;
  const data = rows.slice(start, start + pageSize);
  return {
    data,
    meta: {
      page,
      pageSize,
      total: rows.length,
      totalPages: Math.ceil(rows.length / pageSize),
    },
  };
}

function toQuery(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  return query.toString();
}

export const adminApi = {
  async listRoles(request: Requester): Promise<AdminRole[]> {
    if (AUTH_MODE === 'mock') return getMockRoles();
    const response = await request('/auth/roles');
    return (await readJson<{ data: AdminRole[] }>(response)).data;
  },

  async listUsers(request: Requester, filters: UserFilters): Promise<PageResult<AdminUser>> {
    if (AUTH_MODE === 'mock') {
      const rows = mockUsers()
        .filter((user) => {
          const query = filters.q.trim().toLowerCase();
          return (
            (!query ||
              user.username.toLowerCase().includes(query) ||
              user.email?.toLowerCase().includes(query)) &&
            (!filters.estado || user.estado === filters.estado) &&
            (!filters.rol || user.rol.codigo === filters.rol)
          );
        })
        .sort((left, right) => left.username.localeCompare(right.username));
      return pageResult(rows, filters.page, filters.pageSize);
    }

    const query = toQuery({
      q: filters.q,
      estado: filters.estado,
      rol: filters.rol,
      page: filters.page,
      pageSize: filters.pageSize,
    });
    const response = await request(`/auth/usuarios?${query}`);
    return readJson<PageResult<AdminUser>>(response);
  },

  async createUser(request: Requester, user: NewUser): Promise<AdminUser> {
    if (AUTH_MODE === 'mock') {
      const users = mockUsers();
      if (users.some((item) => item.username.toLowerCase() === user.username.toLowerCase())) {
        throw new Error('Ese nombre de usuario ya existe en el mock.');
      }
      const role = getMockRoles().find((item) => item.id === user.rolId);
      if (!role) throw new Error('Selecciona un rol válido.');
      const now = new Date().toISOString();
      const created: AdminUser = {
        id: crypto.randomUUID(),
        username: user.username,
        email: user.email ?? null,
        estado: 'ACTIVO',
        empleadoId: null,
        rol: { id: role.id, codigo: role.codigo, nombre: role.nombre },
        creadoEn: now,
        actualizadoEn: now,
      };
      saveMockUsers([created, ...users]);
      recordMockAudit(
        created,
        'USUARIO_CREAR',
        'POST',
        '/api/auth/usuarios',
        null,
        { username: created.username, estado: created.estado, rol: created.rol.codigo },
      );
      return created;
    }
    return readJson<AdminUser>(
      await request('/auth/usuarios', {
        method: 'POST',
        body: JSON.stringify(user),
      }),
    );
  },

  async updateUserStatus(
    request: Requester,
    userId: string,
    estado: UserStatus,
  ): Promise<AdminUser> {
    if (AUTH_MODE === 'mock') {
      const users = mockUsers();
      const user = users.find((item) => item.id === userId);
      if (!user) throw new Error('No se encontró el usuario mock.');
      const before = { estado: user.estado };
      user.estado = estado;
      user.actualizadoEn = new Date().toISOString();
      user.bloqueadoHasta = undefined;
      saveMockUsers(users);
      recordMockAudit(
        user,
        estado === 'BLOQUEADO' ? 'USUARIO_BLOQUEAR' : estado === 'ACTIVO' ? 'USUARIO_ACTIVAR' : 'USUARIO_INACTIVAR',
        'PATCH',
        `/api/auth/usuarios/${user.id}/estado`,
        before,
        { estado },
      );
      return user;
    }
    return readJson<AdminUser>(
      await request(`/auth/usuarios/${encodeURIComponent(userId)}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      }),
    );
  },

  async unlockUser(request: Requester, userId: string): Promise<AdminUser> {
    if (AUTH_MODE === 'mock') {
      const users = mockUsers();
      const user = users.find((item) => item.id === userId);
      if (!user) throw new Error('No se encontró el usuario mock.');
      if (user.estado !== 'BLOQUEADO') throw new Error('El usuario no tiene un bloqueo manual.');
      const before = { estado: user.estado };
      user.estado = 'ACTIVO';
      user.actualizadoEn = new Date().toISOString();
      user.bloqueadoHasta = undefined;
      saveMockUsers(users);
      recordMockAudit(
        user,
        'USUARIO_DESBLOQUEAR',
        'POST',
        `/api/auth/usuarios/${user.id}/desbloquear`,
        before,
        { estado: user.estado },
      );
      return user;
    }
    return readJson<AdminUser>(
      await request(`/auth/usuarios/${encodeURIComponent(userId)}/desbloquear`, {
        method: 'POST',
      }),
    );
  },

  async assignRole(request: Requester, userId: string, rolId: string): Promise<AdminUser> {
    if (AUTH_MODE === 'mock') {
      const users = mockUsers();
      const user = users.find((item) => item.id === userId);
      const role = getMockRoles().find((item) => item.id === rolId);
      if (!user || !role) throw new Error('No se pudo asignar el rol seleccionado.');
      const before = { rol: user.rol.codigo };
      user.rol = { id: role.id, codigo: role.codigo, nombre: role.nombre };
      user.actualizadoEn = new Date().toISOString();
      saveMockUsers(users);
      recordMockAudit(
        user,
        'USUARIO_ASIGNAR_ROL',
        'PUT',
        `/api/auth/usuarios/${user.id}/rol`,
        before,
        { rol: user.rol.codigo },
      );
      return user;
    }
    return readJson<AdminUser>(
      await request(`/auth/usuarios/${encodeURIComponent(userId)}/rol`, {
        method: 'PUT',
        body: JSON.stringify({ rolId }),
      }),
    );
  },

  async linkEmployee(
    request: Requester,
    userId: string,
    empleadoId: string | null,
  ): Promise<AdminUser> {
    if (AUTH_MODE === 'mock') {
      const users = mockUsers();
      const user = users.find((item) => item.id === userId);
      if (!user) throw new Error('No se encontró el usuario mock.');
      if (empleadoId && users.some((item) => item.id !== userId && item.empleadoId === empleadoId)) {
        throw new Error('Ese funcionario ya está vinculado a otro usuario mock.');
      }
      const before = { empleadoId: user.empleadoId };
      user.empleadoId = empleadoId;
      user.actualizadoEn = new Date().toISOString();
      saveMockUsers(users);
      recordMockAudit(
        user,
        'USUARIO_VINCULAR_EMPLEADO',
        'PUT',
        `/api/auth/usuarios/${user.id}/empleado`,
        before,
        { empleadoId },
      );
      return user;
    }
    return readJson<AdminUser>(
      await request(`/auth/usuarios/${encodeURIComponent(userId)}/empleado`, {
        method: 'PUT',
        body: JSON.stringify({ empleadoId }),
      }),
    );
  },

  async listAudit(
    request: Requester,
    filters: AuditFilters,
    users?: AdminUser[],
  ): Promise<PageResult<AuditEntry>> {
    if (AUTH_MODE === 'mock') {
      const userNames = new Map((users ?? mockUsers()).map((user) => [user.id, user.username]));
      const rows = mockAudit()
        .map((entry) => ({
          ...entry,
          usuarioNombre: entry.usuarioId ? userNames.get(entry.usuarioId) : 'Sistema',
        }))
        .filter((entry) => {
          const from = filters.desde ? new Date(`${filters.desde}T00:00:00.000Z`).getTime() : -Infinity;
          const until = filters.hasta
            ? new Date(`${filters.hasta}T23:59:59.999Z`).getTime()
            : Infinity;
          const timestamp = new Date(entry.ocurridoEn).getTime();
          return (
            (!filters.usuarioId || entry.usuarioId === filters.usuarioId) &&
            (!filters.modulo || entry.modulo === filters.modulo) &&
            timestamp >= from &&
            timestamp <= until
          );
        })
        .sort((left, right) => right.ocurridoEn.localeCompare(left.ocurridoEn));
      return pageResult(rows, filters.page, filters.pageSize);
    }

    const { usuarioId, modulo, desde, hasta, page, pageSize } = filters;
    const query = toQuery({
      usuarioId,
      modulo,
      desde: desde ? new Date(`${desde}T00:00:00.000Z`).toISOString() : undefined,
      hasta: hasta ? new Date(`${hasta}T23:59:59.999Z`).toISOString() : undefined,
      page,
      pageSize,
    });
    const response = await request(`/auth/auditoria?${query}`);
    return readJson<PageResult<AuditEntry>>(response);
  },
};

export const MOCK_ROLE_OPTIONS = (Object.keys(ROLE_LABELS) as RoleCode[]).map((codigo) => ({
  codigo,
  id: MOCK_ROLE_IDS[codigo],
}));
