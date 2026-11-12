import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const VARIABLE_PATTERN = /\{\{([^{}]*)\}\}/g;
const PLUGIN_KEY = new PluginKey<DecorationSet>('arca-template-variable-highlight');

function buildDecorations(
  doc: ProseMirrorNode,
  allowedVariables: readonly string[],
): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (!node.isText || !node.text) return;

    for (const match of node.text.matchAll(VARIABLE_PATTERN)) {
      const rawName = match[1] ?? '';
      const name = rawName.trim();
      const from = position + (match.index ?? 0);
      const to = from + match[0].length;
      const known = Boolean(name) && rawName === name && allowedVariables.includes(name);

      decorations.push(
        Decoration.inline(from, to, {
          class: known
            ? 'arca-template-variable'
            : 'arca-template-variable arca-template-variable-unknown',
          'data-variable': name,
          title: known
            ? `Variable permitida: ${name}`
            : `Variable desconocida: ${name || match[0]}`,
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

/**
 * Resalta las variables `{{variable}}` dentro del editor.
 * No transforma el documento: al serializar, las variables siguen literales.
 */
export function createVariableHighlightExtension(allowedVariables: readonly string[]) {
  return Extension.create({
    name: 'arcaVariableHighlight',
    addProseMirrorPlugins() {
      return [
        new Plugin<DecorationSet>({
          key: PLUGIN_KEY,
          state: {
            init: (_config, { doc }) => buildDecorations(doc, allowedVariables),
            apply: (transaction, previous) =>
              transaction.docChanged
                ? buildDecorations(transaction.doc, allowedVariables)
                : previous,
          },
          props: {
            decorations(state) {
              return PLUGIN_KEY.getState(state);
            },
          },
        }),
      ];
    },
  });
}
