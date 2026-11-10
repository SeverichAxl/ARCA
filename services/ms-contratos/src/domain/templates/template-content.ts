import sanitizeHtml from 'sanitize-html';
import { CONTRATO_VARIABLES, type ContratoVariable } from './template.models';

export type PlantillaContentErrorCode = 'CONTR_TEMPLATE_INVALIDA' | 'CONTR_VARIABLE_NO_PERMITIDA';

export interface PlantillaContentErrorDetails {
  variables?: string[];
}

export class PlantillaContentError extends Error {
  constructor(
    readonly code: PlantillaContentErrorCode,
    message: string,
    readonly details?: PlantillaContentErrorDetails,
  ) {
    super(message);
    this.name = 'PlantillaContentError';
  }
}

export interface PreparedTemplateContent {
  contenidoHtml: string;
  variablesDetectadas: ContratoVariable[];
}

const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g;
const PLACEHOLDER_NAME_PATTERN = /^[A-Za-z0-9_]+$/;
const ALLOWED_VARIABLES = new Set<string>(CONTRATO_VARIABLES);

/**
 * Etiquetas permitidas para el modelo estándar de contrato (Ministerio de
 * Trabajo): títulos, párrafos, listas, tablas y énfasis. Se excluyen scripts,
 * iframes, formularios, objetos y cualquier etiqueta con ejecución de código.
 */
const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'div',
  'span',
  'section',
  'article',
  'header',
  'footer',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'table',
  'caption',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'blockquote',
  'small',
  'sub',
  'sup',
  'mark',
  'pre',
  'code',
];

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    '*': ['class', 'style'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    table: ['border', 'cellpadding', 'cellspacing', 'width'],
    ol: ['start', 'type'],
    ul: ['type'],
    li: ['value'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(?:left|right|center|justify)$/],
      'font-weight': [/^(?:normal|bold|[1-9]00)$/],
      'font-style': [/^(?:normal|italic)$/],
      'text-decoration': [/^(?:none|underline|line-through)$/],
      'text-transform': [/^(?:none|uppercase|lowercase|capitalize)$/],
    },
  },
  allowedSchemes: [] as string[],
  allowedSchemesByTag: {},
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard' as const,
};

/**
 * Sanea el HTML y valida que todos los placeholders pertenezcan al catálogo.
 * Se valida sobre el HTML original para rechazar variables no permitidas
 * incluso si aparecen dentro de una etiqueta que luego sería eliminada.
 */
export function prepareTemplateContent(rawHtml: string): PreparedTemplateContent {
  extractVariables(rawHtml);

  const contenidoHtml = sanitizeHtml(rawHtml, SANITIZE_OPTIONS).trim();

  if (!hasVisibleContent(contenidoHtml)) {
    throw new PlantillaContentError(
      'CONTR_TEMPLATE_INVALIDA',
      'La plantilla no contiene contenido HTML permitido.',
    );
  }

  return {
    contenidoHtml,
    variablesDetectadas: extractVariables(contenidoHtml),
  };
}

export function extractVariables(rawHtml: string): ContratoVariable[] {
  PLACEHOLDER_PATTERN.lastIndex = 0;

  const variables: ContratoVariable[] = [];
  const invalidVariables = new Set<string>();

  for (const match of rawHtml.matchAll(PLACEHOLDER_PATTERN)) {
    const rawName = match[1] ?? '';

    if (
      rawName.length === 0 ||
      rawName !== rawName.trim() ||
      !PLACEHOLDER_NAME_PATTERN.test(rawName)
    ) {
      throw new PlantillaContentError(
        'CONTR_TEMPLATE_INVALIDA',
        `Placeholder malformado: ${match[0]}. Use el formato {{variable}}.`,
      );
    }

    if (!ALLOWED_VARIABLES.has(rawName)) {
      invalidVariables.add(rawName);
      continue;
    }

    const variable = rawName as ContratoVariable;
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }

  if (invalidVariables.size > 0) {
    throw new PlantillaContentError(
      'CONTR_VARIABLE_NO_PERMITIDA',
      `Variables no permitidas: ${[...invalidVariables].join(', ')}.`,
      { variables: [...invalidVariables] },
    );
  }

  const withoutValidPlaceholders = rawHtml.replace(PLACEHOLDER_PATTERN, '');
  if (/\{\{|\}\}/.test(withoutValidPlaceholders)) {
    throw new PlantillaContentError(
      'CONTR_TEMPLATE_INVALIDA',
      'Placeholder malformado. Use el formato {{variable}} sin espacios.',
    );
  }

  return variables;
}

function hasVisibleContent(html: string): boolean {
  const text = sanitizeHtml(html, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/&nbsp;|&#160;/g, ' ')
    .trim();

  return text.length > 0;
}
