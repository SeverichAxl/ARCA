import test from 'node:test';
import assert from 'node:assert/strict';
import { contratosApi, type Requester } from '../src/lib/api/contratos/contratos-api';
import type { PreviewContrato } from '../src/lib/api/contratos/types';

const previousMocks = process.env.NEXT_PUBLIC_API_MOCKS;
process.env.NEXT_PUBLIC_API_MOCKS = 'none';

test.after(() => {
  if (previousMocks === undefined) delete process.env.NEXT_PUBLIC_API_MOCKS;
  else process.env.NEXT_PUBLIC_API_MOCKS = previousMocks;
});

const PREVIEW_RESPONSE: PreviewContrato = {
  contratoId: null,
  empleadoId: '22222222-2222-4222-8222-222222222222',
  plantillaId: '11111111-1111-4111-8111-111111111111',
  plantillaVersion: 2,
  htmlPreview: '<p>Contrato</p>',
  variablesResueltas: ['nombre_empleado'],
  camposFaltantes: [],
  advertencias: [],
};

test('previewPlantilla usa POST /contratos/preview con el body exacto', async () => {
  let capturedPath = '';
  let capturedOptions: RequestInit | undefined;
  const requester: Requester = async (path, options) => {
    capturedPath = path;
    capturedOptions = options;
    return new Response(JSON.stringify(PREVIEW_RESPONSE), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const controller = new AbortController();
  const result = await contratosApi.previewPlantilla(
    requester,
    {
      plantillaId: '11111111-1111-4111-8111-111111111111',
      empleadoId: '22222222-2222-4222-8222-222222222222',
    },
    { signal: controller.signal },
  );

  assert.equal(capturedPath, '/contratos/preview');
  assert.equal(capturedOptions?.method, 'POST');
  assert.equal(capturedOptions?.signal, controller.signal);
  assert.deepEqual(JSON.parse(String(capturedOptions?.body)), {
    plantillaId: '11111111-1111-4111-8111-111111111111',
    empleadoId: '22222222-2222-4222-8222-222222222222',
  });
  assert.equal(result.contratoId, null);
  assert.equal(result.plantillaId, PREVIEW_RESPONSE.plantillaId);
});

test('listPlantillas envía page, pageSize, activa y q al backend real', async () => {
  let capturedPath = '';
  const requester: Requester = async (path) => {
    capturedPath = path;
    return new Response(
      JSON.stringify({
        data: [],
        meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const result = await contratosApi.listPlantillas(requester, {
    page: 2,
    pageSize: 20,
    activa: false,
    q: '  indefinido  ',
  });

  const [pathname, query] = capturedPath.split('?');
  const params = new URLSearchParams(query);
  assert.equal(pathname, '/contratos/plantillas');
  assert.equal(params.get('page'), '2');
  assert.equal(params.get('pageSize'), '20');
  assert.equal(params.get('activa'), 'false');
  assert.equal(params.get('q'), 'indefinido');
  assert.equal(result.meta.totalPages, 0);
});
