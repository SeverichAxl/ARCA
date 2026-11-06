import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../services/ms-vacaciones/prisma/generated/client';
import { OutboxService } from '../packages/messaging/src/outbox.service';
import { VacationApprovalService } from '../services/ms-vacaciones/src/application/vacations/vacation-approval.service';
import { PrismaService } from '../services/ms-vacaciones/src/infrastructure/prisma/prisma.service';

const marker = '__test__';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta configurar ${name} en .env.`);
  }
  return value;
}

function hostDatabaseUrl(value: string, key: string): string {
  const url = new URL(value);
  if (url.hostname === 'postgres') {
    url.hostname = '127.0.0.1';
    url.port = process.env.POSTGRES_PORT ?? '5432';
  }
  if (!url.hostname || !url.port) {
    throw new Error(`${key} debe incluir host y puerto.`);
  }
  return url.toString();
}

function errorText(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const metadata =
    'meta' in error && typeof error.meta === 'object' && error.meta !== null
      ? JSON.stringify(error.meta)
      : '';
  return `${error.message} ${metadata}`;
}

async function expectDatabaseFailure(
  label: string,
  operation: () => Promise<unknown>,
  expectedText: string,
): Promise<void> {
  let failure: unknown;
  try {
    await operation();
  } catch (error) {
    failure = error;
  }
  if (!failure) {
    throw new Error(`${label}: PostgreSQL permitió una operación que debía rechazar.`);
  }
  const details = errorText(failure);
  if (!details.toLowerCase().includes(expectedText.toLowerCase())) {
    throw new Error(`${label}: error inesperado de PostgreSQL: ${details}`);
  }
  console.log(`OK ${label}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`OK ${message}`);
}

interface Fixture {
  employeeId: string;
  managerId: string;
  hrId: string;
  userId: string;
  constraintRequestId: string;
  exceptionId: string;
  zeroDaysRequestId: string;
  concurrencyRequestId: string;
  balanceId: string;
  negativeBalanceId: string;
}

function createFixture(): Fixture {
  return {
    employeeId: randomUUID(),
    managerId: randomUUID(),
    hrId: randomUUID(),
    userId: randomUUID(),
    constraintRequestId: randomUUID(),
    exceptionId: randomUUID(),
    zeroDaysRequestId: randomUUID(),
    concurrencyRequestId: randomUUID(),
    balanceId: randomUUID(),
    negativeBalanceId: randomUUID(),
  };
}

