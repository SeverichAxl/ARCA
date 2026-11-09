import type { ContratoVariable } from '../templates/template.models';
import type { DatosEmpleadoContrato } from './personal-data.port';

export interface RenderedContrato {
  html: string;
  variablesResueltas: ContratoVariable[];
  camposFaltantes: ContratoVariable[];
  advertencias: string[];
}

const PLACEHOLDER_PATTERN =
  /\{\{(nombre_empleado|ci|cargo|remuneracion|fecha_ingreso|duracion_prueba)\}\}/g;
const ANY_PLACEHOLDER_PATTERN = /\{\{([^{}]*)\}\}/g;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character);
}

function hasValue(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Traduce los datos del empleado a las variables del catálogo HU-17. Los
 * valores se escapan al interpolar para que un nombre u observación no pueda
 * inyectar HTML en la vista previa.
 */
export function toContratoVariables(
  datos: DatosEmpleadoContrato,
): Partial<Record<ContratoVariable, string>> {
  return {
    nombre_empleado: datos.nombreEmpleado,
    ci: datos.ci,
    cargo: datos.cargo,
    remuneracion: datos.remuneracion,
    fecha_ingreso: datos.fechaIngreso,
    duracion_prueba: datos.duracionPrueba,
  };
}

export function renderContratoTemplate(
  contenidoHtml: string,
  variables: Partial<Record<ContratoVariable, string>>,
): RenderedContrato {
  const variablesResueltas: ContratoVariable[] = [];
  const camposFaltantes: ContratoVariable[] = [];
  const advertencias: string[] = [];

  const html = contenidoHtml.replace(PLACEHOLDER_PATTERN, (placeholder, rawName: string) => {
    const variable = rawName as ContratoVariable;
    const value = variables[variable];

    if (!hasValue(value)) {
      if (!camposFaltantes.includes(variable)) camposFaltantes.push(variable);
      return placeholder;
    }

    if (!variablesResueltas.includes(variable)) variablesResueltas.push(variable);
    return escapeHtml(value);
  });

  for (const variable of camposFaltantes) {
    advertencias.push(
      variable === 'remuneracion'
        ? 'No se resolvió {{remuneracion}}: el dato no está disponible o el actor no tiene personal:read_salary.'
        : `No se resolvió {{${variable}}}: el dato no está disponible.`,
    );
  }

  const unknown = new Set<string>();
  for (const match of html.matchAll(ANY_PLACEHOLDER_PATTERN)) {
    const name = (match[1] ?? '').trim();
    if (!camposFaltantes.includes(name as ContratoVariable)) unknown.add(name);
  }
  if (unknown.size > 0) {
    advertencias.push(
      `La plantilla conserva variables no reconocidas: ${[...unknown].join(', ')}.`,
    );
  }

  return { html, variablesResueltas, camposFaltantes, advertencias };
}
