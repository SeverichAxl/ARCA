import test from 'node:test';
import assert from 'node:assert/strict';
import { planillasApi } from '../src/lib/api/planillas/planillas-api';
import type { PageResult, PagoPlanilla, PlanillaCabecera } from '../src/lib/api/planillas/types';

function withMockDomains(raw: string, run: () => Promise<void>) {
  const previous = process.env.NEXT_PUBLIC_API_MOCKS;
  process.env.NEXT_PUBLIC_API_MOCKS = raw;
  return run().finally(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_MOCKS;
    else process.env.NEXT_PUBLIC_API_MOCKS = previous;
  });
}

test('la autoconsulta usa mis-pagos y pagina sin enviar empleadoId', async () => {
  await withMockDomains('', async () => {
    const paths: string[] = [];
    const firstPage: PageResult<PagoPlanilla> = {
      data: [{ id: 'pago-1' } as PagoPlanilla],
      meta: { page: 1, pageSize: 200, total: 201, totalPages: 2 },
    };
    const secondPage: PageResult<PagoPlanilla> = {
      data: [{ id: 'pago-2' } as PagoPlanilla],
      meta: { page: 2, pageSize: 200, total: 201, totalPages: 2 },
    };
    const pages = [firstPage, secondPage];

    const result = await planillasApi.listMisPagos(async (path) => {
      paths.push(path);
      return Response.json(pages.shift());
    }, 'employee-from-session');

    assert.deepEqual(paths, [
      '/planillas/mis-pagos?page=1&pageSize=200',
      '/planillas/mis-pagos?page=2&pageSize=200',
    ]);
    assert.ok(paths.every((path) => !path.includes('empleadoId')));
    assert.deepEqual(result.data.map((pago) => pago.id), ['pago-1', 'pago-2']);
  });
});

test('la descarga propia usa periodo y entrega el PDF directamente', async () => {
  await withMockDomains('', async () => {
    let requestedPath = '';
    const pdf = new Response('%PDF-1.4', {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
    const response = await planillasApi.descargarBoletaPropia(
      async (path) => {
        requestedPath = path;
        return pdf;
      },
      '2026-10',
      'employee-from-session',
    );

    assert.equal(requestedPath, '/planillas/boletas/mias/2026-10/pdf');
    assert.equal(requestedPath.includes('employee-from-session'), false);
    assert.equal(response, pdf);
  });
});

test('la vista autorizada consulta solo planillas cerradas y el detalle paginado', async () => {
  await withMockDomains('', async () => {
    const paths: string[] = [];
    const planillas: PageResult<PlanillaCabecera> = {
      data: [],
      meta: { page: 1, pageSize: 12, total: 0 },
    };
    const detalle: PageResult<PagoPlanilla> = {
      data: [],
      meta: { page: 2, pageSize: 25, total: 26, totalPages: 2 },
    };

    await planillasApi.listClosedPlanillas(
      async (path) => {
        paths.push(path);
        return Response.json(planillas);
      },
      { page: 1, pageSize: 12, desde: '2026-01', hasta: '2026-12' },
    );
    await planillasApi.listPlanillaDetalle(
      async (path) => {
        paths.push(path);
        return Response.json(detalle);
      },
      'planilla-id',
      2,
      25,
    );

    assert.equal(
      paths[0],
      '/planillas?page=1&pageSize=12&estado=CERRADA&desde=2026-01&hasta=2026-12',
    );
    assert.equal(paths[1], '/planillas/planilla-id/detalle?page=2&pageSize=25');
  });
});

test('calcula el periodo y cierra la planilla con los endpoints autenticados', async () => {
  await withMockDomains('', async () => {
    const calls: Array<{ path: string; method: string | undefined }> = [];
    const planilla = {
      id: 'planilla-id',
      periodo: '2026-10',
      anio: 2026,
      mes: 10,
      estado: 'BORRADOR',
      totalEmpleados: 3,
      totales: {
        totalGanado: '3000.00',
        aportesLaborales: '381.30',
        ans: '0.00',
        rcIva: '0.00',
        otrosDescuentos: '0.00',
        liquidoPagable: '2618.70',
        aportesPatronales: '501.30',
      },
      cerradoEn: null,
      inmutable: false,
    };
    const request = async (path: string, options?: RequestInit) => {
      calls.push({ path, method: options?.method });
      if (path.includes('/calcular')) {
        return Response.json({
          planilla,
          observaciones: [],
          duracionTotalMs: 120,
        });
      }
      return Response.json({
        ...planilla,
        estado: 'CERRADA',
        cerradoEn: '2026-11-01T00:00:00.000Z',
        inmutable: true,
      });
    };

    const result = await planillasApi.calcularPeriodo(request, '2026-10');
    const closed = await planillasApi.cerrarPlanilla(request, result.planilla.id);

    assert.deepEqual(calls, [
      { path: '/planillas/periodos/2026-10/calcular', method: 'POST' },
      { path: '/planillas/planilla-id/cerrar', method: 'POST' },
    ]);
    assert.equal(result.planilla.totalEmpleados, 3);
    assert.equal(result.duracionTotalMs, 120);
    assert.equal(closed.estado, 'CERRADA');
  });
});

test('no simula cálculo o cierre cuando planillas usa mock', async () => {
  await withMockDomains('planillas', async () => {
    let requestCalled = false;
    const request = async () => {
      requestCalled = true;
      return Response.json({});
    };

    await assert.rejects(
      planillasApi.calcularPeriodo(request, '2026-10'),
      /requieren conexión con el servicio real/,
    );
    await assert.rejects(
      planillasApi.cerrarPlanilla(request, 'planilla-id'),
      /requieren conexión con el servicio real/,
    );
    assert.equal(requestCalled, false);
  });
});

test('exporta planillas cerradas en CSV o XLSX mediante el endpoint autenticado', async () => {
  await withMockDomains('', async () => {
    const paths: string[] = [];
    const request = async (path: string) => {
      paths.push(path);
      return new Response('archivo', { status: 200 });
    };

    await planillasApi.exportarPlanilla(request, 'planilla/id', 'csv');
    await planillasApi.exportarPlanilla(request, 'planilla-id', 'xlsx');

    assert.deepEqual(paths, [
      '/planillas/planilla%2Fid/exportar?format=csv',
      '/planillas/planilla-id/exportar?format=xlsx',
    ]);
  });
});

test('la descarga autorizada usa planilla y funcionario; la autorización queda en backend', async () => {
  await withMockDomains('', async () => {
    let requestedPath = '';
    const pdf = new Response('%PDF-1.4', {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
    const response = await planillasApi.descargarBoletaAutorizada(
      async (path) => {
        requestedPath = path;
        return pdf;
      },
      'planilla-id',
      'employee-id',
    );
    assert.equal(
      requestedPath,
      '/planillas/boletas/planilla-id/empleados/employee-id/pdf',
    );
    assert.equal(response, pdf);
  });
});
