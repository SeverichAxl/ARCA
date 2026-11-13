import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

/**
 * DOMPurify detecta `window` al importarse. Por eso se prepara jsdom antes de
 * cargar dinámicamente el módulo de vista previa.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
});
const globalRecord = globalThis as unknown as Record<string, unknown>;
globalRecord.window = dom.window;
globalRecord.document = dom.window.document;
// tsx compila TSX con la transformación clásica; exponer React evita
// "React is not defined" al renderizar componentes importados dinámicamente.
globalRecord.React = React;

async function loadPreviewModule() {
  return import('../src/lib/api/contratos/preview');
}

test('PREVIEW_SANDBOX no permite scripts ni same-origin', async () => {
  const { PREVIEW_SANDBOX } = await loadPreviewModule();
  assert.equal(PREVIEW_SANDBOX, '');
});

test('sanitizePreviewHtml elimina scripts, eventos y URLs peligrosas', async () => {
  const { sanitizePreviewHtml } = await loadPreviewModule();
  const dirty = [
    '<p onclick="alert(1)">Texto</p>',
    '<script>alert("xss")</script>',
    '<img src="https://evil.example/track.png" onerror="alert(1)">',
    '<a href="javascript:alert(1)">Enlace</a>',
    '<iframe src="https://evil.example"></iframe>',
    '<svg><script>alert(1)</script></svg>',
  ].join('');

  const clean = sanitizePreviewHtml(dirty);

  assert.doesNotMatch(clean, /<script/i);
  assert.doesNotMatch(clean, /onclick|onerror/i);
  assert.doesNotMatch(clean, /javascript:/i);
  assert.doesNotMatch(clean, /<iframe/i);
  assert.doesNotMatch(clean, /<svg/i);
  assert.match(clean, /Texto/);
});

test('sanitizePreviewHtml conserva formato permitido y variables', async () => {
  const { sanitizePreviewHtml } = await loadPreviewModule();
  const clean = sanitizePreviewHtml(
    '<h1>Título</h1><p><strong>{{nombre_empleado}}</strong></p><table><tbody><tr><td>Dato</td></tr></tbody></table>',
  );

  assert.match(clean, /<h1>Título<\/h1>/);
  assert.match(clean, /\{\{nombre_empleado\}\}/);
  assert.match(clean, /<table>/);
});

test('buildPreviewDocument incluye CSP, hoja A4 y contenido sanitizado', async () => {
  const { buildPreviewDocument, PREVIEW_CSP } = await loadPreviewModule();
  const document = buildPreviewDocument(
    '<p>{{nombre_empleado}}</p><script>alert(1)</script>',
    { nombre_empleado: 'Ana Rojas' },
  );

  assert.match(document, /<!doctype html>/i);
  assert.match(document, /Content-Security-Policy/);
  assert.ok(document.includes(PREVIEW_CSP));
  assert.match(document, /class="sheet"/);
  assert.match(document, /Ana Rojas/);
  assert.doesNotMatch(document, /<script/i);
});

test('SafeHtmlPreview renderiza un iframe sandbox con srcDoc', async () => {
  const { SafeHtmlPreview } = await import(
    '../src/components/shared/safe-html-preview'
  );
  const markup = renderToStaticMarkup(
    createElement(SafeHtmlPreview, {
      html: '<p>{{nombre_empleado}}</p><script>alert(1)</script>',
      values: { nombre_empleado: 'Ana Rojas' },
      title: 'Vista previa de prueba',
    }),
  );

  assert.match(markup, /<iframe/);
  assert.match(markup, /sandbox=""/);
  assert.match(markup, /title="Vista previa de prueba"/);
  assert.match(markup, /srcdoc=/i);
  assert.doesNotMatch(markup, /<script/i);
  assert.match(markup, /Ana Rojas/);
});
