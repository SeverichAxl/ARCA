import { type INestApplication, ValidationPipe } from '@nestjs/common';
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

function firmar(rol: keyof typeof ROLES, method: string, path: string) {
  return signInternalHeaders({
    secret: SECRET,
    method,
    path,
    principal: { userId: uuid(500), rol, ...ROLES[rol] },
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
      controllers: [PlanillasController],
      providers: [
        PlanillasService,
        AuditContext,
        { provide: PLANILLA_REPOSITORY, useValue: repo },
        { provide: EMPLEADOS_NOMINA_PORT, useValue: { listarActivos: async () => empleados } },
        { provide: CLOCK, useValue: { now: () => new Date() } },
        { provide: APP_GUARD, useClass: InternalAuthGuard },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('401 sin cabeceras internas firmadas', async () => {
    await request(app.getHttpServer()).post('/planillas/periodos/2026-10/calcular').expect(401);
  });

  it('403 con firma válida pero sin planilla:calculate', async () => {
    const path = '/planillas/periodos/2026-10/calcular';
    await request(app.getHttpServer())
      .post(path)
      .set(firmar('RRHH_OPERATIVO', 'POST', path))
      .expect(403);
  });

  it('flujo completo: novedad -> calcular -> detalle -> cerrar -> autoconsulta', async () => {
    const server = app.getHttpServer();

    const novedadPath = `/planillas/periodos/2026-10/novedades/${uuid(1)}`;
    await request(server)
      .put(novedadPath)
      .set(firmar('ENCARGADO_NOMINA', 'PUT', novedadPath))
      .send({ rcIvaComputable: '1500.00', subsidios: { natalidad: '3300' } })
      .expect(200);

    const calcPath = '/planillas/periodos/2026-10/calcular';
    const calc = await request(server)
      .post(calcPath)
      .set(firmar('ENCARGADO_NOMINA', 'POST', calcPath))
      .expect(200);
    expect(calc.body.planilla.estado).toBe('BORRADOR');
    expect(calc.body.planilla.totales.totalGanado).toBe('18267.00');
    const id = calc.body.planilla.id as string;

    const detPath = `/planillas/${id}/empleados/${uuid(1)}`;
    const det = await request(server)
      .get(detPath)
      .set(firmar('ENCARGADO_NOMINA', 'GET', detPath))
      .expect(200);
    expect(det.body.subsidiosInformativos).toEqual({ natalidad: '3300.00' });

    const cerrarPath = `/planillas/${id}/cerrar`;
    await request(server)
      .post(cerrarPath)
      .set(firmar('ENCARGADO_NOMINA', 'POST', cerrarPath))
      .expect(200);
    const doble = await request(server)
      .post(cerrarPath)
      .set(firmar('ENCARGADO_NOMINA', 'POST', cerrarPath))
      .expect(409);
    expect(doble.body.code).toBe('PLAN_CERRADA');

    const borrar = await request(server)
      .delete(`/planillas/${id}`)
      .set(firmar('ENCARGADO_NOMINA', 'DELETE', `/planillas/${id}`))
      .expect(409);
    expect(borrar.body.code).toBe('PLAN_CERRADA');

    const misPath = '/planillas/mis-pagos';
    const mis = await request(server)
      .get(misPath)
      .set(firmar('FUNCIONARIO', 'GET', misPath))
      .expect(200);
    expect(mis.body.data).toHaveLength(1);
    expect(mis.body.data[0].empleado.empleadoId).toBe(uuid(2));

    // Un funcionario no puede leer el desglose de otro aunque conozca el id.
    await request(server)
      .get(detPath)
      .set(firmar('FUNCIONARIO', 'GET', detPath))
      .expect(403);
  });

  it('400 VALIDATION_ERROR por periodo, importe o campo no permitido', async () => {
    const server = app.getHttpServer();
    const malPeriodo = '/planillas/periodos/2026-13/calcular';
    const r1 = await request(server)
      .post(malPeriodo)
      .set(firmar('ENCARGADO_NOMINA', 'POST', malPeriodo))
      .expect(400);
    expect(r1.body.code).toBe('VALIDATION_ERROR');

    const nov = `/planillas/periodos/2026-11/novedades/${uuid(1)}`;
    await request(server)
      .put(nov)
      .set(firmar('ENCARGADO_NOMINA', 'PUT', nov))
      .send({ otrosIngresos: '10.555' })
      .expect(400);
    await request(server)
      .put(nov)
      .set(firmar('ENCARGADO_NOMINA', 'PUT', nov))
      .send({ diasTrabajados: 31 })
      .expect(400);
    await request(server)
      .put(nov)
      .set(firmar('ENCARGADO_NOMINA', 'PUT', nov))
      .send({ liquidoPagable: '1' })
      .expect(400);

    const noUuid = '/planillas/no-es-uuid';
    await request(server)
      .get(noUuid)
      .set(firmar('ENCARGADO_NOMINA', 'GET', noUuid))
      .expect(400);
  });
});
