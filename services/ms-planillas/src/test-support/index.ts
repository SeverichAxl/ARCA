import type { EmpleadoNomina } from '../domain/nomina/calculo';
import type { Actor, Clock } from '../domain/planillas/planilla.models';
import { PlanillasService } from '../application/planillas/planillas.service';
import { InMemoryRepo } from './in-memory-planilla.repository';

export const EMPLEADOS_FAKE: EmpleadoNomina[] = [
  {
    empleadoId: '00000000-0000-4000-8000-000000000001',
    nombreCompleto: 'Ana Rojas',
    ciEnmascarado: '***4567',
    areaId: '00000000-0000-4000-8000-0000000000a1',
    cargoId: '00000000-0000-4000-8000-0000000000c1',
    fechaIngreso: '2020-01-01',
    haberBasico: 500000n,
  },
  {
    empleadoId: '00000000-0000-4000-8000-000000000002',
    nombreCompleto: 'Luis Flores',
    ciEnmascarado: '***8910',
    areaId: '00000000-0000-4000-8000-0000000000a2',
    cargoId: '00000000-0000-4000-8000-0000000000c2',
    fechaIngreso: '2019-03-15',
    haberBasico: 450000n,
  },
];

export const ACTOR_FAKE: Actor = {
  userId: 'test-user',
  empleadoId: null,
  rol: 'ADMIN',
  permisos: ['dashboard:read'],
};

const clock: Clock = {
  now: () => new Date('2026-11-15T12:00:00.000Z'),
};

export function crearServicio() {
  const repo = new InMemoryRepo();
  const personal = {
    listarActivos: async () => EMPLEADOS_FAKE,
  };
  const service = new PlanillasService(repo, personal, clock);
  return { service, repo, personal };
}

export function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;
}
