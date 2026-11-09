import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractVariables,
  findMalformedPlaceholders,
  findMissingValues,
  findUnbalancedBraces,
  getUnknownVariables,
  htmlToPlainText,
  substituteVariables,
  utf8ByteLength,
  validateTemplate,
} from '../src/lib/api/contratos/variables';
import {
  TEMPLATE_CONTENT_MAX_BYTES,
  TEMPLATE_NAME_MAX_LENGTH,
} from '../src/lib/api/contratos/types';

test('extractVariables devuelve variables únicas en orden de aparición', () => {
  const html = '<p>{{nombre_empleado}} {{ci}} {{nombre_empleado}}</p>';
  assert.deepEqual(extractVariables(html), ['nombre_empleado', 'ci']);
});

test('extractVariables ignora placeholders vacíos y recorta espacios externos', () => {
  assert.deepEqual(extractVariables('<p>{{ }}</p>'), []);
  // La extracción conserva el nombre recortado; la validación de formato lo
  // marca como malformado más adelante.
  assert.deepEqual(extractVariables('<p>{{nombre empleado}}</p>'), ['nombre empleado']);
  assert.deepEqual(extractVariables('<p>{{ nombre_empleado }}</p>'), ['nombre_empleado']);
});

test('findMalformedPlaceholders detecta nombres inválidos', () => {
  assert.deepEqual(findMalformedPlaceholders('<p>{{Nombre}}</p>'), ['{{Nombre}}']);
  assert.deepEqual(findMalformedPlaceholders('<p>{{nombre empleado}}</p>'), [
    '{{nombre empleado}}',
  ]);
  assert.deepEqual(findMalformedPlaceholders('<p>{{nombre_empleado}}</p>'), []);
});

test('findUnbalancedBraces detecta aperturas y cierres sueltos', () => {
  assert.equal(findUnbalancedBraces('<p>{{nombre_empleado}}</p>').length, 0);
  // Un `{{` sin cierre y su `}` suelto producen dos marcas.
  assert.equal(findUnbalancedBraces('<p>{{nombre_empleado}</p>').length, 2);
  assert.equal(findUnbalancedBraces('<p>nombre}}</p>').length, 2);
  assert.equal(findUnbalancedBraces('<p>texto { suelto }</p>').length, 2);
});

test('getUnknownVariables filtra contra la lista permitida', () => {
  assert.deepEqual(
    getUnknownVariables(['nombre_empleado', 'desconocida', 'otra']),
    ['desconocida', 'otra'],
  );
});

test('htmlToPlainText descarta etiquetas y detecta contenido vacío', () => {
  assert.equal(htmlToPlainText('<h1>Hola</h1><p>&nbsp;</p>'), 'Hola');
  assert.equal(htmlToPlainText('<p> </p>'), '');
});

test('validateTemplate acepta una plantilla válida con variables recomendadas', () => {
  const result = validateTemplate({
    nombre: 'Contrato indefinido',
    descripcion: 'Modelo base',
    contenidoHtml:
      '<p>{{nombre_empleado}} {{ci}} {{cargo}} {{remuneracion}} {{fecha_ingreso}} {{duracion_prueba}}</p>',
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.unknownVariables.length, 0);
  assert.equal(result.variables.length, 6);
});

test('validateTemplate exige nombre y contenido no vacío', () => {
  const result = validateTemplate({ nombre: '   ', contenidoHtml: '<p> </p>' });
  const codes = result.errors.map((issue) => issue.code);

  assert.ok(codes.includes('NOMBRE_REQUERIDO'));
  assert.ok(codes.includes('CONTENIDO_REQUERIDO'));
});

test('validateTemplate bloquea variables desconocidas', () => {
  const result = validateTemplate({
    nombre: 'Contrato',
    contenidoHtml: '<p>{{nombre_empleado}} {{salario_secreto}}</p>',
  });

  assert.deepEqual(result.unknownVariables, ['salario_secreto']);
  assert.ok(result.errors.some((issue) => issue.code === 'VARIABLE_DESCONOCIDA'));
});

test('validateTemplate bloquea llaves desbalanceadas y variables malformadas', () => {
  const result = validateTemplate({
    nombre: 'Contrato',
    contenidoHtml: '<p>{{nombre_empleado} {{Nombre}}</p>',
  });
  const codes = result.errors.map((issue) => issue.code);

  assert.ok(codes.includes('LLAVES_DESBALANCEADAS'));
  assert.ok(codes.includes('VARIABLE_MALFORMADA'));
});

test('validateTemplate advierte variables recomendadas ausentes sin bloquear', () => {
  const result = validateTemplate({
    nombre: 'Contrato',
    contenidoHtml: '<p>{{nombre_empleado}}</p>',
  });

  assert.equal(result.errors.length, 0);
  assert.deepEqual(result.missingRequiredVariables, [
    'fecha_ingreso',
    'remuneracion',
    'duracion_prueba',
  ]);
  assert.ok(result.warnings.some((issue) => issue.code === 'VARIABLE_FALTANTE'));
});

test('validateTemplate respeta los límites de nombre y descripción', () => {
  const result = validateTemplate({
    nombre: 'x'.repeat(TEMPLATE_NAME_MAX_LENGTH + 1),
    descripcion: 'y'.repeat(501),
    contenidoHtml: '<p>Contenido</p>',
  });
  const codes = result.errors.map((issue) => issue.code);

  assert.ok(codes.includes('NOMBRE_LONGITUD'));
  assert.ok(codes.includes('DESCRIPCION_LONGITUD'));
});

test('validateTemplate aplica el límite de tamaño de contenido de respaldo', () => {
  const oversized = `<p>${'a'.repeat(TEMPLATE_CONTENT_MAX_BYTES + 10)}</p>`;
  const result = validateTemplate({ nombre: 'Grande', contenidoHtml: oversized });

  assert.ok(result.bytes > TEMPLATE_CONTENT_MAX_BYTES);
  assert.ok(result.errors.some((issue) => issue.code === 'CONTENIDO_TAMANO'));
});

test('substituteVariables escapa valores y conserva variables sin valor', () => {
  const html = '<p>{{nombre_empleado}} / {{ci}}</p>';
  const output = substituteVariables(html, { nombre_empleado: '<Ana & Co>' });

  assert.match(output, /&lt;Ana &amp; Co&gt;/);
  assert.match(output, /class="arca-var-missing"/);
  assert.match(output, /\{\{ci\}\}/);
});

test('findMissingValues lista variables sin valor de ejemplo', () => {
  assert.deepEqual(
    findMissingValues('<p>{{nombre_empleado}} {{ci}}</p>', {
      nombre_empleado: 'Ana',
    }),
    ['ci'],
  );
});

test('utf8ByteLength cuenta bytes reales en UTF-8', () => {
  assert.equal(utf8ByteLength('á'), 2);
  assert.equal(utf8ByteLength('abc'), 3);
});
