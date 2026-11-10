import { ApiError } from '@/lib/api/api-error';
import {
  getMockErrorFor,
  getMockLatencyMs,
  type MockErrorStatus,
} from '@/lib/api/mock-status';
import {
  escapeHtml,
  extractVariables,
  findMissingValues,
} from '@/lib/api/contratos/variables';
import { formatBolivianos, formatDate } from '@/lib/api/contratos/format';
import type {
  ActualizarPlantillaInput,
  CrearPlantillaInput,
  PageResult,
  Plantilla,
  PlantillaCreada,
  PlantillaListFilters,
  PlantillaResumen,
  PreviewContrato,
  PreviewSubject,
} from '@/lib/api/contratos/types';

/**
 * Almacén en memoria/sessionStorage para el dominio `contratos`.
 * Solo lo importa la capa de API (`contratos-api.ts`); nunca un componente.
 */
const STORE_KEY = 'arca.mock.contratos.plantillas.v1';
const memoryStore = new Map<string, string>();

const MOCK_ERROR_MESSAGES: Record<MockErrorStatus, { code: string; message: string }> = {
  401: { code: 'AUTH_TOKEN_EXPIRED', message: 'La sesión expiró.' },
  403: { code: 'FORBIDDEN', message: 'No tiene permiso para realizar esta operación.' },
  404: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' },
  409: {
    code: 'CONFLICT',
    message: 'La operación entra en conflicto con el estado actual.',
  },
  500: {
    code: 'INTERNAL_ERROR',
    message: 'Ocurrió un error interno. Use el traceId para soporte.',
  },
};

export const PREVIEW_SUBJECTS: readonly PreviewSubject[] = [
  {
    id: '00000000-0000-4000-8000-000000000901',
    nombreCompleto: 'Ana María Rojas Mamani',
    ci: '6543210 LP',
    cargo: 'Analista de Gestión Humana',
    area: 'Gestión Humana',
    remuneracion: 8500,
    fechaIngreso: '2023-03-15',
    duracionPrueba: 90,
  },
  {
    id: '00000000-0000-4000-8000-000000000902',
    nombreCompleto: 'Carlos Andrés Mendoza Rojas',
    ci: '7812345 SC',
    cargo: 'Jefe de Operaciones',
    area: 'Operaciones',
    remuneracion: 12400,
    fechaIngreso: '2020-11-02',
    duracionPrueba: 90,
  },
  {
    id: '00000000-0000-4000-8000-000000000903',
    nombreCompleto: 'Lucía Alejandra Flores Vargas',
    ci: '5987654 CB',
    cargo: 'Contadora Senior',
    area: 'Finanzas y Contabilidad',
    remuneracion: 10500,
    fechaIngreso: '2019-07-18',
    duracionPrueba: 90,
  },
  {
    id: '00000000-0000-4000-8000-000000000904',
    nombreCompleto: 'Jorge Condori Ticona',
    ci: '6734521 LP',
    cargo: 'Desarrollador Senior',
    area: 'Tecnología',
    remuneracion: 13200,
    fechaIngreso: '2021-06-01',
    duracionPrueba: 60,
  },
];

function nowIso(): string {
  return new Date().toISOString();
}

