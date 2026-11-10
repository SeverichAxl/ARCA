import { readJson } from '@/lib/api/api-error';
import { isDomainMocked } from '@/lib/api/mock-status';
import * as contratosMock from '@/lib/api/mocks/contratos.mock';
import { personalApi } from '@/lib/personal-api';
import type {
  ActualizarPlantillaInput,
  CrearPlantillaInput,
  PageResult,
  Plantilla,
  PlantillaCreada,
  PlantillaListFilters,
  PlantillaResumen,
  PreviewContrato,
  PreviewPlantillaInput,
  PreviewSubject,
} from './types';

/** Misma firma que `useAuth().request`: ruta sin `/api` y sesión ya adjunta. */
export type Requester = (path: string, options?: RequestInit) => Promise<Response>;

function buildPlantillasQuery(filters: PlantillaListFilters): string {
  const params = new URLSearchParams();
  if (filters.page !== undefined) params.set('page', String(filters.page));
  if (filters.pageSize !== undefined) params.set('pageSize', String(filters.pageSize));
  if (filters.activa !== undefined) params.set('activa', String(filters.activa));
  const query = filters.q?.trim();
  if (query) params.set('q', query);
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export const contratosApi = {
  /**
   * Lista paginada real. El mock de contratos solo se activa si se incluye
   * `contratos` en `NEXT_PUBLIC_API_MOCKS`.
   */
  async listPlantillas(
    request: Requester,
    filters: PlantillaListFilters = {},
  ): Promise<PageResult<PlantillaResumen>> {
    if (isDomainMocked('contratos')) return contratosMock.listPlantillas(filters);

    return readJson<PageResult<PlantillaResumen>>(
      await request(`/contratos/plantillas${buildPlantillasQuery(filters)}`),
    );
  },

  async getPlantilla(request: Requester, id: string): Promise<Plantilla> {
    if (isDomainMocked('contratos')) return contratosMock.getPlantilla(id);

    return readJson<Plantilla>(
      await request(`/contratos/plantillas/${encodeURIComponent(id)}`),
    );
  },

  async createPlantilla(
    request: Requester,
    input: CrearPlantillaInput,
  ): Promise<PlantillaCreada> {
    if (isDomainMocked('contratos')) return contratosMock.createPlantilla(input);

    return readJson<PlantillaCreada>(
      await request('/contratos/plantillas', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  },

  async updatePlantilla(
    request: Requester,
    id: string,
    input: ActualizarPlantillaInput,
  ): Promise<Plantilla> {
    if (isDomainMocked('contratos')) {
      return contratosMock.updatePlantilla(id, input);
    }

    return readJson<Plantilla>(
      await request(`/contratos/plantillas/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    );
  },

  /**
   * El contrato no publica DELETE ni endpoint de archivo: se archiva con
   * `PATCH activa=false`, conservando versiones históricas.
   */
  async archivePlantilla(request: Requester, id: string): Promise<Plantilla> {
    return this.updatePlantilla(request, id, { activa: false });
  },

  async reactivatePlantilla(request: Requester, id: string): Promise<Plantilla> {
    return this.updatePlantilla(request, id, { activa: true });
  },

  /**
   * No existe endpoint de duplicado en el contrato. Se compone con GET + POST,
   * que son operaciones permitidas y dejan una plantilla nueva versionada.
   */
  async duplicatePlantilla(request: Requester, id: string): Promise<PlantillaCreada> {
    if (isDomainMocked('contratos')) return contratosMock.duplicatePlantilla(id);

    const source = await this.getPlantilla(request, id);
    return this.createPlantilla(request, {
      nombre: `${source.nombre} (copia)`,
      descripcion: source.descripcion ?? undefined,
      contenidoHtml: source.contenidoHtml,
      activa: true,
    });
  },

  /**
   * Vista previa efímera real de una plantilla guardada.
   *
   * `POST /api/contratos/preview` requiere `contrato:generate` y solo acepta
   * `{ plantillaId, empleadoId }`; el backend resuelve los datos del funcionario
   * y no persiste nada. El `signal` permite cancelar peticiones anteriores.
   */
  async previewPlantilla(
    request: Requester,
    input: PreviewPlantillaInput,
    options?: RequestInit,
  ): Promise<PreviewContrato> {
    if (isDomainMocked('contratos')) {
      const [plantilla, employee] = await Promise.all([
        contratosMock.getPlantilla(input.plantillaId),
        personalApi.getEmployee(request, input.empleadoId),
      ]);
      const rawSalary = employee.remuneracion as unknown;
      const salary =
        typeof rawSalary === 'number'
          ? rawSalary
          : typeof rawSalary === 'string' && rawSalary.trim()
            ? Number(rawSalary)
            : undefined;

      return contratosMock.buildPreview(plantilla, {
        id: employee.id,
        nombreCompleto: `${employee.nombres} ${employee.apellidos}`.trim(),
        ci: employee.ci,
        ...(employee.cargo?.nombre ? { cargo: employee.cargo.nombre } : {}),
        ...(typeof salary === 'number' && Number.isFinite(salary)
          ? { remuneracion: salary }
          : {}),
        fechaIngreso: employee.fechaIngreso,
        ...(typeof employee.diasPrueba === 'number'
          ? { diasPrueba: employee.diasPrueba }
          : {}),
      });
    }

    return readJson<PreviewContrato>(
      await request('/contratos/preview', {
        ...options,
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  },

  /**
   * Vista previa de un contrato persistido (`POST /contratos/:id/preview`).
   * Requiere `contrato:generate` o `contrato:read`.
   */
  async previewContrato(
    request: Requester,
    contratoId: string,
    options?: RequestInit,
  ): Promise<PreviewContrato> {
    return readJson<PreviewContrato>(
      await request(`/contratos/${encodeURIComponent(contratoId)}/preview`, {
        ...options,
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );
  },

  /** Solo para el mock de demostración; la UI real usa `employeesApi`. */
  listPreviewSubjects(): PreviewSubject[] {
    return contratosMock.getPreviewSubjects();
  },
};
