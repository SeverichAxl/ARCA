import type { AuthUser, UserStatus } from '../auth/auth.models';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserListQuery {
  q?: string;
  estado?: UserStatus;
  rol?: string;
  page: number;
  pageSize: number;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string | null;
  estado: UserStatus;
  empleadoId: string | null;
  rol: { id: string; codigo: string; nombre: string };
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface RoleView {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
}

export interface PermissionView {
  id: string;
  codigo: string;
  modulo: string;
  descripcion: string;
}

export interface UserRepository {
  create(data: {
    username: string;
    email: string | null;
    passwordHash: string;
    rolId: string;
    empleadoId: string | null;
  }): Promise<SafeUser>;
  list(query: UserListQuery): Promise<{ data: SafeUser[]; total: number }>;
  findSafeById(id: string): Promise<SafeUser | null>;
  findAuthById(id: string): Promise<AuthUser | null>;
  usernameExists(username: string): Promise<boolean>;
  emailExists(email: string): Promise<boolean>;
  employeeLinked(empleadoId: string, excludeUserId?: string): Promise<boolean>;
  roleExists(id: string): Promise<boolean>;
  updateStatus(id: string, estado: UserStatus): Promise<SafeUser>;
  unlock(id: string): Promise<SafeUser>;
  assignRole(id: string, rolId: string): Promise<SafeUser>;
  listRoles(): Promise<RoleView[]>;
  listPermissions(modulo?: string): Promise<PermissionView[]>;
  linkEmployee(id: string, empleadoId: string | null): Promise<SafeUser>;
}
