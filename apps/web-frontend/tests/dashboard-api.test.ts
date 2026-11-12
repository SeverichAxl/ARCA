import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getExecutiveDashboard,
  getPayrollRange,
} from '../src/lib/dashboard-api';
import type { Requester } from '../src/lib/personal-api';

test('el dashboard consulta agregados reales de personal y planillas', async () => {
  const paths: string[] = [];
  const request: Requester = async (path) => {
    paths.push(path);
    if (path.includes('estado=EN_PRUEBA')) {
      return Response.json({ meta: { total: 3 } });
    }
    if (path.includes('estado=RATIFICADO')) {
      return Response.json({ meta: { total: 12 } });
    }
    if (path.includes('inamovilidad=true')) {
      return Response.json({ meta: { total: 2 } });
    }
    if (path.startsWith('/planillas/resumen?')) {
      return Response.json({
        data: [{
          periodo: '2026-10',
          totalEmpleados: 15,
          totalGanado: '1000.00',
          totalAportesPatronales: '170.00',
          costoTotal: '1170.00',
          totalLiquido: '870.00',
        }],
      });
    }
    throw new Error(`Ruta inesperada: ${path}`);
  };

  const result = await getExecutiveDashboard(request, new Date(2026, 9, 15));

  assert.equal(result.activeEmployees, 15);
  assert.equal(result.activeJobProtections, 2);
  assert.deepEqual(result.payrollPeriods[0], {
    periodo: '2026-10',
    totalEmpleados: 15,
    totalGanado: 1000,
    totalAportesPatronales: 170,
    costoTotal: 1170,
    totalLiquido: 870,
  });
  assert.equal(paths.length, 4);
  assert.ok(paths.some((path) => path.includes('desde=2023-11&hasta=2026-10')));
});

test('el rango de planillas maneja el cambio de año y rechaza rangos no soportados', () => {
  assert.deepEqual(getPayrollRange(new Date(2026, 0, 15), 12), {
    desde: '2025-02',
    hasta: '2026-01',
  });
  assert.throws(() => getPayrollRange(new Date(2026, 0, 15), 37), /entre 1 y 36 meses/);
});

test('el dashboard conserva el error de autorización del API', async () => {
  const request: Requester = async () =>
    Response.json({ message: 'No tiene permiso para realizar esta operación.' }, { status: 403 });

  await assert.rejects(
    getExecutiveDashboard(request, new Date(2026, 9, 15)),
    /No tiene permiso para realizar esta operación/,
  );
});
