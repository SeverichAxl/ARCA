type JsonRecord = Record<string, unknown>;

interface ApiOptions {
  token?: string;
  method?: string;
  body?: JsonRecord | FormData;
}

interface DemoUser {
  id: string;
  username: string;
  estado: string;
  empleadoId: string | null;
  rol: { id: string; codigo: string };
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const BASE_URL =
  process.env.DEMO_GATEWAY_URL ?? `http://127.0.0.1:${process.env.GATEWAY_PORT ?? '4000'}`;
const DEMO_PASSWORD = process.env.DEMO_USERS_PASSWORD;
const EMPLOYEE_CI = process.env.DEMO_EMPLOYEE_CI ?? '99000001';
const MANAGER_CI = process.env.DEMO_MANAGER_CI ?? '99000002';
const HR_CI = process.env.DEMO_RRHH_CI ?? '99000003';
const EMPLOYEE_START_DATE = '2024-01-15';
const VACATION_EXCEPTION_JUSTIFICATION =
  'TSK-BACK-313: solicitud sintética para demostrar el flujo de excepción.';

const DEMO_ACCOUNTS = [
  {
    username: process.env.DEMO_RRHH_USERNAME ?? 'demo.rrhh',
    email: 'demo.rrhh@arca.local',
    role: 'RRHH_OPERATIVO',
  },
  {
    username: process.env.DEMO_NOMINA_USERNAME ?? 'demo.nomina',
    email: 'demo.nomina@arca.local',
    role: 'ENCARGADO_NOMINA',
  },
  {
    username: process.env.DEMO_JEFE_USERNAME ?? 'demo.jefe',
    email: 'demo.jefe@arca.local',
    role: 'JEFE_AREA',
  },
  {
    username: process.env.DEMO_FUNCIONARIO_USERNAME ?? 'demo.funcionario',
    email: 'demo.funcionario@arca.local',
    role: 'FUNCIONARIO',
  },
] as const;

const SAMPLE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);

