import { ConfigService } from '@nestjs/config';
import { verifyInternalHeaders } from '@arca/internal-auth';
import { PersonalNoDisponibleError, type Actor } from '../../domain/planillas/planilla.models';
import { type FetchLike, HttpEmpleadosNominaAdapter } from './http-empleados-nomina.adapter';

const SECRET = 'secreto-de-prueba-32-bytes-xxxxxxxx';
const ACTOR: Actor = {
  userId: '00000000-0000-4000-8000-00000000aaaa',
  empleadoId: null,
  rol: 'ENCARGADO_NOMINA',
  permisos: ['planilla:calculate', 'personal:read', 'personal:read_salary'],
};

function config(values: Record<string, string | undefined>) {
  return new ConfigService(values);
}

function empleado(i: number, estado = 'RATIFICADO', remuneracion: string | null = '5000.00') {
  return {
    id: `00000000-0000-4000-8000-${i.toString().padStart(12, '0')}`,
    nombres: 'Ana',
    apellidos: `Rojas ${i}`,
    ci: '***4567',
    areaId: '00000000-0000-4000-8000-0000000000a1',
    cargoId: '00000000-0000-4000-8000-0000000000c1',
    fechaIngreso: '2020-01-01',
    estado,
    ...(remuneracion === null ? {} : { remuneracion }),
  };
}

function respuesta(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe('HttpEmpleadosNominaAdapter', () => {
  const cfg = config({
    PERSONAL_SERVICE_URL: 'http://ms-personal:4002/',
    INTERNAL_HMAC_KEY: SECRET,
  });

  it('pagina, firma cada petición con el actor y omite INACTIVO', async () => {
    const llamadas: Array<{ url: string; headers: Record<string, string> }> = [];
    const fetchFn: FetchLike = async (url, init) => {
      llamadas.push({ url, headers: init.headers });
      const page = Number(new URL(url).searchParams.get('page'));
      return page === 1
        ? respuesta({
            data: [empleado(1), empleado(2, 'INACTIVO')],
            meta: { page: 1, pageSize: 100, total: 3, totalPages: 2 },
          })
        : respuesta({
            data: [empleado(3, 'EN_PRUEBA')],
            meta: { page: 2, pageSize: 100, total: 3, totalPages: 2 },
          });
    };
    const adapter = new HttpEmpleadosNominaAdapter(cfg, fetchFn);
    const lista = await adapter.listarActivos(ACTOR);

    expect(lista.map((e) => e.nombreCompleto)).toEqual(['Ana Rojas 1', 'Ana Rojas 3']);
    expect(lista[0].haberBasico).toBe(500000n);
    expect(llamadas).toHaveLength(2);
    expect(llamadas[0].url).toBe('http://ms-personal:4002/employees?page=1&pageSize=100');

    // ms-personal verificará exactamente esta firma sobre GET /employees.
    const lower = Object.fromEntries(
      Object.entries(llamadas[0].headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    const verificado = verifyInternalHeaders({
      secret: SECRET,
      method: 'GET',
      path: '/employees',
      headers: lower,
    });
    expect(verificado).toMatchObject({ userId: ACTOR.userId, rol: 'ENCARGADO_NOMINA' });
  });

  it('falla de forma explícita si ms-personal no responde o responde error', async () => {
    const caido = new HttpEmpleadosNominaAdapter(cfg, async () => {
      throw new Error('ECONNREFUSED');
    });
    await expect(caido.listarActivos(ACTOR)).rejects.toBeInstanceOf(PersonalNoDisponibleError);
    const error500 = new HttpEmpleadosNominaAdapter(cfg, async () => respuesta({}, 500));
    await expect(error500.listarActivos(ACTOR)).rejects.toBeInstanceOf(PersonalNoDisponibleError);
    const fueraContrato = new HttpEmpleadosNominaAdapter(cfg, async () => respuesta({ items: [] }));
    await expect(fueraContrato.listarActivos(ACTOR)).rejects.toBeInstanceOf(
      PersonalNoDisponibleError,
    );
  });

  it('exige remuneración (personal:read_salary) y configuración', async () => {
    const sinSueldo = new HttpEmpleadosNominaAdapter(cfg, async () =>
      respuesta({
        data: [empleado(1, 'RATIFICADO', null)],
        meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      }),
    );
    await expect(sinSueldo.listarActivos(ACTOR)).rejects.toBeInstanceOf(PersonalNoDisponibleError);

    const fetchFn = jest.fn();
    const sinPermiso = new HttpEmpleadosNominaAdapter(cfg, fetchFn);
    await expect(
      sinPermiso.listarActivos({ ...ACTOR, permisos: ['planilla:calculate', 'personal:read'] }),
    ).rejects.toBeInstanceOf(PersonalNoDisponibleError);
    expect(fetchFn).not.toHaveBeenCalled();

    const sinConfig = new HttpEmpleadosNominaAdapter(config({}), fetchFn);
    await expect(sinConfig.listarActivos(ACTOR)).rejects.toBeInstanceOf(PersonalNoDisponibleError);
  });
});
