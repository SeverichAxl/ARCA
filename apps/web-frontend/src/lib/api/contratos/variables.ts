import {
  REQUIRED_TEMPLATE_VARIABLES,
  TEMPLATE_CONTENT_MAX_LENGTH,
  TEMPLATE_DESCRIPTION_MAX_LENGTH,
  TEMPLATE_NAME_MAX_LENGTH,
  VARIABLES_PERMITIDAS,
  type TemplateValidationIssue,
  type TemplateValidationResult,
  type VariablePermitida,
} from './types';

const PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g;
const VARIABLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export interface ValidateTemplateInput {
  nombre: string;
  descripcion?: string;
  contenidoHtml: string;
}

export interface ValidateTemplateOptions {
  allowedVariables?: readonly string[];
  requiredVariables?: readonly string[];
  maxNameLength?: number;
  maxDescriptionLength?: number;
  maxContentLength?: number;
}

export interface UnbalancedBrace {
  index: number;
  token: string;
}

export type TemplateValues = Record<string, string | number | null | undefined>;

/** Extrae las variables de un HTML, sin duplicados y en orden de aparición. */
export function extractVariables(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1]?.trim();
    if (name && !found.includes(name)) found.push(name);
  }
  return found;
}

/** Placeholders con nombre vacío o con caracteres/espacios no permitidos. */
export function findMalformedPlaceholders(html: string): string[] {
  const malformed: string[] = [];
  for (const match of html.matchAll(PLACEHOLDER_PATTERN)) {
    const raw = match[1] ?? '';
    const name = raw.trim();
    if (!name || raw !== name || !VARIABLE_NAME_PATTERN.test(name)) {
      const token = match[0];
      if (!malformed.includes(token)) malformed.push(token);
    }
  }
  return malformed;
}

/** Detecta `{{` sin cierre, `}}` sin apertura y llaves simples sueltas. */
export function findUnbalancedBraces(html: string): UnbalancedBrace[] {
  const issues: UnbalancedBrace[] = [];
  let index = 0;

  while (index < html.length) {
    if (html.startsWith('{{', index)) {
      const end = html.indexOf('}}', index + 2);
      const nextOpen = html.indexOf('{{', index + 2);

      // Un `{{` se considera cerrado solo si el siguiente `}}` aparece antes
      // de otra apertura; de lo contrario hay anidamiento o falta el cierre.
      if (end === -1 || (nextOpen !== -1 && nextOpen < end)) {
        issues.push({ index, token: '{{' });
        index += 2;
        continue;
      }

      index = end + 2;
      continue;
    }

    const current = html[index];
    if (current === '{' || current === '}') {
      issues.push({ index, token: current });
    }
    index += 1;
  }

  return issues;
}

export function getUnknownVariables(
  variables: readonly string[],
  allowedVariables: readonly string[] = VARIABLES_PERMITIDAS,
): string[] {
  return variables.filter((variable) => !allowedVariables.includes(variable));
}

