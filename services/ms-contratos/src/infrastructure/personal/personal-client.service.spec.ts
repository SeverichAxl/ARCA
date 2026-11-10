import { BadGatewayException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InternalPrincipal } from '@arca/internal-auth';
import { PersonalClientService } from './personal-client.service';

const empleadoId = '22222222-2222-4222-8222-222222222222';

const principal: InternalPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  empleadoId: null,
  rol: 'RRHH_OPERATIVO',
  permisos: ['contrato:generate', 'personal:read_salary'],
};

function response(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('PersonalClientService', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  let service: PersonalClientService;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new PersonalClientService(
      new ConfigService({
        PERSONAL_SERVICE_URL: 'http://ms-personal:4002',
        INTERNAL_HMAC_KEY: 'test-internal-hmac-key',
      }),
    );
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('consulta la interfaz autorizada con cabeceras firmadas y mapea los campos', async () => {
    fetchMock.mockResolvedValue(
      response(200, {
        empleadoId,
        nombre_empleado: 'Ana Rojas',
        ci: '12345678',
        cargo: 'Analista',
        remuneracion: '6000.00',
        fecha_ingreso: '2026-01-01',
        duracion_prueba: '90 días',
      }),
    );

    const result = await service.getDatosContrato(empleadoId, principal);

    expect(result).toEqual({
      empleadoId,
      nombreEmpleado: 'Ana Rojas',
      ci: '12345678',
      cargo: 'Analista',
      remuneracion: '6000.00',
      fechaIngreso: '2026-01-01',
      duracionPrueba: '90 días',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      `http://ms-personal:4002/employees/${empleadoId}/datos-contrato`,
    );
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-User-Id']).toBe(principal.userId);
    expect(headers['X-Permisos']).toBe('contrato:generate,personal:read_salary');
    expect(headers['X-Internal-Signature']).toMatch(/^[a-f0-9]{64}$/);
  });

  it('tolera nombres separados, días de prueba numéricos y ausencia de remuneración', async () => {
    fetchMock.mockResolvedValue(
      response(200, {
        id: empleadoId,
        nombres: 'Ana',
        apellidos: 'Rojas',
        ci: '12345678',
        cargoNombre: 'Analista',
        fechaIngreso: '2026-01-01',
        diasPrueba: 90,
      }),
    );

    const result = await service.getDatosContrato(empleadoId, principal);

    expect(result).toEqual({
      empleadoId,
      nombreEmpleado: 'Ana Rojas',
      ci: '12345678',
      cargo: 'Analista',
      fechaIngreso: '2026-01-01',
      duracionPrueba: '90 días',
    });
    expect(result).not.toHaveProperty('remuneracion');
  });

  it('mapea 404 y 403 a errores de dominio sin filtrar el cuerpo remoto', async () => {
    fetchMock.mockResolvedValueOnce(response(404, { code: 'NOT_FOUND' }));
    await expect(service.getDatosContrato(empleadoId, principal)).rejects.toBeInstanceOf(
      NotFoundException,
    );

    fetchMock.mockResolvedValueOnce(response(403, { code: 'FORBIDDEN' }));
    await expect(service.getDatosContrato(empleadoId, principal)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rechaza una respuesta incompleta como CONTR_DATOS_INCOMPLETOS', async () => {
    fetchMock.mockResolvedValue(
      response(200, {
        nombre_empleado: 'Ana Rojas',
        ci: '12345678',
      }),
    );

    await expect(
      service.getDatosContrato(empleadoId, principal),
    ).rejects.toMatchObject({
      response: {
        code: 'CONTR_DATOS_INCOMPLETOS',
        details: { fields: ['cargo', 'fecha_ingreso', 'duracion_prueba'] },
      },
    });
  });

  it('convierte una caída de red en CONTR_PERSONAL_UNAVAILABLE', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));

    await expect(
      service.getDatosContrato(empleadoId, principal),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
