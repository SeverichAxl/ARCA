import { defineServiceRoutes } from '../route.types';

/**
 * docs/api no publica todavía endpoints de planillas (Sprint 2). La tabla queda
 * vacía a propósito: sin declaración, toda ruta cae en denegación por defecto.
 * Cuando el contrato exista, agregar aquí cada endpoint con su permiso del seed.
 */
export const PLANILLAS_ROUTES = defineServiceRoutes('planillas', [
  {
    method: 'GET',
    path: '/api/planillas/parametros-legales',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/parametros-legales/:id',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'POST',
    path: '/api/planillas/parametros-legales',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'PATCH',
    path: '/api/planillas/parametros-legales/:id',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'DELETE',
    path: '/api/planillas/parametros-legales/:id',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'GET',
    path: '/api/planillas/escalas-antiguedad',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'POST',
    path: '/api/planillas/escalas-antiguedad',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'PATCH',
    path: '/api/planillas/escalas-antiguedad/:id',
    access: { anyOf: ['parametros_ley:update'] },
  },
  {
    method: 'DELETE',
    path: '/api/planillas/escalas-antiguedad/:id',
    access: { anyOf: ['parametros_ley:update'] },
  },
]);
