import { defineServiceRoutes } from '../route.types';

/**
 * Fuente: docs/api/auth.md. Cualquier endpoint nuevo debe declararse aquí y en
 * el controlador del servicio con @RequirePermission.
 */
export const AUTH_ROUTES = defineServiceRoutes('auth', [
  { method: 'POST', path: '/api/auth/login', access: 'public' },
  { method: 'POST', path: '/api/auth/refresh', access: 'public' },
  { method: 'POST', path: '/api/auth/logout', access: 'authenticated' },
  {
    method: 'POST',
    path: '/api/auth/usuarios',
    access: { allOf: ['usuario:create', 'usuario:assign_role'] },
  },
  { method: 'GET', path: '/api/auth/usuarios', access: { anyOf: ['usuario:read'] } },
  {
    method: 'PATCH',
    path: '/api/auth/usuarios/:id/estado',
    access: { anyOf: ['usuario:update'] },
  },
  {
    method: 'POST',
    path: '/api/auth/usuarios/:id/desbloquear',
    access: { anyOf: ['usuario:update'] },
  },
  {
    method: 'PUT',
    path: '/api/auth/usuarios/:id/rol',
    access: { anyOf: ['usuario:assign_role'] },
  },
  {
    method: 'PUT',
    path: '/api/auth/usuarios/:id/empleado',
    access: { anyOf: ['usuario:update'] },
  },
  { method: 'GET', path: '/api/auth/auditoria', access: { anyOf: ['auditoria:read'] } },
  { method: 'GET', path: '/api/auth/roles', access: { anyOf: ['usuario:assign_role'] } },
  { method: 'GET', path: '/api/auth/permisos', access: { anyOf: ['usuario:assign_role'] } },
  {
    method: 'GET',
    path: '/api/auth/configuracion',
    access: { anyOf: ['sistema:config'] },
  },
  {
    method: 'PATCH',
    path: '/api/auth/configuracion/:clave',
    access: { anyOf: ['sistema:config'] },
  },
]);
