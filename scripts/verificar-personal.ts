import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '../services/ms-personal/prisma/generated/client';

type HttpResult = { status: number; body: Record<string, unknown> };

const PREFIX = `__test__${randomUUID().slice(0, 8)}__`;
const EMPLOYEE_EVENTS = [
  'EMPLEADO_CREADO',
  'EMPLEADO_MODIFICADO',
  'EMPLEADO_DADO_DE_BAJA',
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable requerida ${name}.`);
  return value;
}

function ciAleatoria(): string {
  return `9${randomBytes(7).toString('hex').toUpperCase()}`;
}

function hoyLaPaz(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/La_Paz',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function form(
  datos: Record<string, unknown>,
  fileName: string,
  mime: string,
  bytes: Buffer,
  fieldName: string,
): FormData {
  const body = new FormData();
  body.set('datos', JSON.stringify(datos));
  body.set(fieldName, new Blob([Uint8Array.from(bytes)], { type: mime }), fileName);
  return body;
}

async function request(path: string, init: RequestInit): Promise<HttpResult> {
  const base = required('PERSONAL_API_URL').replace(/\/+$/, '');
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${required('PERSONAL_TEST_TOKEN')}`,
    },
  });
  const body = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { status: response.status, body };
}

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function jsonBody(result: HttpResult): Record<string, unknown> {
  return result.body;
}

async function assertDatabaseAtomicity(
  runtime: PrismaClient,
  owner: PrismaClient,
  areaId: string,
  cargoId: string,
): Promise<void> {
  const id = randomUUID();
  const ciHash = randomBytes(32).toString('hex');
  let failed = false;
  try {
    await runtime.$transaction(async (tx) => {
      await tx.empleado.create({
        data: {
          id,
          nombres: `${PREFIX}atomic`,
          apellidos: 'Probe',
          ciCifrado: 'ciphertext-test',
          ciHash,
          areaId,
          cargoId,
          remuneracionCifrada: 'ciphertext-test',
          fechaIngreso: new Date('2020-01-01T00:00:00Z'),
          diasPrueba: 90,
          estado: 'EN_PRUEBA',
          firmaPublicId: randomUUID(),
          creadoPor: randomUUID(),
        },
      });
      await tx.$executeRaw`
        INSERT INTO outbox_evento (id, event_name, payload, occurred_on)
        VALUES ('not-a-uuid'::uuid, 'EMPLEADO_CREADO', '{}'::jsonb, now())
      `;
    });
  } catch {
    failed = true;
  }
  check(failed, 'El Outbox de prueba no falló como se esperaba.');
  const persisted = await owner.empleado.findUnique({ where: { id } });
  check(persisted === null, 'La transacción dejó un empleado tras fallar el Outbox.');
  console.log('OK: rollback de empleado cuando falla la escritura de Outbox en la transacción.');
}

