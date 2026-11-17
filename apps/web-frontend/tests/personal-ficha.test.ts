import test from 'node:test';
import assert from 'node:assert/strict';
import { ROLE_PERMISSIONS, type RoleCode } from '../src/lib/auth';
import {
  canDownloadContracts,
  canGenerateContracts,
  canViewContracts,
  hasRemuneracion,
  mapEmployeeFicha,
  missingContractFields,
  showsLicensesTab,
  showsPayslipsTab,
} from '../src/lib/personal-ficha';
import { ApiError } from '../src/lib/api/api-error';
import { personalFichaApi } from '../src/lib/api/personal-ficha-api';
import { personalApi, type Employee } from '../src/lib/personal-api';

const employee: Employee = {
  id: '22222222-2222-4222-8222-222222222222',
  nombres: 'Ana María',
  apellidos: 'Rojas',
  ci: '******* LP',
  areaId: 'area-id',
  cargoId: 'cargo-id',
  fechaIngreso: '2026-01-15',
  estado: 'RATIFICADO',
};

test('mapea datos de ficha sin modificar la CI enmascarada del backend', () => {
  const ficha = mapEmployeeFicha(employee, {
    canReadSalary: false,
    areas: new Map(),
    cargos: new Map(),
  });

  assert.equal(ficha.fullName, 'Ana María Rojas');
  assert.equal(ficha.ci, '******* LP');
  assert.equal(ficha.area, 'Área no disponible');
  assert.equal(ficha.cargo, 'Cargo no disponible');
  assert.equal('remuneracion' in ficha, false);
});

test('omitir remuneración en la respuesta omite también el campo/etiqueta', () => {
  const ficha = mapEmployeeFicha(employee, {
    canReadSalary: true,
    areas: new Map(),
    cargos: new Map(),
  });

  assert.equal(hasRemuneracion(ficha.remuneracion), false);
  assert.equal('remuneracion' in ficha, false);
});

test('no expone remuneración aunque una respuesta incluya el dato sin permiso', () => {
  const ficha = mapEmployeeFicha(
    { ...employee, remuneracion: 9200 },
    { canReadSalary: false, areas: new Map(), cargos: new Map() },
  );

  assert.equal('remuneracion' in ficha, false);
});

test('resuelve nombres de catálogo solo cuando están disponibles', () => {
  const ficha = mapEmployeeFicha(employee, {
    canReadSalary: false,
    areas: new Map([['area-id', { id: 'area-id', nombre: 'Finanzas' }]]),
    cargos: new Map([['cargo-id', { id: 'cargo-id', nombre: 'Analista' }]]),
  });

  assert.equal(ficha.area, 'Finanzas');
  assert.equal(ficha.cargo, 'Analista');
});

test('permisos reales del seed controlan generación, descarga y boletas', () => {
  const roles: RoleCode[] = [
    'ADMIN_GENERAL',
    'RRHH_OPERATIVO',
    'ENCARGADO_NOMINA',
    'JEFE_AREA',
    'FUNCIONARIO',
    'GERENCIA',
    'AUDITOR',
  ];

  const generators = roles.filter((role) => canGenerateContracts(ROLE_PERMISSIONS[role]));
  assert.deepEqual(generators, ['RRHH_OPERATIVO']);
  assert.equal(canGenerateContracts(['contrato:read']), false);
  assert.equal(canGenerateContracts(['contrato:download_own']), false);

  assert.equal(canDownloadContracts(ROLE_PERMISSIONS.ADMIN_GENERAL), true);
  assert.equal(canViewContracts(ROLE_PERMISSIONS.GERENCIA), true);
  assert.equal(canDownloadContracts(['personal:read']), false);

  const allBoletaReaders = roles.filter((role) =>
    showsPayslipsTab(ROLE_PERMISSIONS[role]),
  );
  assert.deepEqual(allBoletaReaders, ['ENCARGADO_NOMINA', 'AUDITOR']);

  const licenseReaders = roles.filter((role) =>
    showsLicensesTab(ROLE_PERMISSIONS[role]),
  );
  assert.deepEqual(licenseReaders, ['RRHH_OPERATIVO', 'AUDITOR']);
});

test('extrae campos faltantes del DTO de error 422 sin filtrar otros detalles', () => {
  const error = new ApiError({
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    message: 'Uno o más campos no son válidos.',
    details: {
      fields: { remuneracion: 'Dato requerido.', duracion_prueba: 'Dato requerido.' },
      datoPersonal: 'no debe mostrarse',
    },
    traceId: 'trace-422',
  });

  assert.deepEqual(missingContractFields(error), ['remuneracion', 'duracion_prueba']);
  assert.deepEqual(
    missingContractFields(
      new ApiError({
        statusCode: 422,
        code: 'VALIDATION_ERROR',
        message: 'Faltan datos.',
        details: { camposFaltantes: ['cargo', 'fecha_ingreso'] },
        traceId: 'trace-422-b',
      }),
    ),
    ['cargo', 'fecha_ingreso'],
  );
});

test('consulta licencias y boletas por empleado con paginación autenticada', async () => {
  const requests: string[] = [];
  const request = async (path: string) => {
    requests.push(path);
    return new Response(
      JSON.stringify({
        data: [],
        meta: { page: 2, pageSize: 10, total: 0, totalPages: 0 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  const employeeId = 'employee-id';

  await personalFichaApi.listLicenses(request, employeeId, 2, 10);
  await personalFichaApi.listPayslips(request, employeeId, 2, 10);

  assert.deepEqual(requests, [
    '/vacaciones/empleados/employee-id/licencias?page=2&pageSize=10',
    '/planillas/boletas/funcionarios/employee-id?page=2&pageSize=10',
  ]);
});

test('registra la baja enviando solo los campos admitidos por el backend', async () => {
  let requestBody: FormData | undefined;
  const request = async (_path: string, options?: RequestInit) => {
    requestBody = options?.body as FormData;
    return new Response(JSON.stringify({ estado: 'INACTIVO' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  await personalApi.terminateEmployee(request, employee.id, {
    fechaBaja: '2020-11-17',
    motivo: 'Despido laboral',
    aplicaDesahucio: false,
    sueldoPromedio: 3000,
    finiquitoTotal: 66566.66,
    finiquitoDetalle: {
      indemnizacion: 60883.33,
      desahucio: 0,
      aguinaldoProporcional: 2683.33,
      vacacionesPendientes: 3000,
      diasVacacionesPendientes: 30,
    },
  });

  assert.ok(requestBody);
  assert.deepEqual(JSON.parse(requestBody.get('datos') as string), {
    fechaBaja: '2020-11-17',
    motivo: 'Despido laboral',
    aplicaDesahucio: false,
    diasVacacionesPendientes: 30,
  });
});
