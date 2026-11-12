import { ApiError, readJson, responseToApiError } from '@/lib/api/api-error';
import { isDomainMocked } from '@/lib/api/mock-status';
import * as contratosMock from '@/lib/api/mocks/contratos.mock';
import { personalApi } from '@/lib/personal-api';
import type {
  ActualizarPlantillaInput,
  ContratoCreado,
  ContratoEmpleadoItem,
  ContratosEmpleadoResult,
  CrearContratoInput,
  CrearPlantillaInput,
  DescargaContrato,
  DocumentoGenerado,
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

function downloadUnavailable(): ApiError {
  return new ApiError({
    statusCode: 502,
    code: 'CONTRATO_NO_DISPONIBLE',
    message: 'El contrato no está disponible para descarga.',
    traceId: 'sin-trace-id',
  });
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
   * Contratos y versiones de un empleado.
   *
   * `GET /api/contratos/empleado/:empleadoId` requiere `contrato:read` o
   * `contrato:download_own`. El servicio acota `download_own` al propio
   * empleado y responde 404 si no hay contratos o si el empleado es ajeno.
   */
  async listContratosEmpleado(
    request: Requester,
    empleadoId: string,
    options?: RequestInit,
  ): Promise<ContratosEmpleadoResult> {
    if (isDomainMocked('contratos')) {
      return contratosMock.listContratosEmpleado(empleadoId);
    }

    return readJson<ContratosEmpleadoResult>(
      await request(`/contratos/empleado/${encodeURIComponent(empleadoId)}`, options),
    );
  },

  /** Persiste un contrato en estado BORRADOR. Requiere `contrato:generate`. */
  async createContrato(
    request: Requester,
    input: CrearContratoInput,
  ): Promise<ContratoCreado> {
    if (isDomainMocked('contratos')) return contratosMock.createContrato(input);

    return readJson<ContratoCreado>(
      await request('/contratos', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    );
  },

  /** Crea una versión PDF del contrato ya registrado. Requiere `contrato:generate`. */
  async generarPdf(request: Requester, contratoId: string): Promise<DocumentoGenerado> {
    if (isDomainMocked('contratos')) {
      return contratosMock.generarPdf(contratoId);
    }

    const body = new FormData();
    body.append('datos', JSON.stringify({ incluirFirmas: true }));
    return readJson<DocumentoGenerado>(
      await request(`/contratos/${encodeURIComponent(contratoId)}/pdf`, {
        method: 'POST',
        body,
      }),
    );
  },

  /**
   * Descarga la última versión (`GET /contratos/:id/pdf`) o una versión
   * concreta (`GET /contratos/:id/versiones/:versionId/descarga`).
   *
   * Ambas respuestas son JSON `{ url, expiresInSeconds, versionId }` con una
   * URL firmada de vida corta. La URL se consume con `credentials: 'omit'` y
   * nunca se guarda ni se registra. Si el backend respondiera el PDF directo,
   * también se soporta.
   */
  async descargarContrato(
    request: Requester,
    contratoId: string,
    versionId?: string,
  ): Promise<Response> {
    if (isDomainMocked('contratos')) {
      return contratosMock.descargarContrato(contratoId, versionId);
    }

    const path = versionId
      ? `/contratos/${encodeURIComponent(contratoId)}/versiones/${encodeURIComponent(versionId)}/descarga`
      : `/contratos/${encodeURIComponent(contratoId)}/pdf`;
    const response = await request(path);
    if (!response.ok) throw await responseToApiError(response);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return response;

    const payload = (await response.json()) as DescargaContrato;
    if (!payload?.url) throw downloadUnavailable();

    const pdfResponse = await fetch(payload.url, { credentials: 'omit' });
    if (!pdfResponse.ok) throw await responseToApiError(pdfResponse);
    return pdfResponse;
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
