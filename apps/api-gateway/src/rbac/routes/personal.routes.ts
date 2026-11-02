import { defineServiceRoutes } from '../route.types';

/**
 * Fuente: docs/api/personal.md. Cualquier endpoint nuevo debe declararse aquí
 * y en el controlador del servicio con @RequirePermission.
 */
export const PERSONAL_ROUTES = defineServiceRoutes('personal', [
  {
    method: 'POST',
    path: '/api/personal/employees',
    access: { anyOf: ['personal:create'] },
  },
  {
    method: 'GET',
    path: '/api/personal/employees',
    access: { anyOf: ['personal:read'] },
  },
  {
    method: 'GET',
    path: '/api/personal/employees/:id',
    access: { anyOf: ['personal:read'] },
  },
  {
    method: 'GET',
    path: '/api/personal/employees/:id/historial',
    access: { anyOf: ['personal:read'] },
  },
  {
    method: 'PATCH',
    path: '/api/personal/employees/:id',
    access: { anyOf: ['personal:update'] },
  },
  {
    method: 'POST',
    path: '/api/personal/employees/:id/ratificar',
    access: { anyOf: ['personal:ratify'] },
  },
  {
    method: 'POST',
    path: '/api/personal/employees/:id/baja',
    access: { anyOf: ['personal:baja'] },
  },
  {
    method: 'GET',
    path: '/api/personal/employees/:id/inamovilidades',
    access: { anyOf: ['personal:read'] },
  },
  {
    method: 'POST',
    path: '/api/personal/employees/:id/inamovilidades',
    access: { anyOf: ['personal:inamovilidad'] },
  },
  {
    method: 'PATCH',
    path: '/api/personal/employees/:id/inamovilidades/:inamovilidadId/cerrar',
    access: { anyOf: ['personal:inamovilidad'] },
  },
  { method: 'GET', path: '/api/personal/areas', access: { anyOf: ['catalogo:manage'] } },
  { method: 'POST', path: '/api/personal/areas', access: { anyOf: ['catalogo:manage'] } },
  {
    method: 'PATCH',
    path: '/api/personal/areas/:id',
    access: { anyOf: ['catalogo:manage'] },
  },
  {
    method: 'DELETE',
    path: '/api/personal/areas/:id',
    access: { anyOf: ['catalogo:manage'] },
  },
  {
    method: 'GET',
    path: '/api/personal/areas/tree',
    access: { anyOf: ['organigrama:read'] },
  },
  { method: 'GET', path: '/api/personal/cargos', access: { anyOf: ['catalogo:manage'] } },
  { method: 'POST', path: '/api/personal/cargos', access: { anyOf: ['catalogo:manage'] } },
  {
    method: 'PATCH',
    path: '/api/personal/cargos/:id',
    access: { anyOf: ['catalogo:manage'] },
  },
  {
    method: 'DELETE',
    path: '/api/personal/cargos/:id',
    access: { anyOf: ['catalogo:manage'] },
  },
]);