function traceId(): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}`;
  return `mock-${random}`;
}

function storageGet(key: string): string | null {
  if (typeof sessionStorage !== 'undefined') return sessionStorage.getItem(key);
  return memoryStore.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(key, value);
    return;
  }
  memoryStore.set(key, value);
}

function storageRemove(key: string): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(key);
    return;
  }
  memoryStore.delete(key);
}

function mockError(status: MockErrorStatus): ApiError {
  const entry = MOCK_ERROR_MESSAGES[status];
  return new ApiError({
    statusCode: status,
    code: entry.code,
    message: entry.message,
    traceId: traceId(),
  });
}

function throwIfConfiguredError(): void {
  const status = getMockErrorFor('contratos');
  if (status) throw mockError(status);
}

async function simulate(seed: string): Promise<void> {
  const latency = getMockLatencyMs(seed);
  if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function toResumen(plantilla: Plantilla): PlantillaResumen {
  return {
    id: plantilla.id,
    nombre: plantilla.nombre,
    descripcion: plantilla.descripcion,
    activa: plantilla.activa,
    versionActual: plantilla.versionActual,
    actualizadoEn: plantilla.actualizadoEn,
  };
}

function toCreada(plantilla: Plantilla): PlantillaCreada {
  return {
    ...toResumen(plantilla),
    variablesDetectadas: plantilla.variablesDetectadas,
    creadoEn: plantilla.creadoEn,
  };
}

const MAIN_CONTRACT_HTML = `<h1>CONTRATO INDIVIDUAL DE TRABAJO</h1>
<p><em>Modelo de ejemplo: la redacción legal debe validarse.</em></p>
<h2>Partes</h2>
<p>Entre <strong>ARCA Ltda.</strong>, con domicilio en Santa Cruz de la Sierra, Bolivia, representada por su Gerente General, en adelante "el Empleador", y <strong>{{nombre_empleado}}</strong>, con cédula de identidad <strong>{{ci}}</strong>, en adelante "el Trabajador", se celebra el presente contrato.</p>
<h2>Objeto</h2>
<p>El Trabajador prestará servicios como <strong>{{cargo}}</strong>, cumpliendo las funciones propias del cargo y las instrucciones del Empleador.</p>
<h2>Remuneración</h2>
<p>El Empleador pagará al Trabajador la remuneración mensual de <strong>{{remuneracion}}</strong>, sujeta a las deducciones de ley.</p>
<h2>Período de prueba</h2>
<p>Se establece un período de prueba de <strong>{{duracion_prueba}}</strong> computable desde la fecha de ingreso.</p>
<h2>Duración</h2>
<p>El presente contrato tiene vigencia desde el <strong>{{fecha_ingreso}}</strong> y se rige por la legislación laboral boliviana aplicable.</p>
<h2>Firmas</h2>
<table><tbody><tr><td>____________________<br>ARCA Ltda.<br>Representante legal</td><td>____________________<br>{{nombre_empleado}}<br>Trabajador</td></tr></tbody></table>`;

function seedPlantillas(): Plantilla[] {
  const definitions: Array<{
    id: string;
    nombre: string;
    descripcion: string;
    activa: boolean;
    versionActual: number;
    contenidoHtml: string;
    creadoEn: string;
    actualizadoEn: string;
  }> = [
    {
      id: '11111111-1111-4111-8111-111111111101',
      nombre: 'Contrato indefinido estándar',
      descripcion: 'Modelo de ejemplo: la redacción legal debe validarse.',
      activa: true,
      versionActual: 3,
      contenidoHtml: MAIN_CONTRACT_HTML,
      creadoEn: '2026-09-01T10:00:00.000Z',
      actualizadoEn: '2026-10-28T15:20:00.000Z',
    },
    {
      id: '11111111-1111-4111-8111-111111111102',
      nombre: 'Contrato a plazo fijo – 6 meses',
      descripcion: 'Modelo de ejemplo para contrataciones temporales.',
      activa: true,
      versionActual: 2,
      contenidoHtml: `<h1>CONTRATO DE TRABAJO A PLAZO FIJO</h1>
<p><em>Modelo de ejemplo: la redacción legal debe validarse.</em></p>
<h2>Partes</h2>
<p>ARCA Ltda. contrata a <strong>{{nombre_empleado}}</strong>, CI <strong>{{ci}}</strong>, para desempeñar el cargo de <strong>{{cargo}}</strong>.</p>
<h2>Plazo</h2>
<p>El contrato inicia el <strong>{{fecha_ingreso}}</strong> y tiene una duración de seis meses, con período de prueba de <strong>{{duracion_prueba}}</strong>.</p>
<h2>Remuneración</h2>
<p>La remuneración mensual acordada es <strong>{{remuneracion}}</strong>.</p>
<h2>Firmas</h2>
<table><tbody><tr><td>____________________<br>ARCA Ltda.</td><td>____________________<br>{{nombre_empleado}}</td></tr></tbody></table>`,
      creadoEn: '2026-09-05T09:30:00.000Z',
      actualizadoEn: '2026-10-25T11:05:00.000Z',
    },
    {
      id: '11111111-1111-4111-8111-111111111103',
      nombre: 'Contrato de período de prueba',
      descripcion: 'Modelo de ejemplo para el período inicial de prueba.',
      activa: true,
      versionActual: 1,
      contenidoHtml: `<h1>CONTRATO DE PERÍODO DE PRUEBA</h1>
