import { defineServiceRoutes } from '../route.types';

/**
 * Rutas de planillas. El gateway evalúa permisos; ms-planillas valida además
 * propiedad y estado de la planilla.
 */
export const PLANILLAS_ROUTES = defineServiceRoutes('planillas', [
  {
    method: 'GET',
    path: '/api/planillas/boletas/mias/:periodo/pdf',
    access: { anyOf: ['boleta:read_own'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/boletas/:planillaId/empleados/:empleadoId/pdf',
    access: { anyOf: ['boleta:read_all', 'boleta:read_own'] },
  },
  {
    method: 'POST',
    path: '/api/planillas/boletas/verificar',
    access: { anyOf: ['boleta:read_all', 'boleta:read_own'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/:id/exportar',
    access: { anyOf: ['export:data'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/parametros/vigentes',
    access: { anyOf: ['planilla:calculate', 'planilla:read', 'parametros_ley:update'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/politica-retencion',
    access: { anyOf: ['planilla:read'] },
  },
  { method: 'GET', path: '/api/planillas/resumen', access: { anyOf: ['dashboard:read'] } },
  { method: 'GET', path: '/api/planillas/mis-pagos', access: { anyOf: ['boleta:read_own'] } },
  {
    method: 'GET',
    path: '/api/planillas/mis-pagos/:periodo',
    access: { anyOf: ['boleta:read_own'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/periodos/:periodo/novedades',
    access: { anyOf: ['planilla:calculate'] },
  },
  {
    method: 'PUT',
    path: '/api/planillas/periodos/:periodo/novedades/:empleadoId',
    access: { anyOf: ['planilla:calculate'] },
  },
  {
    method: 'POST',
    path: '/api/planillas/periodos/:periodo/calcular',
    access: { anyOf: ['planilla:calculate'] },
  },
  { method: 'GET', path: '/api/planillas/periodos/:periodo', access: { anyOf: ['planilla:read'] } },
  { method: 'GET', path: '/api/planillas', access: { anyOf: ['planilla:read'] } },
  { method: 'GET', path: '/api/planillas/:id', access: { anyOf: ['planilla:read'] } },
  { method: 'GET', path: '/api/planillas/:id/detalle', access: { anyOf: ['planilla:read'] } },
  {
    method: 'GET',
    path: '/api/planillas/:id/empleados/:empleadoId',
    access: { anyOf: ['planilla:read', 'boleta:read_all'] },
  },
  { method: 'POST', path: '/api/planillas/:id/cerrar', access: { anyOf: ['planilla:close'] } },
  { method: 'DELETE', path: '/api/planillas/:id', access: { anyOf: ['planilla:calculate'] } },
]);
