import { randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { PrismaClient } from '../services/ms-personal/prisma/generated/client';

const PREFIX = `__perf__${randomUUID().slice(0, 8)}__`;
const SAMPLE_COUNT = 200;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable requerida ${name}.`);
  return value;
}

async function call(
  path: string,
  token: string,
  init: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const base = required('PERSONAL_API_URL').replace(/\/+$/, '');
  const start = performance.now();
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  const elapsed = performance.now() - start;
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { status: response.status, body: { ...body, __elapsed: elapsed } };
}

function percentile(samples: number[], p: number): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1] ?? 0;
}

function employeeForm(index: number, areaId: string, cargoId: string): FormData {
  const data = {
    nombres: `${PREFIX}${index}`,
    apellidos: 'Sintetico',
    ci: `8${randomBytes(7).toString('hex').toUpperCase()}`,
    areaId,
    cargoId,
    remuneracion: '5000.00',
    fechaIngreso: '2020-01-01',
  };
  const body = new FormData();
  body.set('datos', JSON.stringify(data));
  body.set(
    'firma',
    new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], {
      type: 'application/octet-stream',
    }),
    'synthetic.bin',
  );
  return body;
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' || process.env.PERSONAL_TEST_ALLOW_MUTATIONS !== 'true') {
    throw new Error(
      'Prueba destructiva bloqueada: use una base aislada y PERSONAL_TEST_ALLOW_MUTATIONS=true.',
    );
  }
  const runtimeUrl = required('DATABASE_URL');
  const ownerUrl = required('DIRECT_URL');
  const token = required('PERSONAL_TEST_TOKEN');
  required('PERSONAL_API_URL');
  const areaId = required('PERSONAL_TEST_AREA_ID');
  const cargoId = required('PERSONAL_TEST_CARGO_ID');
  const runtime = new PrismaClient({ datasources: { db: { url: runtimeUrl } } });
  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });

  try {
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const response = await call('/employees', token, {
        method: 'POST',
        body: employeeForm(index, areaId, cargoId),
      });
      if (response.status !== 201) {
        throw new Error(`No se pudo crear el registro sintético ${index + 1} (HTTP ${response.status}).`);
      }
    }

    const query = `/employees?nombre=${encodeURIComponent(PREFIX)}&areaId=${areaId}&page=1&pageSize=20`;
    const durations: number[] = [];
    for (let index = 0; index < SAMPLE_COUNT; index += 1) {
      const response = await call(query, token, { method: 'GET' });
      if (response.status !== 200) {
        throw new Error(`GET /employees respondió HTTP ${response.status}.`);
      }
      durations.push(Number(response.body.__elapsed));
    }
    console.log(
      `GET /employees (${SAMPLE_COUNT} solicitudes): ` +
        `p50=${percentile(durations, 0.5).toFixed(1)} ms, ` +
        `p95=${percentile(durations, 0.95).toFixed(1)} ms, ` +
        `p99=${percentile(durations, 0.99).toFixed(1)} ms; objetivo p95 < 300 ms.`,
    );
    if (percentile(durations, 0.95) >= 300) {
      throw new Error('El p95 superó el objetivo de 300 ms.');
    }
  } finally {
    try {
      const employees = await owner.empleado.findMany({
        where: { nombres: { startsWith: PREFIX } },
        select: { id: true },
      });
      const ids = employees.map((employee) => employee.id);
      if (ids.length > 0) {
        const events = await owner.outboxEvento.findMany({
          where: {
            eventName: { in: ['EMPLEADO_CREADO', 'AUDITORIA_REGISTRADA'] },
          },
          select: { id: true, payload: true },
        });
        const eventIds = events
          .filter((event) => ids.some((id) => JSON.stringify(event.payload).includes(id)))
          .map((event) => event.id);
        if (eventIds.length > 0) {
          await owner.outboxEvento.deleteMany({ where: { id: { in: eventIds } } });
        }
        await owner.inamovilidadLaboral.deleteMany({ where: { empleadoId: { in: ids } } });
        await owner.historialLaboral.deleteMany({ where: { empleadoId: { in: ids } } });
        await owner.empleado.deleteMany({ where: { id: { in: ids } } });
      }
    } finally {
      await Promise.all([runtime.$disconnect(), owner.$disconnect()]);
    }
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  console.error(`Falló la prueba de rendimiento personal: ${message}`);
  process.exitCode = 1;
});