<p><em>Modelo de ejemplo: la redacción legal debe validarse.</em></p>
<p>El Trabajador <strong>{{nombre_empleado}}</strong>, CI <strong>{{ci}}</strong>, se incorpora como <strong>{{cargo}}</strong> desde el <strong>{{fecha_ingreso}}</strong>.</p>
<p>El período de prueba es de <strong>{{duracion_prueba}}</strong> y la remuneración de <strong>{{remuneracion}}</strong>.</p>
<p>Firmas:</p>
<table><tbody><tr><td>ARCA Ltda.</td><td>{{nombre_empleado}}</td></tr></tbody></table>`,
      creadoEn: '2026-09-10T14:00:00.000Z',
      actualizadoEn: '2026-10-20T16:40:00.000Z',
    },
    {
      id: '11111111-1111-4111-8111-111111111104',
      nombre: 'Contrato de trabajo a domicilio',
      descripcion: 'Plantilla retirada; se conserva para consulta histórica.',
      activa: false,
      versionActual: 4,
      contenidoHtml: `<h1>CONTRATO DE TRABAJO A DOMICILIO</h1>
<p><em>Modelo de ejemplo: la redacción legal debe validarse.</em></p>
<p>ARCA Ltda. y <strong>{{nombre_empleado}}</strong>, CI <strong>{{ci}}</strong>, acuerdan la prestación de servicios como <strong>{{cargo}}</strong> bajo la modalidad de trabajo a domicilio.</p>
<p>Remuneración: <strong>{{remuneracion}}</strong>. Inicio: <strong>{{fecha_ingreso}}</strong>. Período de prueba: <strong>{{duracion_prueba}}</strong>.</p>
<p>Firmas de las partes.</p>`,
      creadoEn: '2026-08-15T08:15:00.000Z',
      actualizadoEn: '2026-09-30T10:00:00.000Z',
    },
    {
      id: '11111111-1111-4111-8111-111111111105',
      nombre: 'Contrato para pasantía',
      descripcion: 'Modelo de ejemplo para programas de pasantía.',
      activa: false,
      versionActual: 1,
      contenidoHtml: `<h1>CONVENIO DE PASANTÍA</h1>
<p><em>Modelo de ejemplo: la redacción legal debe validarse.</em></p>
<p><strong>{{nombre_empleado}}</strong>, CI <strong>{{ci}}</strong>, realizará una pasantía en el cargo de <strong>{{cargo}}</strong> desde el <strong>{{fecha_ingreso}}</strong>.</p>
<p>La asignación mensual es de <strong>{{remuneracion}}</strong> y el período de prueba de <strong>{{duracion_prueba}}</strong>.</p>`,
      creadoEn: '2026-08-20T11:45:00.000Z',
      actualizadoEn: '2026-09-15T09:10:00.000Z',
    },
    {
      id: '11111111-1111-4111-8111-111111111106',
      nombre: 'Contrato indefinido – área comercial',
      descripcion: 'Modelo de ejemplo con cláusula de objetivos comerciales.',
      activa: true,
      versionActual: 2,
      contenidoHtml: `<h1>CONTRATO INDEFINIDO – ÁREA COMERCIAL</h1>
