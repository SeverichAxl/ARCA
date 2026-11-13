import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

/**
 * TipTap necesita un DOM real para construir el editor. jsdom se instala como
 * global antes de importar dinámicamente los módulos de TipTap.
 */
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
});

const windowRecord = dom.window as unknown as Record<string, unknown>;
const boundGlobals: Record<string, unknown> = {
  window: dom.window,
  document: dom.window.document,
  navigator: dom.window.navigator,
  HTMLElement: windowRecord.HTMLElement,
  Element: windowRecord.Element,
  Node: windowRecord.Node,
  Text: windowRecord.Text,
  Range: windowRecord.Range,
  DOMParser: windowRecord.DOMParser,
  MutationObserver: windowRecord.MutationObserver,
  getSelection: dom.window.getSelection.bind(dom.window),
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
  cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
};

for (const [key, value] of Object.entries(boundGlobals)) {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
}

async function createEditor(content: string) {
  const [{ Editor }, { default: StarterKit }, { TextAlign }, table, highlight, types] =
    await Promise.all([
      import('@tiptap/react'),
      import('@tiptap/starter-kit'),
      import('@tiptap/extension-text-align'),
      import('@tiptap/extension-table'),
      import('../src/components/contratos/variable-highlight-extension'),
      import('../src/lib/api/contratos/types'),
    ]);

  return new Editor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: false,
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      table.Table.configure({ resizable: false }),
      table.TableRow,
      table.TableHeader,
      table.TableCell,
      highlight.createVariableHighlightExtension(types.VARIABLES_PERMITIDAS),
    ],
    content,
  });
}

test('el editor serializa variables literales sin transformarlas', async () => {
  const editor = await createEditor('<p>Hola <strong>{{nombre_empleado}}</strong></p>');
  try {
    const html = editor.getHTML();
    assert.match(html, /\{\{nombre_empleado\}\}/);
    assert.match(html, /<strong>/);
    assert.equal(editor.getText().includes('{{nombre_empleado}}'), true);
  } finally {
    editor.destroy();
  }
});

test('los comandos de formato producen HTML esperado', async () => {
  const editor = await createEditor('<p>Texto</p>');
  try {
    editor.commands.selectAll();
    editor.chain().focus().toggleBold().run();
    assert.match(editor.getHTML(), /<strong>Texto<\/strong>/);

    editor.chain().focus().toggleHeading({ level: 1 }).run();
    assert.match(editor.getHTML(), /<h1>/);

    editor.chain().focus().setTextAlign('center').run();
    assert.match(editor.getHTML(), /text-align:\s*center/i);
  } finally {
    editor.destroy();
  }
});

test('insertContent agrega variables en la posición del cursor', async () => {
  const editor = await createEditor('<p>Documento </p>');
  try {
    editor.commands.focus('end');
    editor.chain().focus().insertContent('{{ci}}').run();
    assert.match(editor.getHTML(), /\{\{ci\}\}/);
  } finally {
    editor.destroy();
  }
});

test('la tabla básica se serializa y se puede eliminar', async () => {
  const editor = await createEditor('<p>Antes</p>');
  try {
    editor.chain().focus('end').insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run();
    const html = editor.getHTML();
    assert.match(html, /<table/);
    assert.match(html, /<th/);
    assert.match(html, /<td/);

    editor.chain().focus().deleteTable().run();
    assert.doesNotMatch(editor.getHTML(), /<table/);
  } finally {
    editor.destroy();
  }
});

test('las variables conocidas se resaltan y las desconocidas se marcan', async () => {
  const editor = await createEditor(
    '<p>{{nombre_empleado}} y {{variable_inventada}}</p>',
  );
  try {
    const known = editor.view.dom.querySelector('.arca-template-variable');
    const unknown = editor.view.dom.querySelector('.arca-template-variable-unknown');

    assert.ok(known, 'La variable conocida debe tener clase de resaltado');
    assert.ok(unknown, 'La variable desconocida debe tener clase de error');
    assert.equal(editor.getHTML().includes('{{variable_inventada}}'), true);
  } finally {
    editor.destroy();
  }
});
