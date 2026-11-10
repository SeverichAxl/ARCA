import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { AuditContext } from '@arca/audit';
import { InternalAuthGuard, signInternalHeaders } from '@arca/internal-auth';
import request from 'supertest';
import { toCents } from '../../domain/common/money';
import {
  CLOCK,
  EMPLEADOS_NOMINA_PORT,
  PLANILLA_REPOSITORY,
} from '../../domain/planillas/planilla.models';
import { InMemoryRepo, uuid } from '../../test-support/in-memory-planilla.repository';
import { LegalParameterController } from '../legal-parameters/legal-parameter.controller';
import { LegalParameterService } from '../legal-parameters/legal-parameter.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { crearValidationPipe } from '../../common/validation';
import { PlanillasController } from './planillas.controller';
import { PlanillasService } from './planillas.service';

const SECRET = 'clave-hmac-de-prueba-para-planillas';

const ROLES: Record<string, { permisos: string[]; empleadoId: string | null }> = {
  ENCARGADO_NOMINA: {
    empleadoId: uuid(10),
    permisos: [
      'personal:read',
      'personal:read_salary',
      'planilla:calculate',
      'planilla:close',
      'boleta:issue',
      'boleta:read_all',
      'planilla:read',
      'dashboard:read',
      'export:data',
      'boleta:read_own',
    ],
  },
  FUNCIONARIO: { empleadoId: uuid(2), permisos: ['boleta:read_own', 'vacaciones:read_own'] },
  RRHH_OPERATIVO: {
    empleadoId: uuid(11),
    permisos: ['personal:read', 'dashboard:read', 'boleta:read_own'],
  },
};

function firmar(rol: keyof typeof ROLES, method: string, path: string, extra: string[] = []) {
  const { permisos, empleadoId } = ROLES[rol];
  return signInternalHeaders({
    secret: SECRET,
    method,
    path,
    principal: { userId: uuid(500), rol, empleadoId, permisos: [...permisos, ...extra] },
  });
}

