import { performance } from 'node:perf_hooks';

const SAMPLE_COUNT = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable requerida ${name}.`);
  return value;
}

function assertSafeTestEnvironment(): void {
  if (process.env.NODE_ENV === 'production' || required('ARQ204_TEST_ALLOW_MUTATIONS') !== 'true') {
    throw new Error(
      'Prueba bloqueada: usa un entorno de prueba desechable y ARQ204_TEST_ALLOW_MUTATIONS=true.',
    );
  }
}

function record(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : undefined;
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1] ?? 0;
}

function summarize(label: string, samples: number[], targetMs: number): void {
  const p50 = percentile(samples, 0.5);
  const p95 = percentile(samples, 0.95);
  const max = Math.max(...samples);
  console.log(
    `${label} (${samples.length} solicitudes): ` +
      `p50=${p50.toFixed(1)} ms, p95=${p95.toFixed(1)} ms, ` +
      `max=${max.toFixed(1)} ms; objetivo p95 < ${targetMs} ms.`,
  );
  if (p95 >= targetMs) {
    throw new Error(`${label}: el p95 no alcanzó el objetivo de ${targetMs} ms.`);
  }
}

async function postJson(
  url: string,
  token: string,
): Promise<{ status: number; elapsedMs: number; body: JsonRecord }> {
  const started = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(60_000),
  });
  const elapsedMs = performance.now() - started;
  const body = record(await response.json().catch(() => undefined));
  if (!response.ok || !body) {
    const errorBody = record(body?.error) ?? body;
    const code = typeof errorBody?.code === 'string' ? errorBody.code : 'respuesta no válida';
    throw new Error(`La solicitud respondió HTTP ${response.status} (${code}).`);
  }
  return { status: response.status, elapsedMs, body };
}

async function postForm(
  url: string,
  token: string,
  form: FormData,
): Promise<{ status: number; elapsedMs: number }> {
  const started = performance.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const elapsedMs = performance.now() - started;
  if (!response.ok) {
    const body = record(await response.json().catch(() => undefined));
    const code = typeof body?.code === 'string' ? body.code : 'respuesta no válida';
    throw new Error(`La solicitud respondió HTTP ${response.status} (${code}).`);
  }
  return { status: response.status, elapsedMs };
}

async function benchmarkPayroll(): Promise<void> {
  const baseUrl = required('ARQ204_PLANILLAS_URL').replace(/\/+$/, '');
  const token = required('ARQ204_PLANILLAS_TOKEN');
  const period = required('ARQ204_PLANILLAS_PERIOD');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
    throw new Error('ARQ204_PLANILLAS_PERIOD debe tener formato YYYY-MM.');
  }

  const durations: number[] = [];
  let employeeCount = 0;
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    const response = await postJson(
      `${baseUrl}/api/planillas/periodos/${period}/calcular`,
      token,
    );
    if (response.status !== 200) {
      throw new Error(`El cálculo respondió HTTP ${response.status}; se esperaba HTTP 200.`);
    }
    const planilla = record(response.body.planilla);
    if (typeof planilla?.totalEmpleados !== 'number') {
      throw new Error('La respuesta no contiene planilla.totalEmpleados.');
    }
    employeeCount = planilla.totalEmpleados;
    if (employeeCount !== 200) {
      throw new Error(
        `El entorno de prueba debe tener exactamente 200 empleados activos; respondió ${employeeCount}.`,
      );
    }
    durations.push(response.elapsedMs);
  }

  console.log(`Cálculo síncrono de planilla: ${employeeCount} empleados por solicitud.`);
  summarize('POST /api/planillas/periodos/:periodo/calcular', durations, 30_000);
}

async function benchmarkContracts(): Promise<void> {
  const baseUrl = required('ARQ204_CONTRATOS_URL').replace(/\/+$/, '');
  const token = required('ARQ204_CONTRATOS_TOKEN');
  const contractIds = required('ARQ204_CONTRATOS_TEST_IDS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    contractIds.length !== SAMPLE_COUNT ||
    contractIds.some((id) => !UUID_PATTERN.test(id)) ||
    new Set(contractIds).size !== SAMPLE_COUNT
  ) {
    throw new Error(`ARQ204_CONTRATOS_TEST_IDS debe contener ${SAMPLE_COUNT} UUID distintos.`);
  }

  const durations: number[] = [];
  for (const id of contractIds) {
    const form = new FormData();
    form.set('datos', JSON.stringify({ incluirFirmas: false }));
    const response = await postForm(`${baseUrl}/api/contratos/${id}/pdf`, token, form);
    if (response.status !== 201) {
      throw new Error(`La generación de PDF respondió HTTP ${response.status}; se esperaba HTTP 201.`);
    }
    durations.push(response.elapsedMs);
  }

  summarize('POST /api/contratos/:id/pdf', durations, 3_000);
}

async function main(): Promise<void> {
  assertSafeTestEnvironment();
  const target = process.argv.slice(2).find((argument) => argument !== '--');
  if (target === 'planillas') {
    await benchmarkPayroll();
    return;
  }
  if (target === 'contratos') {
    await benchmarkContracts();
    return;
  }
  throw new Error('Uso: pnpm bench:arq204 -- <planillas|contratos>.');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  console.error(`Falló el benchmark ARQ-204: ${message}`);
  process.exitCode = 1;
});