async function createFixtures(owner: PrismaClient, fixture: Fixture): Promise<void> {
  const employeeIds = [fixture.employeeId, fixture.managerId, fixture.hrId];
  for (const [index, empleadoId] of employeeIds.entries()) {
    await owner.$executeRaw`
      INSERT INTO empleado_ref (
        empleado_id, nombre_completo, area_id, jefe_empleado_id, estado,
        fecha_ingreso, fecha_baja, ultimo_evento_en, actualizado_en
      ) VALUES (
        ${empleadoId}::uuid, ${`${marker} funcionario ${index}`},
        ${randomUUID()}::uuid, NULL, 'RATIFICADO'::"EstadoEmpleadoRef",
        DATE '2020-01-01', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
  }

  await owner.$executeRaw`
    INSERT INTO solicitud_vacacion (
      id, empleado_id, fecha_inicio, fecha_fin, dias_habiles, estado,
      jefe_empleado_id, motivo_rechazo, creado_en, actualizado_en
    ) VALUES (
      ${fixture.constraintRequestId}::uuid, ${fixture.employeeId}::uuid,
      DATE '2099-01-05', DATE '2099-01-06', 2, 'PENDIENTE_JEFE',
      ${fixture.managerId}::uuid, ${`${marker} CHECK control`},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  await owner.$executeRaw`
    INSERT INTO solicitud_excepcion (
      id, solicitud_id, dias_excedentes, justificacion, estado, creado_en
    ) VALUES (
      ${fixture.exceptionId}::uuid, ${fixture.constraintRequestId}::uuid,
      1, ${`${marker} trigger self-resolution`}, 'PENDIENTE', CURRENT_TIMESTAMP
    )
  `;
  await owner.$executeRaw`
    INSERT INTO solicitud_vacacion (
      id, empleado_id, fecha_inicio, fecha_fin, dias_habiles, estado,
      jefe_empleado_id, aprobado_jefe_por, motivo_rechazo, creado_en, actualizado_en
    ) VALUES (
      ${fixture.concurrencyRequestId}::uuid, ${fixture.employeeId}::uuid,
      DATE '2099-03-02', DATE '2099-03-05', 4, 'APROBADO_JEFE',
      ${fixture.managerId}::uuid, ${fixture.managerId}::uuid, ${`${marker} concurrency`},
      CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
  `;
  await owner.$executeRaw`
    INSERT INTO saldo_vacaciones (
      id, empleado_id, gestion, dias_asignados, dias_excepcion,
      dias_tomados, congelado, creado_en
    ) VALUES (
      ${fixture.balanceId}::uuid, ${fixture.employeeId}::uuid,
      9001, 15, 0, 0, false, CURRENT_TIMESTAMP
    )
  `;
}

async function verifyRuntimeConstraints(runtime: PrismaClient, fixture: Fixture): Promise<void> {
  await expectDatabaseFailure(
    'CHECK impide la autoaprobación del jefe',
    () =>
      runtime.$executeRaw`
        UPDATE solicitud_vacacion
        SET aprobado_jefe_por = empleado_id
        WHERE id = ${fixture.constraintRequestId}::uuid
      `,
    'ck_no_autoaprobacion_jefe',
  );
  await runtime.$executeRaw`
    UPDATE solicitud_vacacion
    SET aprobado_jefe_por = ${fixture.managerId}::uuid
    WHERE id = ${fixture.constraintRequestId}::uuid
  `;
  await expectDatabaseFailure(
    'CHECK impide la autoaprobación de RRHH',
    () =>
      runtime.$executeRaw`
        UPDATE solicitud_vacacion
        SET aprobado_rrhh_por = empleado_id
        WHERE id = ${fixture.constraintRequestId}::uuid
      `,
    'ck_no_autoaprobacion_rrhh',
  );
  await runtime.$executeRaw`
    UPDATE solicitud_vacacion
    SET aprobado_rrhh_por = ${fixture.hrId}::uuid
    WHERE id = ${fixture.constraintRequestId}::uuid
  `;
  assert(true, 'otro aprobador puede actualizar aprobaciones de control');

  await expectDatabaseFailure(
    'trigger impide resolver la propia excepción',
    () =>
      runtime.$executeRaw`
        UPDATE solicitud_excepcion
        SET resuelto_por = ${fixture.employeeId}::uuid,
            resuelto_en = CURRENT_TIMESTAMP
        WHERE id = ${fixture.exceptionId}::uuid
      `,
    'Nadie puede resolver su propia solicitud de excepción',
  );
  await runtime.$executeRaw`
    UPDATE solicitud_excepcion
    SET resuelto_por = ${fixture.hrId}::uuid,
        resuelto_en = CURRENT_TIMESTAMP,
        estado = 'APROBADA'
    WHERE id = ${fixture.exceptionId}::uuid
  `;
  assert(true, 'otro usuario puede resolver la excepción de control');

  await expectDatabaseFailure(
    'CHECK rechaza saldo con dias_tomados negativo',
    () =>
      runtime.$executeRaw`
        INSERT INTO saldo_vacaciones (
          id, empleado_id, gestion, dias_asignados, dias_excepcion,
          dias_tomados, congelado, creado_en
        ) VALUES (
          ${fixture.negativeBalanceId}::uuid, ${fixture.employeeId}::uuid,
          9002, 15, 0, -1, false, CURRENT_TIMESTAMP
        )
      `,
    'ck_saldo_no_negativo',
  );
  await expectDatabaseFailure(
    'CHECK rechaza solicitud con dias_habiles igual a cero',
    () =>
      runtime.$executeRaw`
        INSERT INTO solicitud_vacacion (
          id, empleado_id, fecha_inicio, fecha_fin, dias_habiles, estado,
          jefe_empleado_id, creado_en, actualizado_en
        ) VALUES (
          ${fixture.zeroDaysRequestId}::uuid, ${fixture.employeeId}::uuid,
          DATE '2099-02-02', DATE '2099-02-02', 0, 'PENDIENTE_JEFE',
          ${fixture.managerId}::uuid, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `,
    'ck_dias_habiles_positivo',
  );
}

async function verifyConcurrentApproval(runtime: PrismaService, fixture: Fixture): Promise<void> {
  const approval = new VacationApprovalService(runtime, new OutboxService());
  const principal = {
    userId: fixture.userId,
    empleadoId: fixture.hrId,
    rol: 'RRHH_OPERATIVO',
    permisos: ['vacaciones:approve_rrhh'],
  };

  const results = await Promise.allSettled([
    approval.approveByHr(fixture.concurrencyRequestId, principal),
    approval.approveByHr(fixture.concurrencyRequestId, principal),
  ]);
  const successes = results.filter((result) => result.status === 'fulfilled');
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  assert(successes.length === 1, 'exactamente una aprobación concurrente tiene éxito');
  assert(failures.length === 1, 'exactamente una aprobación concurrente falla');

  const failure = failures[0]?.reason;
  const response =
    typeof failure === 'object' &&
    failure !== null &&
    'getResponse' in failure &&
    typeof failure.getResponse === 'function'
      ? failure.getResponse()
      : undefined;
  const responseCode =
    typeof response === 'object' && response !== null && 'code' in response
      ? response.code
      : undefined;
  const status =
    typeof failure === 'object' &&
    failure !== null &&
    'getStatus' in failure &&
    typeof failure.getStatus === 'function'
      ? failure.getStatus()
      : undefined;
  if (status !== 409 || responseCode !== 'VAC_ESTADO_INVALIDO') {
    throw new Error(
      `La solicitud concurrente debía fallar con 409 VAC_ESTADO_INVALIDO: ${errorText(failure)}`,
    );
  }
  console.log('OK la aprobación concurrente perdedora devuelve 409 VAC_ESTADO_INVALIDO');

  const balance = await runtime.$queryRaw<Array<{ dias_tomados: number }>>`
    SELECT dias_tomados FROM saldo_vacaciones
    WHERE id = ${fixture.balanceId}::uuid
  `;
  assert(balance[0]?.dias_tomados === 4, 'el saldo se descuenta una sola vez');
  const request = await runtime.$queryRaw<Array<{ estado: string }>>`
    SELECT estado::text FROM solicitud_vacacion
    WHERE id = ${fixture.concurrencyRequestId}::uuid
  `;
  assert(request[0]?.estado === 'APROBADO_FINAL', 'la solicitud queda aprobada una sola vez');
  const discounts = await runtime.$queryRaw<Array<{ cantidad: number }>>`
    SELECT COUNT(*)::int AS cantidad
    FROM descuento_saldo
    WHERE solicitud_id = ${fixture.concurrencyRequestId}::uuid
      AND saldo_id = ${fixture.balanceId}::uuid
  `;
  assert(discounts[0]?.cantidad === 1, 'existe una sola fila descuento_saldo para el saldo');
}

async function cleanup(owner: PrismaClient, fixture: Fixture): Promise<void> {
  for (const requestId of [
    fixture.constraintRequestId,
    fixture.zeroDaysRequestId,
    fixture.concurrencyRequestId,
  ]) {
    await owner.$executeRaw`
      DELETE FROM outbox_evento
      WHERE payload->>'entidadId' = ${requestId}
    `;
  }
  await owner.$executeRaw`
    DELETE FROM historial_solicitud
    WHERE solicitud_id IN (
      ${fixture.constraintRequestId}::uuid,
      ${fixture.zeroDaysRequestId}::uuid,
      ${fixture.concurrencyRequestId}::uuid
    )
  `;
  await owner.$executeRaw`
    DELETE FROM descuento_saldo
    WHERE solicitud_id IN (
      ${fixture.constraintRequestId}::uuid,
      ${fixture.zeroDaysRequestId}::uuid,
      ${fixture.concurrencyRequestId}::uuid
    )
  `;
  await owner.$executeRaw`
    DELETE FROM solicitud_excepcion
    WHERE id = ${fixture.exceptionId}::uuid
  `;
  await owner.$executeRaw`
    DELETE FROM solicitud_vacacion
    WHERE id IN (
      ${fixture.constraintRequestId}::uuid,
      ${fixture.zeroDaysRequestId}::uuid,
      ${fixture.concurrencyRequestId}::uuid
    )
  `;
  await owner.$executeRaw`
    DELETE FROM saldo_vacaciones
    WHERE id IN (
      ${fixture.balanceId}::uuid,
      ${fixture.negativeBalanceId}::uuid
    )
  `;
  await owner.$executeRaw`
    DELETE FROM empleado_ref
    WHERE empleado_id IN (
      ${fixture.employeeId}::uuid,
      ${fixture.managerId}::uuid,
      ${fixture.hrId}::uuid
    )
      AND nombre_completo LIKE ${`${marker}%`}
  `;
}

async function main(): Promise<void> {
  const runtimeUrl = hostDatabaseUrl(
    required('VACACIONES_DATABASE_URL'),
    'VACACIONES_DATABASE_URL',
  );
  const ownerUrl = hostDatabaseUrl(required('VACACIONES_DIRECT_URL'), 'VACACIONES_DIRECT_URL');
  const fixture = createFixture();
  const owner = new PrismaClient({ datasources: { db: { url: ownerUrl } } });

  process.env.DATABASE_URL = runtimeUrl;
  process.env.DIRECT_URL = ownerUrl;
  const runtime = new PrismaService();
  let fixturesMayExist = false;
  let testFailure: unknown;

  try {
    await owner.$connect();
    await runtime.$connect();
    fixturesMayExist = true;
    await createFixtures(owner, fixture);
    await verifyRuntimeConstraints(runtime, fixture);
    await verifyConcurrentApproval(runtime, fixture);
  } catch (error) {
    testFailure = error;
  } finally {
    await runtime.$disconnect();
    if (fixturesMayExist) {
      try {
        await cleanup(owner, fixture);
        console.log('OK datos __test__ limpiados mediante VACACIONES_DIRECT_URL');
      } catch (error) {
        testFailure = new AggregateError(
          [testFailure, error].filter(Boolean),
          'Falló la prueba o la limpieza de datos __test__.',
        );
      }
    }
    await owner.$disconnect();
  }

  if (testFailure) {
    console.error(errorText(testFailure));
    process.exitCode = 1;
    return;
  }
  console.log('Verificación de restricciones de vacaciones completada.');
}

void main().catch((error: unknown) => {
  console.error(errorText(error));
  process.exitCode = 1;
});
