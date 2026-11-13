import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/lib/api/api-error';
import { PREVIEW_SUBJECTS } from '../src/lib/api/mocks/contratos.mock';
import {
  MOCK_BOLETA_EMPLOYEE_IDS,
  descargarBoleta,
  getBoleta,
  getMockBoletasForTests,
  listMisBoletas,
} from '../src/lib/api/mocks/planillas.mock';

process.env.NEXT_PUBLIC_API_MOCK_LATENCY = '0';

function resetEnv(): void {
  delete process.env.NEXT_PUBLIC_API_MOCK_ERROR;
}

function cents(value: string): number {
  const match = /^(-?)(\d+)\.(\d{2})$/.exec(value);
  assert.ok(match, `Importe no decimal con dos posiciones: ${value}`);
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 100 + Number(match[3]));
}

test('el funcionario de ejemplo tiene entre 8 y 12 boletas de 2026', () => {
  resetEnv();
  const boletas = getMockBoletasForTests().filter(
    (boleta) => boleta.empleadoId === MOCK_BOLETA_EMPLOYEE_IDS.principal,
  );

  assert.ok(boletas.length >= 8 && boletas.length <= 12);
  assert.ok(boletas.every((boleta) => /^2026-(0[1-9]|1[0-2])$/.test(boleta.periodo)));
  assert.equal(new Set(boletas.map((boleta) => boleta.periodo)).size, boletas.length);
});

test('los empleados del mock de planillas coinciden con los de contratos', () => {
  assert.equal(MOCK_BOLETA_EMPLOYEE_IDS.principal, PREVIEW_SUBJECTS[0]!.id);
  assert.equal(MOCK_BOLETA_EMPLOYEE_IDS.secundario, PREVIEW_SUBJECTS[1]!.id);
});

test('las cuentas de todas las boletas cuadran en centavos', () => {
  resetEnv();
  for (const boleta of getMockBoletasForTests()) {
    const desglose = boleta.desglose;

    assert.equal(
      cents(desglose.totalGanado),
      cents(desglose.haberBasico) +
        cents(desglose.bonoAntiguedad) +
        cents(desglose.horasExtra) +
        cents(desglose.otrosIngresos),
      `Total ganado inconsistente en ${boleta.periodo}`,
    );

    assert.equal(
      cents(desglose.totalDescuentos),
      cents(desglose.aporteLaboral) +
        cents(desglose.ans) +
        cents(desglose.rcIva) +
        cents(desglose.otrosDescuentos),
      `Total descuentos inconsistente en ${boleta.periodo}`,
    );

    assert.equal(
      cents(desglose.liquidoPagable),
      cents(desglose.totalGanado) - cents(desglose.totalDescuentos),
      `Líquido inconsistente en ${boleta.periodo}`,
    );
    assert.equal(desglose.liquidoPagable, boleta.liquidoPagable);

    // El aporte patronal es del empleador y no se descuenta al funcionario.
    assert.notEqual(desglose.totalDescuentos, desglose.aportePatronal);
  }
});

test('los subsidios son informativos y no suman al líquido pagable', () => {
  resetEnv();
  const boletas = getMockBoletasForTests();

  for (const boleta of boletas) {
    const subsidios = boleta.desglose.subsidiosInformativos.reduce(
      (total, subsidio) => total + cents(subsidio.monto),
      0,
    );

    assert.equal(
      cents(boleta.desglose.liquidoPagable),
      cents(boleta.desglose.totalGanado) - cents(boleta.desglose.totalDescuentos),
    );

    if (subsidios > 0) {
      assert.notEqual(
        cents(boleta.desglose.liquidoPagable),
        cents(boleta.desglose.totalGanado) -
          cents(boleta.desglose.totalDescuentos) -
          subsidios,
        `Los subsidios no deben restarse/sumarse en ${boleta.periodo}`,
      );
    }
  }
});

test('todos los hashes son hexadecimales de 64 caracteres', () => {
  resetEnv();
  for (const boleta of getMockBoletasForTests()) {
    assert.match(boleta.hashSha256, /^[a-f0-9]{64}$/);
  }
});