<p><em>Modelo de ejemplo: la redacción legal debe validarse.</em></p>
<h2>Partes</h2>
<p>ARCA Ltda. contrata a <strong>{{nombre_empleado}}</strong>, CI <strong>{{ci}}</strong>, como <strong>{{cargo}}</strong>.</p>
<h2>Condiciones</h2>
<p>Fecha de ingreso: <strong>{{fecha_ingreso}}</strong>. Remuneración mensual: <strong>{{remuneracion}}</strong>. Período de prueba: <strong>{{duracion_prueba}}</strong>.</p>
<p>El Trabajador cumplirá los objetivos comerciales definidos por la Gerencia.</p>
<h2>Firmas</h2>
<table><tbody><tr><td>____________________<br>ARCA Ltda.</td><td>____________________<br>{{nombre_empleado}}</td></tr></tbody></table>`,
      creadoEn: '2026-09-18T12:00:00.000Z',
      actualizadoEn: '2026-10-29T17:30:00.000Z',
    },
  ];

  return definitions.map((definition) => {
    const variablesDetectadas = extractVariables(definition.contenidoHtml);
    return {
      ...definition,
      variablesDetectadas,
      versiones: Array.from({ length: definition.versionActual }, (_, index) => ({
        version: index + 1,
        creadoEn: definition.creadoEn,
        variablesDetectadas,
      })),
    };
  });
}

function readStore(): Plantilla[] {
  const raw = storageGet(STORE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Plantilla[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      storageRemove(STORE_KEY);
    }
  }
  const initial = seedPlantillas();
  writeStore(initial);
  return initial;
}

function writeStore(plantillas: Plantilla[]): void {
  storageSet(STORE_KEY, JSON.stringify(plantillas));
}

function findOrThrow(plantillas: Plantilla[], id: string): Plantilla {
  const plantilla = plantillas.find((item) => item.id === id);
  if (!plantilla) {
    throw new ApiError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'El recurso solicitado no existe.',
      traceId: traceId(),
    });
  }
  return plantilla;
}

function assertUniqueName(
  plantillas: Plantilla[],
  nombre: string,
  exceptId?: string,
): void {
  const normalized = nombre.trim().toLocaleLowerCase('es');
  const duplicate = plantillas.some(
    (item) =>
      item.id !== exceptId && item.nombre.trim().toLocaleLowerCase('es') === normalized,
  );
  if (duplicate) {
    throw new ApiError({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Ya existe una plantilla con ese nombre.',
      traceId: traceId(),
    });
  }
}

export async function listPlantillas(
  filters: PlantillaListFilters = {},
): Promise<PageResult<PlantillaResumen>> {
  await simulate(`list:${filters.page ?? 1}:${filters.q ?? ''}:${String(filters.activa)}`);
  throwIfConfiguredError();

  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
  const query = filters.q?.trim().toLocaleLowerCase('es') ?? '';

  const rows = readStore()
    .filter((plantilla) => {
      const matchesQuery =
        !query || plantilla.nombre.toLocaleLowerCase('es').includes(query);
      const matchesActiva =
        filters.activa === undefined || plantilla.activa === filters.activa;
      return matchesQuery && matchesActiva;
    })
    .sort((left, right) => right.actualizadoEn.localeCompare(left.actualizadoEn));

  const start = (page - 1) * pageSize;
  return {
    data: rows.slice(start, start + pageSize).map(toResumen),
    meta: {
      page,
      pageSize,
      total: rows.length,
      totalPages: Math.ceil(rows.length / pageSize),
    },
  };
}

export async function getPlantilla(id: string): Promise<Plantilla> {
  await simulate(`get:${id}`);
  throwIfConfiguredError();
  return clone(findOrThrow(readStore(), id));
}

export async function createPlantilla(
  input: CrearPlantillaInput,
): Promise<PlantillaCreada> {
  await simulate(`create:${input.nombre}`);
  throwIfConfiguredError();

  if (!input.nombre.trim() || !input.contenidoHtml.trim()) {
    throw new ApiError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Uno o más campos no son válidos.',
      traceId: traceId(),
    });
  }

  const plantillas = readStore();
  assertUniqueName(plantillas, input.nombre);

  const timestamp = nowIso();
  const contenidoHtml = input.contenidoHtml;
  const variablesDetectadas = extractVariables(contenidoHtml);
  const plantilla: Plantilla = {
    id:
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `plantilla-${Date.now()}`,
    nombre: input.nombre.trim(),
    descripcion: input.descripcion?.trim() || null,
    activa: input.activa ?? true,
    versionActual: 1,
    contenidoHtml,
    variablesDetectadas,
    versiones: [{ version: 1, creadoEn: timestamp, variablesDetectadas }],
    creadoEn: timestamp,
    actualizadoEn: timestamp,
  };

  plantillas.unshift(plantilla);
  writeStore(plantillas);
  return toCreada(plantilla);
}

export async function updatePlantilla(
  id: string,
  input: ActualizarPlantillaInput,
): Promise<Plantilla> {
  await simulate(`update:${id}`);
  throwIfConfiguredError();

  const plantillas = readStore();
  const plantilla = findOrThrow(plantillas, id);

  if (input.nombre !== undefined) {
    if (!input.nombre.trim()) {
      throw new ApiError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'El nombre de la plantilla es obligatorio.',
        traceId: traceId(),
      });
    }
    assertUniqueName(plantillas, input.nombre, id);
    plantilla.nombre = input.nombre.trim();
  }

  if (input.descripcion !== undefined) {
    plantilla.descripcion = input.descripcion.trim() || null;
  }

  if (input.activa !== undefined) plantilla.activa = input.activa;

  if (input.contenidoHtml !== undefined) {
    if (!input.contenidoHtml.trim()) {
      throw new ApiError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'El contenido de la plantilla no puede estar vacío.',
        traceId: traceId(),
      });
    }
    if (input.contenidoHtml !== plantilla.contenidoHtml) {
      plantilla.contenidoHtml = input.contenidoHtml;
      plantilla.variablesDetectadas = extractVariables(input.contenidoHtml);
      plantilla.versionActual += 1;
      plantilla.versiones.push({
        version: plantilla.versionActual,
        creadoEn: nowIso(),
        variablesDetectadas: plantilla.variablesDetectadas,
      });
    }
  }

  plantilla.actualizadoEn = nowIso();
  writeStore(plantillas);
  return clone(plantilla);
}

export async function setPlantillaActiva(id: string, activa: boolean): Promise<Plantilla> {
  return updatePlantilla(id, { activa });
}

export async function duplicatePlantilla(id: string): Promise<PlantillaCreada> {
  const source = await getPlantilla(id);
  const plantillas = readStore();
  const baseName = `${source.nombre} (copia)`;
  let candidate = baseName;
  let counter = 2;
  const normalizedNames = new Set(
    plantillas.map((item) => item.nombre.trim().toLocaleLowerCase('es')),
  );
  while (normalizedNames.has(candidate.toLocaleLowerCase('es'))) {
    candidate = `${baseName} ${counter}`;
    counter += 1;
  }

  return createPlantilla({
    nombre: candidate,
    descripcion: source.descripcion ?? undefined,
    contenidoHtml: source.contenidoHtml,
    activa: true,
  });
}

export function getPreviewSubjects(): PreviewSubject[] {
  return clone([...PREVIEW_SUBJECTS]);
}

export interface MockPreviewEmployee {
  id: string;
  nombreCompleto: string;
  ci: string;
  cargo?: string;
  remuneracion?: number;
  fechaIngreso: string;
  diasPrueba?: number;
}

const PREVIEW_PLACEHOLDER = /\{\{([^{}]*)\}\}/g;

/**
 * Vista previa del mock con la misma forma que `POST /contratos/preview`.
 * Se mantiene el HTML crudo de la plantilla; `SafeHtmlPreview` sustituye los
 * valores y resalta los campos faltantes. No sustituye datos sensibles en
 * ningún registro ni los persiste.
 */
export function buildPreview(
  plantilla: Plantilla,
  employee: MockPreviewEmployee,
): PreviewContrato {
  if (!plantilla.activa) {
    throw new ApiError({
      statusCode: 400,
      code: 'CONTR_PLANTILLA_INACTIVA',
      message: 'La plantilla de contrato no está activa.',
      traceId: traceId(),
    });
  }

  const values: Record<string, string | undefined> = {
    nombre_empleado: employee.nombreCompleto,
    ci: employee.ci,
    cargo: employee.cargo,
    remuneracion:
      employee.remuneracion !== undefined
        ? formatBolivianos(employee.remuneracion)
        : undefined,
    fecha_ingreso: employee.fechaIngreso ? formatDate(employee.fechaIngreso) : undefined,
    duracion_prueba:
      employee.diasPrueba !== undefined ? `${employee.diasPrueba} días` : undefined,
  };
  const variables = extractVariables(plantilla.contenidoHtml);
  const camposFaltantes = findMissingValues(plantilla.contenidoHtml, values);
  const htmlPreview = plantilla.contenidoHtml.replace(
    PREVIEW_PLACEHOLDER,
    (fullMatch, rawName: string) => {
      const value = values[rawName.trim()];
      return value === undefined || value === '' ? fullMatch : escapeHtml(value);
    },
  );

  return {
    contratoId: null,
    empleadoId: employee.id,
    plantillaId: plantilla.id,
    plantillaVersion: plantilla.versionActual,
    htmlPreview,
    variablesResueltas: variables.filter(
      (variable) => !camposFaltantes.includes(variable),
    ),
    camposFaltantes,
    advertencias:
      camposFaltantes.length > 0
        ? [`Faltan datos para resolver: ${camposFaltantes.join(', ')}.`]
        : [],
  };
}

/** Solo para pruebas: deja el almacén en su estado inicial. */
export function resetMockContratosStore(): void {
  storageRemove(STORE_KEY);
}
