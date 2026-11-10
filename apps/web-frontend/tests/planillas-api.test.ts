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