test('la lista devuelve solo boletas propias y el shape del contrato', async () => {
  resetEnv();
  const page = await listMisBoletas(
    { page: 1, pageSize: 4 },
    MOCK_BOLETA_EMPLOYEE_IDS.principal,
  );

  assert.equal(page.meta.page, 1);
  assert.equal(page.meta.pageSize, 4);
  assert.equal(page.meta.total, 10);
  assert.equal(page.data.length, 4);
  assert.ok(page.data.every((boleta) => boleta.empleadoId === MOCK_BOLETA_EMPLOYEE_IDS.principal));
  assert.ok(page.data.every((boleta) => !('desglose' in boleta)));
  assert.ok(page.data.every((boleta) => boleta.estado === 'EMITIDA'));
  assert.ok(page.data.every((boleta) => /^\d+\.\d{2}$/.test(boleta.liquidoPagable)));
});

test('la lista filtra por periodo', async () => {
  resetEnv();
  const page = await listMisBoletas(
    { periodo: '2026-10' },
    MOCK_BOLETA_EMPLOYEE_IDS.principal,
  );

  assert.equal(page.meta.total, 1);
  assert.equal(page.data[0]!.periodo, '2026-10');
});

test('una boleta ajena responde 404, incluso si se conoce el id', async () => {
  resetEnv();
  const ajena = getMockBoletasForTests().find(
    (boleta) => boleta.empleadoId === MOCK_BOLETA_EMPLOYEE_IDS.secundario,
  );
  const propia = getMockBoletasForTests().find(
    (boleta) => boleta.empleadoId === MOCK_BOLETA_EMPLOYEE_IDS.principal,
  );
  assert.ok(ajena);
  assert.ok(propia);

  await assert.rejects(
    () => getBoleta(ajena.id, MOCK_BOLETA_EMPLOYEE_IDS.principal),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 404);
      assert.equal(error.code, 'NOT_FOUND');
      return true;
    },
  );

  await assert.rejects(
    () => getBoleta(propia.id, MOCK_BOLETA_EMPLOYEE_IDS.secundario),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});

test('el detalle propio incluye desglose y el ajeno no se filtra', async () => {
  resetEnv();
  const propia = getMockBoletasForTests().find(
    (boleta) => boleta.empleadoId === MOCK_BOLETA_EMPLOYEE_IDS.principal,
  );
  assert.ok(propia);

  const detalle = await getBoleta(propia.id, MOCK_BOLETA_EMPLOYEE_IDS.principal);
  assert.equal(detalle.id, propia.id);
  assert.ok(detalle.desglose);
  assert.equal(detalle.desglose?.liquidoPagable, detalle.liquidoPagable);

  await assert.rejects(
    () => getBoleta(propia.id, MOCK_BOLETA_EMPLOYEE_IDS.secundario),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});

test('la descarga propia devuelve un PDF y la ajena 404', async () => {
  resetEnv();
  const propia = getMockBoletasForTests().find(
    (boleta) => boleta.empleadoId === MOCK_BOLETA_EMPLOYEE_IDS.principal,
  );
  const ajena = getMockBoletasForTests().find(
    (boleta) => boleta.empleadoId === MOCK_BOLETA_EMPLOYEE_IDS.secundario,
  );
  assert.ok(propia);
  assert.ok(ajena);

  const response = await descargarBoleta(
    propia.id,
    MOCK_BOLETA_EMPLOYEE_IDS.principal,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(
    response.headers.get('content-disposition'),
    `attachment; filename="boleta-${propia.periodo}.pdf"`,
  );
  assert.match(await response.text(), /^%PDF-1\.4/);

  await assert.rejects(
    () => descargarBoleta(ajena.id, MOCK_BOLETA_EMPLOYEE_IDS.principal),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});

test('NEXT_PUBLIC_API_MOCK_ERROR permite simular 404 en planillas', async () => {
  resetEnv();
  process.env.NEXT_PUBLIC_API_MOCK_ERROR = 'planillas:404';

  await assert.rejects(
    () => listMisBoletas({}, MOCK_BOLETA_EMPLOYEE_IDS.principal),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 404);
      assert.match(error.traceId, /^mock-/);
      return true;
    },
  );

  resetEnv();
});
