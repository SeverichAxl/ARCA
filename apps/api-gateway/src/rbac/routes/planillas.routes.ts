import { defineServiceRoutes } from '../route.types';

/**
 * Rutas de ms-planillas implementadas (contrato docs/api/planillas.md +
 * openapi/planillas.yaml, TSK-ARQ-201). Las rutas de boletas y export del
 * contrato se agregan aquí cuando su handler exista. El gateway evalúa
 * permisos; ms-planillas valida además propiedad y estado de la planilla.
 * Las rutas con segmentos estáticos tienen prioridad sobre `/:id`.
 */
export const PLANILLAS_ROUTES = defineServiceRoutes('planillas', [
  // Parámetros legales (HU-20, TSK-SCRUMDEV-201)
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
  {
    method: 'GET',
    path: '/api/planillas/parametros/vigentes',
    access: { anyOf: ['planilla:calculate', 'planilla:read', 'parametros_ley:update'] },
  },

  // Planillas (HU-21, HU-24, HU-25)
  { method: 'POST', path: '/api/planillas', access: { anyOf: ['planilla:calculate'] } },
  { method: 'GET', path: '/api/planillas', access: { anyOf: ['planilla:read'] } },
  { method: 'GET', path: '/api/planillas/historial', access: { anyOf: ['planilla:read'] } },
  {
    method: 'GET',
    path: '/api/planillas/kpis',
    access: { anyOf: ['dashboard:read', 'dashboard:read_area'] },
  },
  { method: 'GET', path: '/api/planillas/:id', access: { anyOf: ['planilla:read'] } },
  { method: 'GET', path: '/api/planillas/:id/detalles', access: { anyOf: ['planilla:read'] } },
  { method: 'POST', path: '/api/planillas/:id/cerrar', access: { anyOf: ['planilla:close'] } },

  // Extensiones del motor de cálculo (TSK-DEV2-201..204), pendientes de aprobación
  {
    method: 'GET',
    path: '/api/planillas/:id/detalles/:empleadoId',
    access: { anyOf: ['planilla:read', 'boleta:read_all'] },
  },
  {
    method: 'POST',
    path: '/api/planillas/:id/recalcular',
    access: { anyOf: ['planilla:calculate'] },
  },
  { method: 'DELETE', path: '/api/planillas/:id', access: { anyOf: ['planilla:calculate'] } },
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
  { method: 'GET', path: '/api/planillas/mis-pagos', access: { anyOf: ['boleta:read_own'] } },
  {
    method: 'GET',
    path: '/api/planillas/mis-pagos/:periodo',
    access: { anyOf: ['boleta:read_own'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/politica-retencion',
    access: { anyOf: ['planilla:read'] },
  },
]);
