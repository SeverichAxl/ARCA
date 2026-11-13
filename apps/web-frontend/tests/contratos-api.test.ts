import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/lib/api/api-error';
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

test('generarPdf llama el endpoint real con datos multipart opcionales', async () => {
  let capturedPath = '';
  let capturedOptions: RequestInit | undefined;
  const requester: Requester = async (path, options) => {
    capturedPath = path;
    capturedOptions = options;
    return new Response(
      JSON.stringify({
        contratoId: '33333333-3333-4333-8333-333333333333',
        version: 1,
        versionId: '44444444-4444-4444-8444-444444444444',
        estado: 'GENERADO',
        documento: {
          publicIdRef: '33333333-3333-4333-8333-333333333333/v1',
          versionId: '44444444-4444-4444-8444-444444444444',
          hashSha256: 'a'.repeat(64),
          bytes: 125000,
          mime: 'application/pdf',
          creadoEn: '2026-11-08T12:00:00.000Z',
        },
        firmadoTrabajador: false,
        firmadoRepresentante: false,
        camposFaltantes: [],
        advertencias: [],
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const result = await contratosApi.generarPdf(
    requester,
    '33333333-3333-4333-8333-333333333333',
  );

  assert.equal(capturedPath, '/contratos/33333333-3333-4333-8333-333333333333/pdf');
  assert.equal(capturedOptions?.method, 'POST');
  assert.ok(capturedOptions?.body instanceof FormData);
  assert.equal(
    (capturedOptions?.body as FormData).get('datos'),
    JSON.stringify({ incluirFirmas: true }),
  );
  assert.equal(result.estado, 'GENERADO');
});

test('convierte errores 403, 404, 409 y 422 conservando sus DTO de error', async () => {
  const samples = [
    {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'No tiene permiso para consultar los contratos del empleado.',
      traceId: 'd2f9f4a7-0f4c-4a51-9d0f-3a6d5b8e7c11',
    },
    {
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'No se encontraron contratos para el empleado.',
      traceId: '7c1b6a2e-9f3d-4b70-8e5a-1c4d2f9a6b33',
    },
    {
      statusCode: 409,
      code: 'CONFLICT',
      message: 'La operación entra en conflicto con el estado actual.',
      traceId: 'trace-409',
    },
    {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      details: { fields: { remuneracion: 'Dato requerido.' } },
      traceId: 'trace-422',
    },
  ] as const;

  for (const sample of samples) {
    const requester: Requester = async () =>
      new Response(JSON.stringify(sample), {
        status: sample.statusCode,
        headers: { 'Content-Type': 'application/json' },
      });

    await assert.rejects(
      () =>
        contratosApi.createContrato(requester, {
          plantillaId: '11111111-1111-4111-8111-111111111111',
          empleadoId: '22222222-2222-4222-8222-222222222222',
        }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.statusCode, sample.statusCode);
        assert.equal(error.code, sample.code);
        assert.equal(error.traceId, sample.traceId);
        return true;
      },
    );
  }
});

test('la descarga consume URL firmada temporal sin reenviar credenciales', async () => {
  const signedUrl = 'https://storage.example/contrato.pdf?signature=temporary';
  let requestedPath = '';
  let fetchedUrl = '';
  let forwardedCredentials: RequestCredentials | undefined;
  const requester: Requester = async (path) => {
    requestedPath = path;
    return new Response(
      JSON.stringify({
        url: signedUrl,
        expiresInSeconds: 300,
        versionId: '44444444-4444-4444-8444-444444444444',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    fetchedUrl = String(input);
    forwardedCredentials = init?.credentials;
    return new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });
  };

  try {
    const response = await contratosApi.descargarContrato(
      requester,
      '33333333-3333-4333-8333-333333333333',
      '44444444-4444-4444-8444-444444444444',
    );

    assert.equal(
      requestedPath,
      '/contratos/33333333-3333-4333-8333-333333333333/versiones/44444444-4444-4444-8444-444444444444/descarga',
    );
    assert.equal(fetchedUrl, signedUrl);
    assert.equal(forwardedCredentials, 'omit');
    assert.equal(response.headers.get('content-type'), 'application/pdf');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('la descarga acepta un PDF directo del endpoint autenticado', async () => {
  let fetched = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    fetched = true;
    throw new Error('No debe seguirse una URL firmada.');
  };
  const requester: Requester = async () =>
    new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
      status: 200,
      headers: { 'Content-Type': 'application/pdf' },
    });

  try {
    const response = await contratosApi.descargarContrato(
      requester,
      '33333333-3333-4333-8333-333333333333',
    );
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(fetched, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
