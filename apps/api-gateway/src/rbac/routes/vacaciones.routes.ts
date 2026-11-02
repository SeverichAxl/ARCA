import { defineServiceRoutes } from '../route.types';

/**
 * Fuente: docs/api/vacaciones.md. En rutas con varios ámbitos (propio, área o
 * empresa) se usa anyOf y el servicio decide la propiedad. En
 * `GET /solicitudes` y `GET /solicitudes/:id` la vista/query concreta también
 * se valida en el servicio.
 */
export const VACACIONES_ROUTES = defineServiceRoutes('vacaciones', [
  {
    method: 'GET',
    path: '/api/vacaciones/saldo',
    access: {
      anyOf: ['vacaciones:read_own', 'vacaciones:read_area', 'vacaciones:read_all'],
    },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/solicitudes',
    access: { anyOf: ['vacaciones:request'] },
  },
  {
    method: 'GET',
    path: '/api/vacaciones/solicitudes',
    access: {
      anyOf: [
        'vacaciones:read_own',
        'vacaciones:approve_jefe',
        'vacaciones:approve_rrhh',
      ],
    },
  },
  {
    method: 'GET',
    path: '/api/vacaciones/solicitudes/:id',
    access: {
      anyOf: ['vacaciones:read_own', 'vacaciones:read_area', 'vacaciones:read_all'],
    },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/solicitudes/:id/aprobar-jefe',
    access: { anyOf: ['vacaciones:approve_jefe'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/solicitudes/:id/aprobar-rrhh',
    access: { anyOf: ['vacaciones:approve_rrhh'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/solicitudes/:id/rechazar',
    access: { anyOf: ['vacaciones:approve_jefe', 'vacaciones:approve_rrhh'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/solicitudes/:id/cancelar',
    access: { anyOf: ['vacaciones:request'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/solicitudes/:id/excepcion',
    access: { anyOf: ['vacaciones:request'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/excepciones/:id/resolver',
    access: { anyOf: ['vacaciones:excepcion_resolve'] },
  },
  {
    method: 'GET',
    path: '/api/vacaciones/licencias',
    access: { anyOf: ['licencias:manage'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/licencias',
    access: { anyOf: ['licencias:manage'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/licencias/:id/autorizar',
    access: { anyOf: ['licencias:manage'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/licencias/:id/rechazar',
    access: { anyOf: ['licencias:manage'] },
  },
  {
    method: 'GET',
    path: '/api/vacaciones/feriados',
    access: { anyOf: ['vacaciones:config'] },
  },
  {
    method: 'POST',
    path: '/api/vacaciones/feriados',
    access: { anyOf: ['vacaciones:config'] },
  },
  {
    method: 'PATCH',
    path: '/api/vacaciones/feriados/:id',
    access: { anyOf: ['vacaciones:config'] },
  },
  {
    method: 'DELETE',
    path: '/api/vacaciones/feriados/:id',
    access: { anyOf: ['vacaciones:config'] },
  },
  {
    method: 'GET',
    path: '/api/vacaciones/configuracion',
    access: { anyOf: ['vacaciones:config'] },
  },
  {
    method: 'PATCH',
    path: '/api/vacaciones/configuracion/:clave',
    access: { anyOf: ['vacaciones:config'] },
  },
  {
    method: 'GET',
    path: '/api/vacaciones/calendario',
    access: {
      anyOf: ['vacaciones:read_own', 'vacaciones:read_area', 'vacaciones:read_all'],
    },
  },
]);
