import { defineServiceRoutes } from '../route.types';

/**
 * Fuente: docs/api/planillas.md (TSK-ARQ-201, Sprint 2).
 * Cualquier endpoint nuevo debe declararse aquí y en el controlador del
 * servicio con @RequirePermission. Rutas no declaradas = denegación por defecto.
 */
export const PLANILLAS_ROUTES = defineServiceRoutes('planillas', [
  // Parámetros legales (HU-20 / RF-23)
  {
    method: 'GET',
    path: '/api/planillas/parametros',
    access: { anyOf: ['parametros_ley:update', 'planilla:read', 'planilla:calculate'] },
  },
  {
    method: 'POST',
    path: '/api/planillas/parametros',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'PATCH',
    path: '/api/planillas/parametros/:id',
    access: { anyOf: ['parametros_ley:update'] },
  },

  // Historial, KPIs y exportación — rutas estáticas antes de /:id
  {
    method: 'GET',
    path: '/api/planillas/historial',
    access: { anyOf: ['planilla:read'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/kpis',
    access: { anyOf: ['dashboard:read', 'dashboard:read_area'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/export',
    access: { anyOf: ['export:data'] },
  },

  // Boletas (HU-22, HU-23 / RF-25, RF-27) — antes de /:id
  {
    method: 'GET',
    path: '/api/planillas/boletas',
    access: { anyOf: ['boleta:read_all', 'boleta:read_own'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/boletas/:id',
    access: { anyOf: ['boleta:read_all', 'boleta:read_own'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/boletas/:id/descarga',
    access: { anyOf: ['boleta:read_all', 'boleta:read_own'] },
  },

  // Planillas (HU-21, HU-24 / RF-24, RF-26)
  {
    method: 'POST',
    path: '/api/planillas',
    access: { anyOf: ['planilla:calculate'] },
  },
  {
    method: 'GET',
    path: '/api/planillas',
    access: { anyOf: ['planilla:read'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/:id',
    access: { anyOf: ['planilla:read'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/:id/detalles',
    access: { anyOf: ['planilla:read'] },
  },
  {
    method: 'POST',
    path: '/api/planillas/:id/cerrar',
    access: { anyOf: ['planilla:close'] },
  },
  {
    method: 'POST',
    path: '/api/planillas/:id/boletas/generar',
    access: { anyOf: ['boleta:issue'] },
  },
]);
