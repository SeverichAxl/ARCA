import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/lib/api/api-error';
import { loadMisBoletasPage } from '../src/lib/api/planillas/load';
import { planillasApi } from '../src/lib/api/planillas/planillas-api';
import type { Boleta, PageResult } from '../src/lib/api/planillas/types';

const EMPTY_PAGE: PageResult<Boleta> = {
  data: [],
  meta: { page: 1, pageSize: 20, total: 0 },
};

function withMockDomains(raw: string, run: () => Promise<void>) {
  const previous = process.env.NEXT_PUBLIC_API_MOCKS;
  process.env.NEXT_PUBLIC_API_MOCKS = raw;
  return run().finally(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_API_MOCKS;
    else process.env.NEXT_PUBLIC_API_MOCKS = previous;
  });
}

test('sin empleadoId no se llama al backend', async () => {
  let calls = 0;
  const result = await loadMisBoletasPage({
    request: async () => new Response('{}'),
    empleadoId: null,
    filters: { page: 2, pageSize: 10, periodo: '2026-10' },
    api: {
      listMisBoletas: async () => {
        calls += 1;
        return EMPTY_PAGE;
      },
    },
  });

  assert.equal(calls, 0);
  assert.deepEqual(result, {
    data: [],
    meta: { page: 2, pageSize: 10, total: 0 },
  });
});

test('con empleadoId delega en la API con el scope de sesión', async () => {
  let received: { empleadoId: string; periodo?: string } | null = null;
  await loadMisBoletasPage({
    request: async () => new Response('{}'),
    empleadoId: 'empleado-1',
    filters: { page: 1, pageSize: 10, periodo: '2026-10' },
    api: {
      listMisBoletas: async (_request, filters, empleadoId) => {
        received = { empleadoId, periodo: filters.periodo };
        return EMPTY_PAGE;
      },
    },
  });

  assert.deepEqual(received, { empleadoId: 'empleado-1', periodo: '2026-10' });
});

test('la consulta real no envía empleadoId en la URL', async () => {
  await withMockDomains('', async () => {
    let requestedPath = '';
    await planillasApi.listMisBoletas(
      async (path) => {
        requestedPath = path;
        return new Response(JSON.stringify(EMPTY_PAGE), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
      { page: 2, pageSize: 10, periodo: '2026-10' },
      'empleado-1',
    );

    assert.match(requestedPath, /^\/planillas\/boletas\?/);
    assert.match(requestedPath, /page=2/);
    assert.match(requestedPath, /pageSize=10/);
    assert.match(requestedPath, /periodo=2026-10/);
    assert.equal(requestedPath.includes('empleadoId'), false);
  });
});

test('descarga real sigue la URL firmada del contrato y soporta PDF directo', async () => {
  await withMockDomains('', async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; credentials?: RequestCredentials }> = [];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), credentials: init?.credentials });
      return new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="boleta.pdf"',
        },
      });
    }) as typeof fetch;

    try {
      const response = await planillasApi.descargarBoletaPdf(
        async () =>
          new Response(
            JSON.stringify({
              url: 'https://files.example/signed/boleta.pdf',
              expiresInSeconds: 60,
              hashSha256: 'a'.repeat(64),
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        'boleta-1',
        'empleado-1',
      );

      assert.equal(response.headers.get('content-type'), 'application/pdf');
      assert.deepEqual(calls, [
        {
          url: 'https://files.example/signed/boleta.pdf',
          credentials: 'omit',
        },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }

    const directPdf = new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
    const direct = await planillasApi.descargarBoletaPdf(
      async () => directPdf,
      'boleta-1',
      'empleado-1',
    );
    assert.equal(direct, directPdf);
  });
});

test('un 404 al pedir la descarga se propaga como ApiError', async () => {
  await withMockDomains('', async () => {
    await assert.rejects(
      () =>
        planillasApi.descargarBoletaPdf(
          async () =>
            new Response(
              JSON.stringify({
                statusCode: 404,
                code: 'NOT_FOUND',
                message: 'El recurso solicitado no existe.',
                traceId: 'trace-404',
              }),
              { status: 404, headers: { 'Content-Type': 'application/json' } },
            ),
          'boleta-ajena',
          'empleado-1',
        ),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.statusCode, 404);
        return true;
      },
    );
  });
});
