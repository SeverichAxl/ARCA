import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/lib/api/api-error';
import {
  parseContentDispositionFilename,
  performFileDownload,
  resolveDownloadErrorMessage,
  sanitizeDownloadFilename,
} from '../src/lib/api/file-download';

function jsonError(status: number, code: string) {
  return new Response(
    JSON.stringify({
      statusCode: status,
      code,
      message: 'Detalle interno que no debe mostrarse',
      traceId: `trace-${status}`,
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

function pdfResponse(disposition?: string) {
  return new Response(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), {
    status: 200,
    headers: disposition ? { 'Content-Disposition': disposition } : undefined,
  });
}

test('parseContentDispositionFilename lee filename y filename*', () => {
  assert.equal(
    parseContentDispositionFilename('attachment; filename="boleta-2026-10.pdf"'),
    'boleta-2026-10.pdf',
  );
  assert.equal(
    parseContentDispositionFilename("attachment; filename*=UTF-8''boleta%20octubre.pdf"),
    'boleta octubre.pdf',
  );
  assert.equal(parseContentDispositionFilename('attachment'), null);
  assert.equal(parseContentDispositionFilename(null), null);
});

test('sanitizeDownloadFilename elimina rutas y caracteres inseguros', () => {
  assert.equal(sanitizeDownloadFilename('../../etc/passwd', 'default.pdf'), 'passwd');
  assert.equal(sanitizeDownloadFilename('boleta<>.pdf', 'default.pdf'), 'boleta__.pdf');
  assert.equal(sanitizeDownloadFilename('   ', 'default.pdf'), 'default.pdf');
});

test('descarga exitosa usa el nombre de Content-Disposition y revoca el object URL', async () => {
  let createdBlob: unknown = null;
  let triggered: { url: string; filename: string } | null = null;
  let revoked: string | null = null;

  const result = await performFileDownload(
    pdfResponse('attachment; filename="boleta-2026-10.pdf"'),
    {
      defaultFileName: 'default.pdf',
      environment: {
        createObjectUrl: (blob) => {
          createdBlob = blob;
          return 'blob:demo-1';
        },
        triggerDownload: (url, filename) => {
          triggered = { url, filename };
        },
        revokeObjectUrl: (url) => {
          revoked = url;
        },
      },
    },
  );

  assert.ok(createdBlob instanceof Blob);
  assert.deepEqual(triggered, { url: 'blob:demo-1', filename: 'boleta-2026-10.pdf' });
  assert.equal(revoked, 'blob:demo-1');
  assert.equal(result.filename, 'boleta-2026-10.pdf');
});

test('usa el nombre por defecto si falta Content-Disposition', async () => {
  let triggeredFilename: string | null = null;

  const result = await performFileDownload(pdfResponse(), {
    defaultFileName: 'boleta-2026-10.pdf',
    environment: {
      createObjectUrl: () => 'blob:demo-2',
      triggerDownload: (_url, filename) => {
        triggeredFilename = filename;
      },
      revokeObjectUrl: () => undefined,
    },
  });

  assert.equal(triggeredFilename, 'boleta-2026-10.pdf');
  assert.equal(result.filename, 'boleta-2026-10.pdf');
});

test('revoca el object URL aunque el disparador falle', async () => {
  let revoked: string | null = null;

  await assert.rejects(
    () =>
      performFileDownload(pdfResponse(), {
        defaultFileName: 'default.pdf',
        environment: {
          createObjectUrl: () => 'blob:demo-3',
          triggerDownload: () => {
            throw new Error('click falló');
          },
          revokeObjectUrl: (url) => {
            revoked = url;
          },
        },
      }),
    /click falló/,
  );

  assert.equal(revoked, 'blob:demo-3');
});

test('403 y 404 no exponen detalles del servidor', async () => {
  for (const status of [403, 404] as const) {
    await assert.rejects(
      () =>
        performFileDownload(jsonError(status, status === 403 ? 'FORBIDDEN' : 'NOT_FOUND'), {
          defaultFileName: 'default.pdf',
        }),
      (error: unknown) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.statusCode, status);
        return true;
      },
    );

    const resolved = resolveDownloadErrorMessage(
      new ApiError({
        statusCode: status,
        code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
        message: 'Detalle interno que no debe mostrarse',
        traceId: 'trace-x',
      }),
    );
    assert.deepEqual(resolved, {
      message: 'No tienes acceso a este documento',
      hideDetails: true,
    });
  }
});

test('401 deja el mensaje de sesión y no se traga el error', async () => {
  await assert.rejects(
    () =>
      performFileDownload(jsonError(401, 'AUTH_TOKEN_EXPIRED'), {
        defaultFileName: 'default.pdf',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 401);
      return true;
    },
  );

  const resolved = resolveDownloadErrorMessage(
    new ApiError({
      statusCode: 401,
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'La sesión expiró.',
      traceId: 'trace-401',
    }),
  );
  assert.equal(resolved.message, 'Tu sesión expiró. Inicia sesión nuevamente.');
  assert.equal(resolved.hideDetails, false);
});
