import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { createServer, type Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { verifyInternalHeaders } from '@arca/internal-auth';
import { InternalHeadersService } from '../src/modules/auth/internal-headers.service';
import { JwtTokenService } from '../src/modules/auth/jwt-token.service';
import { GatewayAuthorizationMiddleware } from '../src/modules/proxy/gateway-authorization.middleware';
import { ProxyService } from '../src/modules/proxy/proxy.service';
import type { AuditDeniedEvent, AuditSink } from '../src/rbac/audit-sink';
import { INTERNAL_SECRET, bearer, gatewayConfig, signToken } from './helpers';

interface CapturedRequest {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

describe('GatewayAuthorizationMiddleware end-to-end', () => {
  let destination: Server;
  let destinationUrl: string;
  let gateway: express.Express;
  let captured: CapturedRequest[];
  let auditSink: AuditSink & { record: jest.Mock<void, [AuditDeniedEvent]> };

  beforeAll(async () => {
    const destinationApp = express();
    destinationApp.use(express.json());
    destinationApp.use((req: Request, res: Response) => {
      captured.push({ method: req.method, url: req.originalUrl, headers: req.headers });
      res.status(200).json({ ok: true });
    });

    destination = createServer(destinationApp);
    await new Promise<void>((resolve) => destination.listen(0, '127.0.0.1', resolve));
    const address = destination.address() as AddressInfo;
    destinationUrl = `http://127.0.0.1:${address.port}`;

    const config = gatewayConfig({
      AUTH_SERVICE_URL: destinationUrl,
      PERSONAL_SERVICE_URL: destinationUrl,
      VACACIONES_SERVICE_URL: destinationUrl,
      CONTRATOS_SERVICE_URL: destinationUrl,
      PLANILLAS_SERVICE_URL: destinationUrl,
    });
    const jwtTokenService = new JwtTokenService(config);
    const internalHeadersService = new InternalHeadersService(config);

    auditSink = { record: jest.fn() };

    const middleware = new GatewayAuthorizationMiddleware(
      config,
      jwtTokenService,
      internalHeadersService,
      auditSink,
      new ProxyService(),
    );

    gateway = express();
    gateway.use(express.json());
    gateway.use((req: Request, res: Response, next: NextFunction) =>
      middleware.use(req, res, next),
    );
    gateway.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok' });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      destination.close((error) => (error ? reject(error) : resolve())),
    );
  });

  beforeEach(() => {
    captured = [];
    auditSink.record.mockClear();
  });

  it('permite /health sin token y sin pasar por el proxy', async () => {
    const response = await request(gateway).get('/health');

    expect(response.status).toBe(200);
    expect(captured).toHaveLength(0);
  });

  it('permite login público, elimina Authorization y cabeceras X-* del cliente', async () => {
    const response = await request(gateway)
      .post('/api/auth/login')
      .set('Authorization', 'Bearer token-falso')
      .set('X-User-Id', 'atacante')
      .set('X-Permisos', 'auditoria:read')
      .set('X-Internal-Signature', 'falsa')
      .send({ username: 'admin', password: 'secreto' });

    expect(response.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0].method).toBe('POST');
    expect(captured[0].url).toBe('/auth/login');
    expect(captured[0].headers.authorization).toBeUndefined();
    expect(captured[0].headers['x-user-id']).toBeUndefined();
    expect(captured[0].headers['x-permisos']).toBeUndefined();
    expect(captured[0].headers['x-internal-signature']).toBeUndefined();
  });

  it('sin token devuelve 401 y no llega al proxy', async () => {
    const response = await request(gateway).get('/api/personal/employees');

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_TOKEN_INVALID');
    expect(response.body.traceId).toEqual(expect.any(String));
    expect(captured).toHaveLength(0);
    expect(auditSink.record).toHaveBeenCalledTimes(1);
  });

  it('token vencido devuelve AUTH_TOKEN_EXPIRED', async () => {
    const token = signToken({}, { expiresIn: -120 });
    const response = await request(gateway)
      .get('/api/personal/employees')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_TOKEN_EXPIRED');
    expect(captured).toHaveLength(0);
  });

  it('firma cabeceras, reescribe /api/personal y no reenvía Authorization', async () => {
    const token = signToken({ permisos: ['personal:read'] });

    const response = await request(gateway)
      .get('/api/personal/employees/abc-123')
      .set('Authorization', bearer(token))
      .set('X-User-Id', 'atacante')
      .set('X-Rol', 'ADMIN_GENERAL')
      .set('X-Permisos', 'auditoria:read')
      .set('X-Timestamp', '1')
      .set('X-Internal-Signature', 'falsa');

    expect(response.status).toBe(200);
    expect(captured).toHaveLength(1);
    expect(captured[0].url).toBe('/employees/abc-123');
    expect(captured[0].headers.authorization).toBeUndefined();
    expect(captured[0].headers['x-user-id']).toBe(
      '11111111-1111-4111-8111-111111111111',
    );
    expect(captured[0].headers['x-empleado-id']).toBe(
      '22222222-2222-4222-8222-222222222222',
    );
    expect(captured[0].headers['x-rol']).toBe('FUNCIONARIO');

    const verified = verifyInternalHeaders({
      secret: INTERNAL_SECRET,
      method: captured[0].method,
      path: captured[0].url,
      headers: captured[0].headers,
    });

    expect(verified.permisos).toEqual(['personal:read']);
  });

  it('conserva la query al hacer proxy y firma solo la ruta', async () => {
    const token = signToken({ permisos: ['vacaciones:read_own'] });

    const response = await request(gateway)
      .get('/api/vacaciones/saldo?empleadoId=abc')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(200);
    expect(captured[0].url).toBe('/vacaciones/saldo?empleadoId=abc');

    expect(
      verifyInternalHeaders({
        secret: INTERNAL_SECRET,
        method: 'GET',
        path: '/vacaciones/saldo',
        headers: captured[0].headers,
      }).userId,
    ).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('token válido sin permiso devuelve 403 y no llega al proxy', async () => {
    const token = signToken({ permisos: ['vacaciones:read_own'] });
    const response = await request(gateway)
      .get('/api/personal/employees')
      .set('Authorization', bearer(token));

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(captured).toHaveLength(0);
    expect(auditSink.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: '11111111-1111-4111-8111-111111111111' }),
    );
  });

  it('ruta no declarada: 401 sin token y 403 con token válido', async () => {
    const withoutToken = await request(gateway).get('/api/personal/no-declarada');
    expect(withoutToken.status).toBe(401);

    const withToken = await request(gateway)
      .get('/api/personal/no-declarada')
      .set('Authorization', bearer(signToken()));

    expect(withToken.status).toBe(403);
    expect(withToken.body.code).toBe('FORBIDDEN');
    expect(captured).toHaveLength(0);
  });

  it('rutas fuera de /api devuelven 404', async () => {
    const response = await request(gateway).get('/otra/ruta');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
    expect(captured).toHaveLength(0);
  });

  it('rechaza ataques de ruta con 400 antes de tocar el proxy', async () => {
    for (const path of [
      '/api/personal/../auth/login',
      '/api/personal//employees',
      '/api/personal/%2e%2e/auth/login',
      '/api/%2fpersonal/employees',
    ]) {
      const response = await request(gateway).get(path);

      expect({ path, status: response.status }).toEqual({ path, status: 400 });
      expect(response.body.code).toBe('VALIDATION_ERROR');
    }

    expect(captured).toHaveLength(0);
  });

  it('ignora X-HTTP-Method-Override y decide con el método real', async () => {
    const token = signToken({ permisos: ['usuario:read'] });
    const response = await request(gateway)
      .get('/api/auth/usuarios')
      .set('Authorization', bearer(token))
      .set('X-HTTP-Method-Override', 'DELETE');

    expect(response.status).toBe(200);
    expect(captured[0].method).toBe('GET');
    expect(captured[0].headers['x-http-method-override']).toBeUndefined();
  });

  it('mantiene el proxy inalcanzable para toda decisión denegada', async () => {
    const requests = [
      request(gateway).get('/api/personal/employees'),
      request(gateway)
        .get('/api/personal/employees')
        .set('Authorization', bearer(signToken({ permisos: [] }))),
      request(gateway)
        .get('/api/personal/no-declarada')
        .set('Authorization', bearer(signToken())),
      request(gateway).get('/api/personal/%2e%2e/employees'),
    ];

    for (const pending of requests) {
      const response = await pending;
      expect(response.status).toBeGreaterThanOrEqual(400);
    }

    expect(captured).toHaveLength(0);
  });
});
