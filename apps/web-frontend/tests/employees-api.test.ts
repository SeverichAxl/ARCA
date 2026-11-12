import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEmployeesQuery,
  toContractEmployee,
} from '../src/lib/api/contratos/employees-api';
import type { Employee as PersonalEmployee } from '../src/lib/personal-api';

function employee(overrides: Record<string, unknown> = {}): PersonalEmployee {
  return {
    id: '00000000-0000-4000-8000-000000000301',
    nombres: 'María Fernanda',
    apellidos: 'Quispe Mamani',
    ci: '******* LP',
    areaId: '00000000-0000-4000-8000-000000000104',
    area: { id: 'area', nombre: 'Finanzas' },
    cargoId: '00000000-0000-4000-8000-000000000204',
    cargo: { id: 'cargo', nombre: 'Contador Senior' },
    fechaIngreso: '2021-03-12',
    estado: 'RATIFICADO',
    diasPrueba: 90,
    remuneracion: 9200,
    ...overrides,
  } as PersonalEmployee;
}

test('buildEmployeesQuery envía solo los filtros reales y pagina', () => {
  const params = new URLSearchParams(
    buildEmployeesQuery({
      nombre: '  Ana Rojas  ',
      ci: ' 12345678 LP ',
      page: 3,
      pageSize: 500,
    }),
  );

  assert.equal(params.get('nombre'), 'Ana Rojas');
  assert.equal(params.get('ci'), '12345678 LP');
  assert.equal(params.get('page'), '3');
  assert.equal(params.get('pageSize'), '100');
  assert.equal(params.get('areaId'), null);
});

test('buildEmployeesQuery omite filtros vacíos', () => {
  const params = new URLSearchParams(
    buildEmployeesQuery({ nombre: '   ', ci: '', page: 1 }),
  );

  assert.equal(params.get('nombre'), null);
  assert.equal(params.get('ci'), null);
  assert.equal(params.get('page'), '1');
  assert.equal(params.get('pageSize'), '20');
});

test('toContractEmployee normaliza la remuneración decimal y no expone campos extra', () => {
  const mapped = toContractEmployee(employee({ remuneracion: '9200.50' }));

  assert.equal(mapped.id, '00000000-0000-4000-8000-000000000301');
  assert.equal(mapped.remuneracion, 9200.5);
  assert.equal(mapped.diasPrueba, 90);
  assert.equal('area' in mapped, false);
  assert.equal('cargo' in mapped, false);
});