export function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function validateTemplate(
  input: ValidateTemplateInput,
  options: ValidateTemplateOptions = {},
): TemplateValidationResult {
  const allowedVariables = options.allowedVariables ?? VARIABLES_PERMITIDAS;
  const requiredVariables = options.requiredVariables ?? REQUIRED_TEMPLATE_VARIABLES;
  const maxNameLength = options.maxNameLength ?? TEMPLATE_NAME_MAX_LENGTH;
  const maxDescriptionLength =
    options.maxDescriptionLength ?? TEMPLATE_DESCRIPTION_MAX_LENGTH;
  const maxContentLength =
    options.maxContentLength ?? TEMPLATE_CONTENT_MAX_LENGTH;

  const errors: TemplateValidationIssue[] = [];
  const warnings: TemplateValidationIssue[] = [];

  const nombre = input.nombre.trim();
  const descripcion = (input.descripcion ?? '').trim();
  const contenidoHtml = input.contenidoHtml ?? '';

  if (!nombre) {
    errors.push({
      field: 'nombre',
      code: 'NOMBRE_REQUERIDO',
      message: 'El nombre de la plantilla es obligatorio.',
    });
  } else if (nombre.length > maxNameLength) {
    errors.push({
      field: 'nombre',
      code: 'NOMBRE_LONGITUD',
      message: `El nombre no puede superar ${maxNameLength} caracteres.`,
    });
  }

  if (descripcion.length > maxDescriptionLength) {
    errors.push({
      field: 'descripcion',
      code: 'DESCRIPCION_LONGITUD',
      message: `La descripción no puede superar ${maxDescriptionLength} caracteres.`,
    });
  }

  const plainText = htmlToPlainText(contenidoHtml);
  if (!plainText) {
    errors.push({
      field: 'contenidoHtml',
      code: 'CONTENIDO_REQUERIDO',
      message: 'El contenido de la plantilla no puede estar vacío.',
    });
  }

  const bytes = utf8ByteLength(contenidoHtml);
  if (contenidoHtml.length > maxContentLength) {
    errors.push({
      field: 'contenidoHtml',
      code: 'CONTENIDO_TAMANO',
      message: `El contenido no puede superar ${maxContentLength.toLocaleString(
        'es-BO',
      )} caracteres.`,
    });
  }

  const unbalanced = findUnbalancedBraces(contenidoHtml);
  if (unbalanced.length > 0) {
    errors.push({
      field: 'contenidoHtml',
      code: 'LLAVES_DESBALANCEADAS',
      message:
        'Hay llaves desbalanceadas. Las variables deben escribirse como {{nombre_variable}}.',
    });
  }

  const malformed = findMalformedPlaceholders(contenidoHtml);
  if (malformed.length > 0) {
    errors.push({
      field: 'contenidoHtml',
      code: 'VARIABLE_MALFORMADA',
      message: `Hay variables con formato inválido: ${malformed.join(', ')}.`,
    });
  }

  const variables = extractVariables(contenidoHtml);
  const unknownVariables = getUnknownVariables(variables, allowedVariables);
  if (unknownVariables.length > 0) {
    errors.push({
      field: 'contenidoHtml',
      code: 'VARIABLE_DESCONOCIDA',
      message: `Variables no permitidas: ${unknownVariables
        .map((variable) => `{{${variable}}}`)
        .join(', ')}. Use solo las variables de la barra de variables.`,
    });
  }

  const missingRequiredVariables = requiredVariables.filter(
    (variable) => !variables.includes(variable),
  ) as VariablePermitida[];

  if (missingRequiredVariables.length > 0) {
    warnings.push({
      field: 'contenidoHtml',
      code: 'VARIABLE_FALTANTE',
      message: `El modelo no usa estas variables recomendadas: ${missingRequiredVariables
        .map((variable) => `{{${variable}}}`)
        .join(', ')}.`,
    });
  }

  return {
    errors,
    warnings,
    variables,
    unknownVariables,
    missingRequiredVariables,
    length: contenidoHtml.length,
    bytes,
  };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function hasValue(value: string | number | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

/**
 * Sustituye variables por valores escapados. Las variables sin valor se
 * conservan visibles y se marcan con `arca-var-missing` para la vista previa.
 */
export function substituteVariables(html: string, values: TemplateValues): string {
  return html.replace(PLACEHOLDER_PATTERN, (fullMatch, rawName: string) => {
    const name = rawName.trim();
    const value = values[name];
    if (!name || !hasValue(value)) {
      return `<span class="arca-var-missing" data-variable="${escapeAttribute(
        name,
      )}" title="Sin valor de ejemplo">${fullMatch}</span>`;
    }
    return escapeHtml(String(value));
  });
}

export function findMissingValues(html: string, values: TemplateValues): string[] {
  const missing: string[] = [];
  for (const match of html.matchAll(PLACEHOLDER_PATTERN)) {
    const name = match[1]?.trim();
    if (name && !hasValue(values[name]) && !missing.includes(name)) {
      missing.push(name);
    }
  }
  return missing;
}