function record(value: unknown, label: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Respuesta inválida del API: se esperaba ${label}.`);
  }
  return value as JsonRecord;
}

function records(value: unknown, label: string): JsonRecord[] {
  if (!Array.isArray(value)) {
    throw new Error(`Respuesta inválida del API: se esperaba una lista de ${label}.`);
  }
  return value.map((item) => record(item, label));
}

function dataRows(value: unknown, label: string): JsonRecord[] {
  if (Array.isArray(value)) return records(value, label);
  return records(record(value, `página de ${label}`).data, label);
}

function fieldString(value: JsonRecord, key: string, label = key): string {
  const field = value[key];
  if (typeof field !== 'string' || field.length === 0) {
    throw new Error(`Respuesta inválida del API: falta ${label}.`);
  }
  return field;
}

function roleCode(user: JsonRecord): string | undefined {
  const role = user.rol;
  if (typeof role !== 'object' || role === null || Array.isArray(role)) return undefined;
  const codigo = (role as JsonRecord).codigo;
  return typeof codigo === 'string' ? codigo : undefined;
}

function apiErrorDetails(value: unknown): { code?: string; message: string } {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const body = value as JsonRecord;
    return {
      code: typeof body.code === 'string' ? body.code : undefined,
      message: typeof body.message === 'string' ? body.message : JSON.stringify(body),
    };
  }
  return { message: typeof value === 'string' ? value : JSON.stringify(value) };
}

async function api<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' });
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  let body: FormData | string | undefined;
  if (options.body instanceof FormData) {
    body = options.body;
  } else if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(new URL(path, BASE_URL), {
      method: options.method ?? 'GET',
      headers,
      body,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error de red desconocido';
    throw new Error(`No se pudo contactar el API Gateway (${BASE_URL}): ${message}`);
  }

  const text = await response.text();
  let payload: unknown;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const details = apiErrorDetails(payload);
    throw new ApiError(
      `${options.method ?? 'GET'} ${path} respondió ${response.status}` +
        `${details.code ? ` (${details.code})` : ''}: ${details.message}` +
        `\nRespuesta completa: ${text}`,
      response.status,
      details.code,
    );
  }
  return payload as T;
}

async function apiOrNotFound<T>(path: string, options: ApiOptions = {}): Promise<T | null> {
  try {
    return await api<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function requireEnvironment(): string {
  if (!process.env.SEED_ADMIN_USERNAME || !process.env.SEED_ADMIN_PASSWORD) {
    throw new Error('Configura SEED_ADMIN_USERNAME y SEED_ADMIN_PASSWORD en .env.');
  }
  if (!DEMO_PASSWORD) {
    throw new Error('Configura DEMO_USERS_PASSWORD en .env.');
  }
  if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,200}$/.test(DEMO_PASSWORD)) {
    throw new Error(
      'DEMO_USERS_PASSWORD debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo.',
    );
  }
  return DEMO_PASSWORD;
}

async function login(username: string, password: string): Promise<string> {
  const session = record(
    await api('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    }),
    'sesión de autenticación',
  );
  return fieldString(session, 'accessToken', 'accessToken JWT');
}

async function listUsers(token: string, username: string): Promise<JsonRecord[]> {
  const query = new URLSearchParams({ q: username, page: '1', pageSize: '20' });
  const result = await api(`/api/auth/usuarios?${query}`, { token });
  return dataRows(result, 'usuarios').filter((user) => user.username === username);
}

async function ensureUser(
  adminToken: string,
  roleIds: Map<string, string>,
  account: (typeof DEMO_ACCOUNTS)[number],
  demoPassword: string,
): Promise<DemoUser> {
  const rolId = roleIds.get(account.role);
  if (!rolId) throw new Error(`El rol ${account.role} no existe en el seed de ms-auth.`);

  let existing = (await listUsers(adminToken, account.username))[0];
  if (!existing) {
    try {
      existing = record(
        await api('/api/auth/usuarios', {
          token: adminToken,
          method: 'POST',
          body: {
            username: account.username,
            email: account.email,
            password: demoPassword,
            rolId,
          },
        }),
        `usuario ${account.username}`,
      );
      console.log(`Usuario ${account.username} (${account.role}) creado.`);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
      existing = (await listUsers(adminToken, account.username))[0];
      if (!existing) throw error;
    }
  }

  const userId = fieldString(existing, 'id', `id de ${account.username}`);
  if (roleCode(existing) !== account.role) {
    existing = record(
      await api(`/api/auth/usuarios/${userId}/rol`, {
        token: adminToken,
        method: 'PUT',
        body: { rolId },
      }),
      `rol de ${account.username}`,
    );
  }
  if (existing.estado !== 'ACTIVO') {
    existing = record(
      await api(`/api/auth/usuarios/${userId}/estado`, {
        token: adminToken,
        method: 'PATCH',
        body: { estado: 'ACTIVO' },
      }),
      `estado de ${account.username}`,
    );
  }

  const linkedEmployeeId = typeof existing.empleadoId === 'string' ? existing.empleadoId : null;
  return {
    id: userId,
    username: account.username,
    estado: typeof existing.estado === 'string' ? existing.estado : 'ACTIVO',
    empleadoId: linkedEmployeeId,
    rol: { id: rolId, codigo: account.role },
  };
}

async function linkUserToEmployee(
  adminToken: string,
  user: DemoUser,
  empleadoId: string,
): Promise<void> {
  if (user.empleadoId === empleadoId) return;
  if (user.empleadoId !== null) {
    throw new Error(
      `El usuario ${user.username} ya está vinculado al empleado ${user.empleadoId}, no a ${empleadoId}.`,
    );
  }
  await api(`/api/auth/usuarios/${user.id}/empleado`, {
    token: adminToken,
    method: 'PUT',
    body: { empleadoId },
  });
}

async function catalogItem(
  token: string,
  route: 'areas' | 'cargos',
  name: string,
): Promise<JsonRecord> {
  const query = new URLSearchParams({ page: '1', pageSize: '100' });
  const result = await api(`/api/personal/${route}?${query}`, { token });
  const item = dataRows(result, route).find((candidate) => candidate.nombre === name);
  if (!item) {
    throw new Error(`No existe el catálogo base ${route}: "${name}". Ejecuta demo:reset.`);
  }
  return item;
}

function signatureFile(): Blob {
  return new Blob([Uint8Array.from(SAMPLE_PNG)], { type: 'image/png' });
}

async function findEmployee(token: string, ci: string): Promise<JsonRecord | undefined> {
  const query = new URLSearchParams({ ci, page: '1', pageSize: '10' });
  const result = await api(`/api/personal/employees?${query}`, { token });
  return dataRows(result, 'empleados')[0];
}

async function ensureEmployee(
  hrToken: string,
  data: {
    nombres: string;
    apellidos: string;
    ci: string;
    areaId: string;
    cargoId: string;
    remuneracion: string;
    email: string;
  },
): Promise<JsonRecord> {
  let employee = await findEmployee(hrToken, data.ci);
  if (!employee) {
    const form = new FormData();
    form.append(
      'datos',
      JSON.stringify({
        ...data,
        fechaIngreso: EMPLOYEE_START_DATE,
        ciExpedido: 'LP',
        fechaNacimiento: '1990-05-20',
        telefono: '70000000',
        direccion: 'Registro sintético para demostración',
        diasPrueba: 90,
      }),
    );
    form.append('firma', signatureFile(), 'firma-demo.png');
    try {
      employee = record(
        await api('/api/personal/employees', {
          token: hrToken,
          method: 'POST',
          body: form,
        }),
        `empleado ${data.ci}`,
      );
      console.log(`Empleado ${data.nombres} ${data.apellidos} creado.`);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
      employee = await findEmployee(hrToken, data.ci);
      if (!employee) throw error;
    }
  }

  const employeeId = fieldString(employee, 'id', `id del empleado ${data.ci}`);
  const detail = record(
    await api(`/api/personal/employees/${employeeId}`, { token: hrToken }),
    `ficha del empleado ${data.ci}`,
  );
  if (detail.areaId !== data.areaId || detail.cargoId !== data.cargoId) {
    throw new Error(
      `El empleado demo ${data.ci} ya existe con un área o cargo distinto; revisa los datos antes de continuar.`,
    );
  }
  if (detail.estado === 'EN_PRUEBA') {
    await api(`/api/personal/employees/${employeeId}/ratificar`, {
      token: hrToken,
      method: 'POST',
      body: {
        fechaRatificacion: localDateOnly(),
        motivo: 'Cumplió satisfactoriamente el periodo de prueba.',
      },
    });
  } else if (detail.estado !== 'RATIFICADO') {
    throw new Error(
      `El empleado demo ${data.ci} tiene estado no admitido: ${String(detail.estado)}.`,
    );
  }
  return { ...detail, id: employeeId, estado: 'RATIFICADO' };
}

async function ensureAreaManager(
  hrToken: string,
  areaId: string,
  managerId: string,
): Promise<void> {
  const area = record(await api(`/api/personal/areas/${areaId}`, { token: hrToken }), 'área demo');
  if (area.jefeId === managerId) return;
  await api(`/api/personal/areas/${areaId}`, {
    token: hrToken,
    method: 'PATCH',
    body: { jefeId: managerId },
  });
}

function addDays(date: Date, count: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + count);
  return result;
}

function isWeekday(date: Date): boolean {
  const weekday = date.getUTCDay();
  return weekday !== 0 && weekday !== 6;
}

function nextWeekday(date: Date): Date {
  let result = new Date(date);
  while (!isWeekday(result)) result = addDays(result, 1);
  return result;
}

function addBusinessDays(start: Date, additionalDays: number): Date {
  let result = new Date(start);
  let counted = 0;
  while (counted < additionalDays) {
    result = addDays(result, 1);
    if (isWeekday(result)) counted += 1;
  }
  return result;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function localDateOnly(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function vacationWindows(): {
  regular: { fechaInicio: string; fechaFin: string };
  exception: { fechaInicio: string; fechaFin: string };
} {
  const today = new Date();
  const regularStart = nextWeekday(addDays(today, 10));
  const regularEnd = addBusinessDays(regularStart, 2);
  const exceptionStart = nextWeekday(addDays(regularEnd, 20));
  const exceptionEnd = addBusinessDays(exceptionStart, 39);
  return {
    regular: { fechaInicio: dateOnly(regularStart), fechaFin: dateOnly(regularEnd) },
    exception: { fechaInicio: dateOnly(exceptionStart), fechaFin: dateOnly(exceptionEnd) },
  };
}

async function listOwnVacationRequests(token: string): Promise<JsonRecord[]> {
  const query = new URLSearchParams({ vista: 'propias', pagina: '1', limite: '100' });
  const result = await api(`/api/vacaciones/solicitudes?${query}`, { token });
  return dataRows(result, 'solicitudes de vacaciones');
}

function requestHasException(request: JsonRecord): boolean {
  return typeof request.excepcion === 'object' && request.excepcion !== null;
}

function isTerminalFailure(request: JsonRecord): boolean {
  return request.estado === 'RECHAZADA' || request.estado === 'CANCELADA';
}

async function ensureVacationRequest(
  employeeToken: string,
  windows: { fechaInicio: string; fechaFin: string },
  exception: boolean,
): Promise<JsonRecord> {
  const matches = async (): Promise<JsonRecord | undefined> => {
    const requests = await listOwnVacationRequests(employeeToken);
    const byRange = requests.find(
      (request) =>
        typeof request.fechaInicio === 'string' &&
        typeof request.fechaFin === 'string' &&
        request.fechaInicio.slice(0, 10) === windows.fechaInicio &&
        request.fechaFin.slice(0, 10) === windows.fechaFin,
    );
    if (byRange) return byRange;
    if (exception) {
      return requests.find((request) => {
        if (!requestHasException(request)) return false;
        const detail = request.excepcion as JsonRecord;
        return detail.justificacion === VACATION_EXCEPTION_JUSTIFICATION;
      });
    }
    return requests.find((request) => !requestHasException(request));
  };

  let existing = await matches();
  if (existing) {
    if (isTerminalFailure(existing)) {
      throw new Error(
        `La solicitud demo ${fieldString(existing, 'id')} está ${String(existing.estado)}; ejecuta demo:reset para recrear el escenario.`,
      );
    }
    return existing;
  }

  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const created = record(
        await api('/api/vacaciones/solicitudes', {
          token: employeeToken,
          method: 'POST',
          body: exception
            ? {
                ...windows,
                solicitarExcepcion: true,
                justificacionExcepcion: VACATION_EXCEPTION_JUSTIFICATION,
              }
            : windows,
        }),
        'solicitud de vacaciones creada',
      );
      if (exception && !requestHasException(created)) {
        throw new Error(
          'La solicitud larga no produjo una excepción; verifica el saldo base de vacaciones.',
        );
      }
      return created;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VAC_JEFE_NO_ASIGNADO') {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        continue;
      }
      if (error instanceof ApiError && error.status === 409) {
        existing = await matches();
        if (existing) return existing;
      }
      throw error;
    }
  }
  throw new Error('El evento de asignación de jefatura no llegó a ms-vacaciones tras 30 segundos.');
}

async function waitForVacationBalance(employeeToken: string): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const balance = record(
        await api('/api/vacaciones/saldo', { token: employeeToken }),
        'saldo de vacaciones',
      );
      if (balance.elegible === true) {
        console.log('Saldo de vacaciones elegible y sincronizado.');
        return;
      }
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 404) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error('ms-vacaciones no sincronizó el empleado ratificado dentro de 30 segundos.');
}

async function approveVacation(
  employeeToken: string,
  managerToken: string,
  hrToken: string,
  request: JsonRecord,
  mustResolveException: boolean,
): Promise<void> {
  const requestId = fieldString(request, 'id', 'id de la solicitud demo');
  let detail = record(
    await api(`/api/vacaciones/solicitudes/${requestId}`, { token: employeeToken }),
    'detalle de solicitud de vacaciones',
  );

  if (mustResolveException) {
    const exception = record(detail.excepcion, 'excepción de vacaciones');
    const exceptionId = fieldString(exception, 'id', 'id de excepción');
    if (exception.estado === 'PENDIENTE') {
      await api(`/api/vacaciones/excepciones/${exceptionId}/resolver`, {
        token: hrToken,
        method: 'POST',
        body: {
          decision: 'APROBADA',
          comentario: 'Aprobación de excepción para la demostración.',
        },
      });
    } else if (exception.estado !== 'APROBADA') {
      throw new Error(`La excepción demo está en estado ${String(exception.estado)}.`);
    }
    detail = record(
      await api(`/api/vacaciones/solicitudes/${requestId}`, { token: employeeToken }),
      'detalle actualizado de solicitud de vacaciones',
    );
  }

  if (detail.estado === 'PENDIENTE_JEFE') {
    await api(`/api/vacaciones/solicitudes/${requestId}/aprobar-jefe`, {
      token: managerToken,
      method: 'POST',
      body: { comentario: 'Aprobación de jefatura para la demostración.' },
    });
    detail = record(
      await api(`/api/vacaciones/solicitudes/${requestId}`, { token: employeeToken }),
      'solicitud aprobada por jefatura',
    );
  }
  if (detail.estado === 'APROBADO_JEFE') {
    await api(`/api/vacaciones/solicitudes/${requestId}/aprobar-rrhh`, {
      token: hrToken,
      method: 'POST',
      body: { comentario: 'Aprobación final de RRHH para la demostración.' },
    });
    detail = record(
      await api(`/api/vacaciones/solicitudes/${requestId}`, { token: employeeToken }),
      'solicitud aprobada por RRHH',
    );
  }
  if (detail.estado !== 'APROBADO_FINAL') {
    throw new Error(
      `La solicitud demo ${requestId} quedó en estado inesperado ${String(detail.estado)}.`,
    );
  }
}

async function ensureTemplate(hrToken: string): Promise<JsonRecord> {
  const name = 'Plantilla demo TSK-BACK-313';
  const query = new URLSearchParams({ q: name, page: '1', pageSize: '20' });
  let matches = dataRows(
    await api(`/api/contratos/plantillas?${query}`, { token: hrToken }),
    'plantillas',
  );
  let template = matches.find((item) => item.nombre === name);
  if (!template) {
    try {
      template = record(
        await api('/api/contratos/plantillas', {
          token: hrToken,
          method: 'POST',
          body: {
            nombre: name,
            descripcion: 'Plantilla sintética creada para la demostración TSK-BACK-313.',
            contenidoHtml:
              '<h1>Contrato de trabajo</h1><p>Yo {{nombre_empleado}}, CI {{ci}}, acepto el cargo de {{cargo}} con remuneración {{remuneracion}}. Fecha de ingreso: {{fecha_ingreso}}. Periodo de prueba: {{duracion_prueba}}.</p>',
            activa: true,
          },
        }),
        'plantilla de contrato',
      );
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
      matches = dataRows(
        await api(`/api/contratos/plantillas?${query}`, { token: hrToken }),
        'plantillas',
      );
      template = matches.find((item) => item.nombre === name);
      if (!template) throw error;
    }
  }
  if (!template) throw new Error('No fue posible obtener la plantilla demo.');
  if (template.activa !== true) {
    template = record(
      await api(`/api/contratos/plantillas/${fieldString(template, 'id', 'id de plantilla')}`, {
        token: hrToken,
        method: 'PATCH',
        body: { activa: true },
      }),
      'plantilla demo activa',
    );
  }
  return template;
}

async function listEmployeeContracts(hrToken: string, employeeId: string): Promise<JsonRecord[]> {
  const result = await apiOrNotFound(`/api/contratos/empleado/${employeeId}`, {
    token: hrToken,
  });
  if (result === null) return [];
  return dataRows(result, 'contratos del empleado');
}

async function ensureSignedContract(
  hrToken: string,
  employeeId: string,
  templateId: string,
): Promise<void> {
  let contracts = await listEmployeeContracts(hrToken, employeeId);
  let contract = contracts.find((item) => item.plantillaId === templateId);
  if (!contract) {
    try {
      contract = record(
        await api('/api/contratos', {
          token: hrToken,
          method: 'POST',
          body: {
            plantillaId: templateId,
            empleadoId: employeeId,
            fechaInicio: EMPLOYEE_START_DATE,
            observacion: 'Contrato sintético de demostración TSK-BACK-313.',
          },
        }),
        'contrato demo',
      );
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 409) throw error;
      contracts = await listEmployeeContracts(hrToken, employeeId);
      contract = contracts.find((item) => item.plantillaId === templateId);
      if (!contract) throw error;
    }
  }

  const contractId = fieldString(contract, 'id', 'id del contrato demo');
  const versions = Array.isArray(contract.versiones)
    ? records(contract.versiones, 'versiones del contrato')
    : [];
  const latest = versions[versions.length - 1];
  if (latest?.firmadoTrabajador === true && latest.firmadoRepresentante === true) {
    console.log('Contrato demo ya firmado; no se genera una versión duplicada.');
    return;
  }

  const form = new FormData();
  form.append('datos', JSON.stringify({ incluirFirmas: true }));
  form.append('firmaTrabajador', signatureFile(), 'firma-trabajador.png');
  form.append('firmaRepresentante', signatureFile(), 'firma-representante.png');

  if (versions.length === 0) {
    await api(`/api/contratos/${contractId}/pdf`, {
      token: hrToken,
      method: 'POST',
      body: form,
    });
  } else {
    form.delete('datos');
    await api(`/api/contratos/${contractId}/firmar`, {
      token: hrToken,
      method: 'POST',
      body: form,
    });
  }
  console.log('PDF contractual firmado generado.');
}

function payrollPeriod(offsetMonths: number): string {
  const current = new Date();
  const first = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offsetMonths, 1),
  );
  return `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function ensurePayrollDraft(payrollToken: string, employeeId: string): Promise<void> {
  const today = dateOnly(new Date());
  await api(`/api/planillas/parametros/vigentes?fecha=${today}`, { token: payrollToken });

  for (let offset = 0; offset < 12; offset += 1) {
    const period = payrollPeriod(offset);
    const existing = await apiOrNotFound(`/api/planillas/periodos/${period}`, {
      token: payrollToken,
    });
    if (existing !== null) {
      const planilla = record(existing, `planilla ${period}`);
      if (planilla.estado === 'CERRADA') continue;
      const id = fieldString(planilla, 'id', `id de planilla ${period}`);
      const detail = await apiOrNotFound(`/api/planillas/${id}/empleados/${employeeId}`, {
        token: payrollToken,
      });
      if (detail !== null) {
        console.log(`Planilla ${period} ya incluye al empleado demo.`);
        return;
      }
    }

    const calculated = record(
      await api(`/api/planillas/periodos/${period}/calcular`, {
        token: payrollToken,
        method: 'POST',
      }),
      `resultado del cálculo de planilla ${period}`,
    );
    const planilla = record(calculated.planilla, `cabecera de planilla ${period}`);
    const planillaId = fieldString(planilla, 'id', `id calculado de planilla ${period}`);
    const detail = await apiOrNotFound(`/api/planillas/${planillaId}/empleados/${employeeId}`, {
      token: payrollToken,
    });
    if (detail === null) {
      throw new Error(`La planilla ${period} se calculó, pero no incluyó al empleado demo.`);
    }
    console.log(`Borrador de planilla ${period} listo para revisión/cierre.`);
    return;
  }
  throw new Error('No se encontró un periodo abierto de nómina dentro de los últimos 12 meses.');
}

async function main(): Promise<void> {
  const demoPassword = requireEnvironment();

  const adminToken = await login(
    process.env.SEED_ADMIN_USERNAME as string,
    process.env.SEED_ADMIN_PASSWORD as string,
  );
  const roleResponse = await api('/api/auth/roles', { token: adminToken });
  const roleIds = new Map<string, string>();
  for (const role of dataRows(roleResponse, 'roles')) {
    roleIds.set(fieldString(role, 'codigo', 'código de rol'), fieldString(role, 'id', 'id de rol'));
  }

  const users = new Map<string, DemoUser>();
  for (const account of DEMO_ACCOUNTS) {
    users.set(account.role, await ensureUser(adminToken, roleIds, account, demoPassword));
  }
  const hr = users.get('RRHH_OPERATIVO');
  const payroll = users.get('ENCARGADO_NOMINA');
  const managerUser = users.get('JEFE_AREA');
  const employeeUser = users.get('FUNCIONARIO');
  if (!hr || !payroll || !managerUser || !employeeUser) {
    throw new Error('No se pudieron preparar todas las cuentas de demostración.');
  }

  const provisionToken = await login(hr.username, demoPassword);
  const area = await catalogItem(provisionToken, 'areas', 'Tecnología');
  const hrArea = await catalogItem(provisionToken, 'areas', 'Gestión Humana');
  const managerCargo = await catalogItem(provisionToken, 'cargos', 'Jefe de Área');
  const employeeCargo = await catalogItem(provisionToken, 'cargos', 'Analista');
  const areaId = fieldString(area, 'id', 'id del área Tecnología');

  const manager = await ensureEmployee(provisionToken, {
    nombres: 'Jefatura',
    apellidos: 'Demo ARCA',
    ci: MANAGER_CI,
    areaId,
    cargoId: fieldString(managerCargo, 'id', 'id del cargo Jefe de Área'),
    remuneracion: '9000.00',
    email: 'jefatura.demo@arca.local',
  });
  const employee = await ensureEmployee(provisionToken, {
    nombres: 'Funcionario',
    apellidos: 'Demo ARCA',
    ci: EMPLOYEE_CI,
    areaId,
    cargoId: fieldString(employeeCargo, 'id', 'id del cargo Analista'),
    remuneracion: '6000.00',
    email: 'funcionario.demo@arca.local',
  });
  const hrEmployee = await ensureEmployee(provisionToken, {
    nombres: 'Gestión Humana',
    apellidos: 'Demo ARCA',
    ci: HR_CI,
    areaId: fieldString(hrArea, 'id', 'id del área Gestión Humana'),
    cargoId: fieldString(employeeCargo, 'id', 'id del cargo Analista'),
    remuneracion: '8500.00',
    email: 'rrhh.demo@arca.local',
  });
  const managerId = fieldString(manager, 'id', 'id del jefe de demo');
  const employeeId = fieldString(employee, 'id', 'id del funcionario demo');

  await linkUserToEmployee(adminToken, managerUser, managerId);
  await linkUserToEmployee(adminToken, employeeUser, employeeId);
  await linkUserToEmployee(
    adminToken,
    hr,
    fieldString(hrEmployee, 'id', 'id del funcionario RRHH demo'),
  );
  await ensureAreaManager(provisionToken, areaId, managerId);

  const hrToken = await login(hr.username, demoPassword);
  const managerToken = await login(managerUser.username, demoPassword);
  const employeeToken = await login(employeeUser.username, demoPassword);
  const payrollToken = await login(payroll.username, demoPassword);

  await waitForVacationBalance(employeeToken);
  const windows = vacationWindows();
  const regularRequest = await ensureVacationRequest(employeeToken, windows.regular, false);
  await approveVacation(employeeToken, managerToken, hrToken, regularRequest, false);
  console.log('Solicitud regular de vacaciones aprobada en los dos niveles.');

  const exceptionRequest = await ensureVacationRequest(employeeToken, windows.exception, true);
  await approveVacation(employeeToken, managerToken, hrToken, exceptionRequest, true);
  console.log('Solicitud con excepción resuelta y aprobada en los dos niveles.');

  const template = await ensureTemplate(hrToken);
  await ensureSignedContract(
    hrToken,
    employeeId,
    fieldString(template, 'id', 'id de la plantilla demo'),
  );
  await ensurePayrollDraft(payrollToken, employeeId);

  console.log('Seed de demostración completado a través del API Gateway.');
}

main().catch((error: unknown) => {
  console.error('Error al cargar los datos de demostración:', error);
  process.exitCode = 1;
});