async function assertRuntimePrivileges(runtime: PrismaClient, employeeId: string): Promise<void> {
  const role = await runtime.$queryRaw<Array<{ current_user: string }>>`SELECT current_user`;
  if (!role[0]?.current_user.endsWith('_app')) {
    console.log('PENDIENTE: privilegios de runtime: DATABASE_URL no usa un rol *_app.');
    return;
  }
  for (const [label, statement] of [
    [
      'DELETE empleado',
      (tx: Prisma.TransactionClient) =>
        tx.$executeRaw`DELETE FROM empleado WHERE id = ${employeeId}::uuid`,
    ],
    [
      'UPDATE historial_laboral',
      (tx: Prisma.TransactionClient) =>
        tx.$executeRaw`UPDATE historial_laboral SET motivo = motivo WHERE empleado_id = ${employeeId}::uuid`,
    ],
  ] as const) {
    let statementSucceeded = false;
    try {
      await runtime.$transaction(async (tx) => {
        await statement(tx);
        statementSucceeded = true;
        throw new Error('rollback de prueba');
      });
    } catch {
      if (statementSucceeded) throw new Error(`El usuario runtime sí pudo ejecutar ${label}.`);
    }
    console.log(`OK: ${label} denegado para el usuario runtime.`);
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production' || process.env.PERSONAL_TEST_ALLOW_MUTATIONS !== 'true') {
    throw new Error(
      'Prueba destructiva bloqueada: use una base aislada y PERSONAL_TEST_ALLOW_MUTATIONS=true.',
    );
  }
  const runtimeUrl = required('DATABASE_URL');
  const ownerUrl = required('DIRECT_URL');
  const apiUrl = required('PERSONAL_API_URL');
  required('PERSONAL_TEST_TOKEN');
  check(
    /\/api\/personal\/?$/.test(apiUrl),
    'PERSONAL_API_URL debe apuntar al gateway y terminar en /api/personal.',
  );

  const runtime = new PrismaClient({ datasources: { db: { url: runtimeUrl } } });
  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
  let areaIds: string[] = [];
  let cargoIds: string[] = [];
  let employeeIds: string[] = [];
  let previousForeignLimit: string | null = null;
  let changedForeignLimit = false;

  try {
    const area1 = await owner.area.create({ data: { nombre: `${PREFIX}area1` } });
    areaIds.push(area1.id);
    const area2 = await owner.area.create({ data: { nombre: `${PREFIX}area2` } });
    areaIds.push(area2.id);
    const cargo1 = await owner.cargo.create({ data: { nombre: `${PREFIX}cargo1` } });
    cargoIds.push(cargo1.id);
    const cargo2 = await owner.cargo.create({ data: { nombre: `${PREFIX}cargo2` } });
    cargoIds.push(cargo2.id);

    await assertDatabaseAtomicity(runtime, owner, area1.id, cargo1.id);

    const ci = ciAleatoria();
    const datos = {
      nombres: `${PREFIX}Ana`,
      apellidos: 'Prueba',
      ci,
      areaId: area1.id,
      cargoId: cargo1.id,
      remuneracion: '6000.00',
      fechaIngreso: '2020-01-01',
    };
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const attempts = await Promise.all(
      [0, 1].map(() =>
        request('/employees', {
          method: 'POST',
          body: form(datos, 'signature.dat', 'application/octet-stream', signature, 'firma'),
        }),
      ),
    );
    const created = attempts.filter((result) => result.status === 201);
    employeeIds.push(...created.map((result) => String(result.body.id)));
    const duplicate = attempts.filter(
      (result) =>
        result.status === 409 &&
        result.body.code === 'PERS_CI_DUPLICADA',
    );
    check(created.length === 1 && duplicate.length === 1, 'Dos altas iguales no resultaron en una sola alta y un 409.');
    const employeeId = String(created[0]?.body.id);
    console.log('OK: dos altas simultáneas con el mismo CI produjeron una alta y un 409.');

    const stored = await owner.empleado.findUnique({ where: { id: employeeId } });
    check(stored !== null, 'No se encontró el empleado creado.');
    check(!stored.ciCifrado.includes(ci), 'La CI aparece en claro en ci_cifrado.');
    check(!stored.remuneracionCifrada.includes('6000.00'), 'La remuneración aparece en claro.');
    const createdEvents = await owner.outboxEvento.findMany({
      where: { eventName: 'EMPLEADO_CREADO' },
    });
    const createdEvent = createdEvents.find((event) =>
      JSON.stringify(event.payload).includes(employeeId),
    );
    check(createdEvent !== undefined, 'No se encontró EMPLEADO_CREADO en Outbox.');
    const eventText = JSON.stringify(createdEvent.payload);
    check(!eventText.includes(ci) && !eventText.includes('6000.00'), 'El evento contiene CI o sueldo.');
    console.log('OK: CI y remuneración cifradas; evento sin CI ni sueldo.');

    const patch = await request(`/employees/${employeeId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        areaId: area2.id,
        cargoId: cargo2.id,
        remuneracion: '9876.54',
        fechaEfectiva: hoyLaPaz(),
        motivo: `${PREFIX}cambio`,
      }),
    });
    check(patch.status === 200, `PATCH respondió ${patch.status}.`);
    const changes = await runtime.historialLaboral.count({
      where: {
        empleadoId: employeeId,
        tipo: { in: ['CAMBIO_AREA', 'CAMBIO_CARGO', 'CAMBIO_REMUNERACION'] },
      },
    });
    check(changes === 3, 'El PATCH no creó un historial por cada campo cambiado.');
    console.log('OK: PATCH escribió tres historiales para tres aspectos.');

    const outboxBeforeSimulation = await owner.outboxEvento.count();
    const simulation = await request(`/employees/${employeeId}/baja/simular`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ fechaBaja: hoyLaPaz(), aplicaDesahucio: false }),
    });
    check(simulation.status === 200, `Simulación de baja respondió ${simulation.status}.`);
    check(
      (await owner.outboxEvento.count()) === outboxBeforeSimulation,
      'La simulación escribió un evento de Outbox/auditoría.',
    );
    console.log('OK: la simulación de finiquito no generó escrituras ni eventos.');

    const inamovilidad = await request(`/employees/${employeeId}/inamovilidades`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tipo: 'GESTACION',
        fechaInicio: '2020-01-01',
        observacion: `${PREFIX}inamovilidad`,
      }),
    });
    check(inamovilidad.status === 201, `Alta de inamovilidad respondió ${inamovilidad.status}.`);

    const bajaDatos = {
      fechaBaja: hoyLaPaz(),
      motivo: `${PREFIX}baja`,
      aplicaDesahucio: false,
      diasVacacionesPendientes: 0,
    };
    const blockedForm = new FormData();
    blockedForm.set('datos', JSON.stringify(bajaDatos));
    const blocked = await request(`/employees/${employeeId}/baja`, {
      method: 'POST',
      body: blockedForm,
    });
    check(
      blocked.status === 409 && blocked.body.code === 'PERS_INAMOVILIDAD_ACTIVA',
      `Baja con fuero sin autorización respondió ${blocked.status}.`,
    );
    const unchanged = await owner.empleado.findUnique({ where: { id: employeeId } });
    check(unchanged?.estado !== 'INACTIVO', 'La baja bloqueada cambió el estado.');
    console.log('OK: baja sin autorización ministerial bloqueada, sin cambiar el estado.');

    const authorized = await request(`/employees/${employeeId}/baja`, {
      method: 'POST',
      body: form(
        bajaDatos,
        'autorizacion.dat',
        'application/octet-stream',
        Buffer.from('%PDF-1.7\n__test__'),
        'autorizacionMinisterio',
      ),
    });
    check(authorized.status === 201, `Baja autorizada respondió ${authorized.status}.`);
    const inactive = await owner.empleado.findUnique({ where: { id: employeeId } });
    check(inactive?.estado === 'INACTIVO', 'La baja autorizada no dejó el empleado INACTIVO.');
    check(
      (await owner.baja.findUnique({ where: { empleadoId: employeeId } })) !== null,
      'No se guardó la fila de baja.',
    );
    check(
      (await owner.outboxEvento.findFirst({
        where: { eventName: 'EMPLEADO_DADO_DE_BAJA' },
      })) !== null,
      'No se guardó EMPLEADO_DADO_DE_BAJA.',
    );
    console.log('OK: baja autorizada dejó estado, fila y evento.');

    await assertRuntimePrivileges(runtime, employeeId);

    const baseline = await request('/employees', {
      method: 'POST',
      body: form(
        {
          ...datos,
          nombres: `${PREFIX}Base`,
          ci: ciAleatoria(),
        },
        'signature.png',
        'image/png',
        signature,
        'firma',
      ),
    });
    if (baseline.status === 201) employeeIds.push(String(baseline.body.id));
    check(baseline.status === 201, 'No se pudo crear el funcionario base para el límite extranjero.');

    const config = await owner.configuracionPersonal.findUnique({
      where: { clave: 'LIMITE_EXTRANJEROS_PCT' },
    });
    previousForeignLimit = config?.valor ?? null;
    const [active, foreign] = await Promise.all([
      runtime.empleado.count({ where: { estado: { not: 'INACTIVO' } } }),
      runtime.empleado.count({
        where: { estado: { not: 'INACTIVO' }, esExtranjero: true },
      }),
    ]);
    const minLimit = Math.ceil(((foreign + 1) * 10000) / (active + 1));
    const nextLimit = Math.ceil(((foreign + 2) * 10000) / (active + 2));
    if (previousForeignLimit && minLimit < nextLimit) {
      const candidate = Array.from({ length: nextLimit - minLimit }, (_, index) => minLimit + index)
        .find((basisPoints) => basisPoints >= minLimit && basisPoints < nextLimit);
      if (candidate !== undefined) {
        await owner.configuracionPersonal.update({
          where: { clave: 'LIMITE_EXTRANJEROS_PCT' },
          data: { valor: `${Math.floor(candidate / 100)}.${String(candidate % 100).padStart(2, '0')}` },
        });
        changedForeignLimit = true;
        const foreignData = {
          ...datos,
          nombres: `${PREFIX}Extranjero`,
          ci: ciAleatoria(),
          esExtranjero: true,
        };
        const responses = await Promise.all(
          [0, 1].map(() =>
            request('/employees', {
              method: 'POST',
              body: form(foreignData, 'signature.png', 'image/png', signature, 'firma'),
            }),
          ),
        );
        const successes = responses.filter((result) => result.status === 201);
        employeeIds.push(...successes.map((result) => String(result.body.id)));
        const rejected = responses.filter(
          (result) => result.status === 409 && result.body.code === 'PERS_LIMITE_EXTRANJEROS',
        );
        check(successes.length === 1 && rejected.length === 1, 'El límite extranjero no serializó las dos altas.');
        console.log('OK: dos altas extranjeras simultáneas al límite produjeron una aceptación y un 409.');
      } else {
        console.log('PENDIENTE: no hubo un porcentaje de dos decimales para probar el límite concurrente.');
      }
    } else {
      console.log('PENDIENTE: no hay configuración o población activa suficiente para probar el límite concurrente.');
    }

    const plan = await runtime.$queryRaw<Array<{ 'QUERY PLAN': string }>>`
      EXPLAIN (FORMAT TEXT)
      SELECT id
      FROM empleado
      WHERE area_id = ${area1.id}::uuid
        AND cargo_id = ${cargo1.id}::uuid
        AND estado = 'EN_PRUEBA'
      ORDER BY apellidos, nombres, id
      LIMIT 20
    `;
    const planText = plan.map((row) => row['QUERY PLAN']).join('\n');
    console.log(`EXPLAIN del listado filtrado:\n${planText}`);
  } finally {
    try {
      if (changedForeignLimit && previousForeignLimit) {
        await owner.configuracionPersonal.update({
          where: { clave: 'LIMITE_EXTRANJEROS_PCT' },
          data: { valor: previousForeignLimit },
        });
      }
    } finally {
      try {
        if (employeeIds.length > 0) {
          const events = await owner.outboxEvento.findMany({
            where: { eventName: { in: [...EMPLOYEE_EVENTS, 'AUDITORIA_REGISTRADA'] } },
            select: { id: true, payload: true },
          });
          const ids = events
            .filter((event) => {
              const payload = JSON.stringify(event.payload);
              return employeeIds.some((id) => payload.includes(id));
            })
            .map((event) => event.id);
          if (ids.length > 0) await owner.outboxEvento.deleteMany({ where: { id: { in: ids } } });
          await owner.inamovilidadLaboral.deleteMany({ where: { empleadoId: { in: employeeIds } } });
          await owner.baja.deleteMany({ where: { empleadoId: { in: employeeIds } } });
          await owner.historialLaboral.deleteMany({ where: { empleadoId: { in: employeeIds } } });
          await owner.empleado.deleteMany({ where: { id: { in: employeeIds } } });
        }
        if (cargoIds.length > 0) await owner.cargo.deleteMany({ where: { id: { in: cargoIds } } });
        if (areaIds.length > 0) await owner.area.deleteMany({ where: { id: { in: areaIds } } });
      } finally {
        await Promise.all([runtime.$disconnect(), owner.$disconnect()]);
      }
    }
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Error desconocido';
  console.error(`Falló la verificación de personal: ${message}`);
  process.exitCode = 1;
});
