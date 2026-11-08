import { defineServiceRoutes } from '../route.types';

/**
 * Fuente: docs/api/contratos.md (TSK-ARQ-201, Sprint 2).
 * Cualquier endpoint nuevo debe declararse aquí y en el controlador del
 * servicio con @RequirePermission. Rutas no declaradas = denegación por defecto.
 */
export const CONTRATOS_ROUTES = defineServiceRoutes('contratos', [
  // Plantillas (HU-17 / RF-20)
  {
    method: 'POST',
    path: '/api/contratos/plantillas',
    access: { anyOf: ['contrato:template_manage'] },
  },
  {
    method: 'GET',
    path: '/api/contratos/plantillas',
    access: { anyOf: ['contrato:template_manage', 'contrato:generate'] },
  },
  {
    method: 'GET',
    path: '/api/contratos/plantillas/:id',
    access: { anyOf: ['contrato:template_manage', 'contrato:generate'] },
  },
  {
    method: 'PATCH',
    path: '/api/contratos/plantillas/:id',
    access: { anyOf: ['contrato:template_manage'] },
  },

  // Consultas para ficha consolidada (HU-09) — antes de /:id
  {
    method: 'GET',
    path: '/api/contratos/por-empleado/:empleadoId',
    access: { anyOf: ['contrato:read', 'personal:read'] },
  },

  // Contratos individuales, preview, PDF y versiones (HU-18, HU-19 / RF-21, RF-22)
  {
    method: 'POST',
    path: '/api/contratos/preview',
    access: { anyOf: ['contrato:generate'] },
  },
  {
    method: 'POST',
    path: '/api/contratos',
    access: { anyOf: ['contrato:generate'] },
  },
  {
    method: 'GET',
    path: '/api/contratos',
    access: { anyOf: ['contrato:read'] },
  },
  {
    method: 'GET',
    path: '/api/contratos/:id',
    access: { anyOf: ['contrato:read', 'contrato:download_own'] },
  },
  {
    method: 'POST',
    path: '/api/contratos/:id/preview',
    access: { anyOf: ['contrato:generate', 'contrato:read'] },
  },
  {
    method: 'POST',
    path: '/api/contratos/:id/pdf',
    access: { anyOf: ['contrato:generate'] },
  },
  {
    method: 'GET',
    path: '/api/contratos/:id/versiones/:versionId/descarga',
    access: { anyOf: ['contrato:read', 'contrato:download_own'] },
  },
]);