describe('PlanillasController (HTTP + InternalAuthGuard)', () => {
  let app: INestApplication;
  let repo: InMemoryRepo;

  beforeAll(async () => {
    process.env.INTERNAL_HMAC_KEY = SECRET;
    repo = new InMemoryRepo();
    const empleados = [1, 2, 3].map((n) => ({
      empleadoId: uuid(n),
      nombreCompleto: `Funcionario ${n}`,
      ciEnmascarado: `***100${n}`,
      areaId: uuid(900),
      cargoId: uuid(901),
      fechaIngreso: '2020-01-01',
      haberBasico: toCents('5000'),
    }));
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => ({ INTERNAL_HMAC_KEY: SECRET })],
        }),
      ],
      // Mismo orden que app.module: parámetros antes que /planillas/:id.
      controllers: [LegalParameterController, PlanillasController],
      providers: [
        PlanillasService,
        LegalParameterService,
        { provide: PrismaService, useValue: { parametroLegal: { findMany: async () => [] } } },
        AuditContext,
        { provide: PLANILLA_REPOSITORY, useValue: repo },
        { provide: EMPLEADOS_NOMINA_PORT, useValue: { listarActivos: async () => empleados } },
        { provide: CLOCK, useValue: { now: () => new Date() } },
        { provide: APP_GUARD, useClass: InternalAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(crearValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /planillas/parametros llega al CRUD de parámetros, no a /planillas/:id', async () => {
    const path = '/planillas/parametros';
    const r = await request(app.getHttpServer())
      .get(path)
      .set(firmar('ENCARGADO_NOMINA', 'GET', path, ['parametros_ley:update']))
      .expect(200);
    expect(r.body).toEqual([]);
  });

  /** El cálculo es asíncrono: espera a que la planilla salga de EN_PROCESO. */
  async function esperarEstado(id: string): Promise<Record<string, unknown>> {
    const path = `/planillas/${id}`;
    for (let intento = 0; intento < 50; intento += 1) {
      const r = await request(app.getHttpServer())
        .get(path)
        .set(firmar('ENCARGADO_NOMINA', 'GET', path))
        .expect(200);
      if (r.body.estado !== 'EN_PROCESO') return r.body as Record<string, unknown>;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error('La planilla no terminó de procesarse');
  }

  it('401 sin cabeceras internas firmadas', async () => {
    await request(app.getHttpServer()).post('/planillas').send({ periodo: '2026-10' }).expect(401);
  });

  it('403 con firma válida pero sin planilla:calculate', async () => {
    await request(app.getHttpServer())
      .post('/planillas')
      .set(firmar('RRHH_OPERATIVO', 'POST', '/planillas'))
      .send({ periodo: '2026-10' })
      .expect(403);
  });

  it('flujo del contrato: novedad -> POST 202 -> CALCULADA -> detalles -> cerrar -> historial', async () => {
    const server = app.getHttpServer();

    const novedadPath = `/planillas/periodos/2026-10/novedades/${uuid(1)}`;
    await request(server)
      .put(novedadPath)
      .set(firmar('ENCARGADO_NOMINA', 'PUT', novedadPath))
      .send({ rcIvaComputable: '1500.00', subsidios: { natalidad: '3300' } })
      .expect(200);

    const aceptado = await request(server)
      .post('/planillas')
      .set(firmar('ENCARGADO_NOMINA', 'POST', '/planillas'))
      .send({ periodo: '2026-10', observacion: 'Proceso octubre' })
      .expect(202);
    expect(aceptado.body).toMatchObject({ periodo: '2026-10', estado: 'EN_PROCESO' });
    const id = aceptado.body.id as string;

    const planilla = await esperarEstado(id);
    expect(planilla).toMatchObject({ estado: 'CALCULADA', totalGanado: '18267.00' });

    const duplicado = await request(server)
      .post('/planillas')
      .set(firmar('ENCARGADO_NOMINA', 'POST', '/planillas'))
      .send({ periodo: '2026-10' })
      .expect(409);
    expect(duplicado.body.code).toBe('PLANILLA_PERIODO_DUPLICADO');

    const detallesPath = `/planillas/${id}/detalles`;
    const detalles = await request(server)
      .get(detallesPath)
      .set(firmar('ENCARGADO_NOMINA', 'GET', detallesPath))
      .expect(200);
    expect(detalles.body.meta.total).toBe(3);

    const detPath = `/planillas/${id}/detalles/${uuid(1)}`;
    const det = await request(server)
      .get(detPath)
      .set(firmar('ENCARGADO_NOMINA', 'GET', detPath))
      .expect(200);
    expect(det.body.subsidiosInformativos).toEqual([{ tipo: 'natalidad', monto: '3300.00' }]);

    const cerrarPath = `/planillas/${id}/cerrar`;
    await request(server)
      .post(cerrarPath)
      .set(firmar('ENCARGADO_NOMINA', 'POST', cerrarPath))
      .send({ confirmacion: true })
      .expect(200);
    const doble = await request(server)
      .post(cerrarPath)
      .set(firmar('ENCARGADO_NOMINA', 'POST', cerrarPath))
      .expect(409);
    expect(doble.body.code).toBe('PLANILLA_ESTADO_INVALIDO');

    const borrar = await request(server)
      .delete(`/planillas/${id}`)
      .set(firmar('ENCARGADO_NOMINA', 'DELETE', `/planillas/${id}`))
      .expect(409);
    expect(borrar.body.code).toBe('PLANILLA_ESTADO_INVALIDO');

    const historial = await request(server)
      .get('/planillas/historial')
      .set(firmar('ENCARGADO_NOMINA', 'GET', '/planillas/historial'))
      .expect(200);
    expect(historial.body.data[0]).toMatchObject({ id, estado: 'CERRADA' });

    const kpis = await request(server)
      .get('/planillas/kpis')
      .set(firmar('ENCARGADO_NOMINA', 'GET', '/planillas/kpis'))
      .expect(200);
    expect(kpis.body).toMatchObject({ periodo: '2026-10', costoPlanilla: '21319.41' });

    const misPath = '/planillas/mis-pagos';
    const mis = await request(server)
      .get(misPath)
      .set(firmar('FUNCIONARIO', 'GET', misPath))
      .expect(200);
    expect(mis.body.data).toHaveLength(1);
    expect(mis.body.data[0].empleadoId).toBe(uuid(2));

    // Un funcionario no puede leer el desglose de otro aunque conozca el id.
    await request(server)
      .get(detPath)
      .set(firmar('FUNCIONARIO', 'GET', detPath))
      .expect(403);
  });

  it('400 VALIDATION_ERROR por body, periodo, importe o campo no permitido', async () => {
    const server = app.getHttpServer();
    const post = (body: object) =>
      request(server)
        .post('/planillas')
        .set(firmar('ENCARGADO_NOMINA', 'POST', '/planillas'))
        .send(body);
    expect((await post({ periodo: '2026-13' }).expect(400)).body.code).toBe('VALIDATION_ERROR');
    await post({}).expect(400);
    await post({ periodo: '2026-10', extra: 1 }).expect(400);

    const nov = `/planillas/periodos/2026-11/novedades/${uuid(1)}`;
    const put = (body: object) =>
      request(server)
        .put(nov)
        .set(firmar('ENCARGADO_NOMINA', 'PUT', nov))
        .send(body);
    await put({ otrosIngresos: '10.555' }).expect(400);
    await put({ diasTrabajados: 31 }).expect(400);
    await put({ liquidoPagable: '1' }).expect(400);

    const lista = '/planillas?pageSize=101';
    await request(server)
      .get(lista)
      .set(firmar('ENCARGADO_NOMINA', 'GET', '/planillas'))
      .expect(400);

    const noUuid = '/planillas/no-es-uuid';
    await request(server)
      .get(noUuid)
      .set(firmar('ENCARGADO_NOMINA', 'GET', noUuid))
      .expect(400);
  });
});
