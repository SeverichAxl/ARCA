// pnpm prisma db seed — idempotente. La fuente de verdad de la matriz es este archivo; los cambios manuales en las tablas se pierden en el siguiente seed.
import { PrismaClient } from './generated/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

export const PERMISOS: Record<string, [modulo: string, descripcion: string]> = {
  // auth
  'usuario:create': ['auth', 'Crear usuarios'],
  'usuario:read': ['auth', 'Listar usuarios'],
  'usuario:update': ['auth', 'Activar, inactivar, bloquear/desbloquear usuarios'],
  'usuario:assign_role': ['auth', 'Asignar rol a un usuario'],
  'sistema:config': ['auth', 'Configurar parámetros del sistema (intentos, TTL)'],
  'auditoria:read': ['auth', 'Consultar el Audit Trail'],
  // personal
  'personal:create': ['personal', 'Dar de alta funcionarios'],
  'personal:read': ['personal', 'Ver expedientes (sin remuneración)'],
  'personal:read_salary': ['personal', 'Ver remuneración'],
  'personal:update': ['personal', 'Modificar área, cargo y remuneración'],
  'personal:ratify': ['personal', 'Ratificar funcionario'],
  'personal:baja': ['personal', 'Procesar baja y finiquito'],
  'personal:inamovilidad': ['personal', 'Registrar inamovilidad / Ley 223'],
  'catalogo:manage': ['personal', 'Administrar áreas y cargos'],
  'organigrama:read': ['personal', 'Ver organigrama'],
  // vacaciones
  'vacaciones:request': ['vacaciones', 'Solicitar vacaciones propias'],
  'vacaciones:read_own': ['vacaciones', 'Ver saldo y solicitudes propias'],
  'vacaciones:read_area': ['vacaciones', 'Ver vacaciones del área a cargo'],
  'vacaciones:read_all': ['vacaciones', 'Ver vacaciones de toda la empresa'],
  'vacaciones:approve_jefe': ['vacaciones', 'Aprobar/rechazar (nivel jefe) solo de su área'],
  'vacaciones:approve_rrhh': ['vacaciones', 'Aprobación final RRHH (nunca de la propia)'],
  'vacaciones:excepcion_resolve': ['vacaciones', 'Resolver solicitudes de excepción por exceso de días'],
  'licencias:manage': ['vacaciones', 'Registrar y autorizar licencias pagadas'],
  'vacaciones:config': ['vacaciones', 'Parametrizar feriados, escala y tope de gestiones'],
  // contratos
  'contrato:template_manage': ['contratos', 'Crear/editar plantillas'],
  'contrato:generate': ['contratos', 'Generar y emitir contratos'],
  'contrato:read': ['contratos', 'Ver contratos'],
  'contrato:download_own': ['contratos', 'Descargar contrato propio'],
  // planillas
  'parametros_ley:update': ['planillas', 'Actualizar SMN, aportes y escalas de ley'],
  'planilla:calculate': ['planillas', 'Calcular planilla mensual'],
  'planilla:close': ['planillas', 'Cerrar planilla mensual'],
  'boleta:issue': ['planillas', 'Generar y emitir boletas'],
  'boleta:read_own': ['planillas', 'Ver/descargar boleta propia'],
  'boleta:read_all': ['planillas', 'Ver boletas de todos (solo lectura)'],
  'planilla:read': ['planillas', 'Ver planillas e historial de pagos'],
  // transversal
  'dashboard:read': ['transversal', 'Dashboard ejecutivo completo'],
  'dashboard:read_area': ['transversal', 'Dashboard de su área'],
  'export:data': ['transversal', 'Exportar a CSV/Excel'],
};

const PROPIOS = ['vacaciones:request', 'vacaciones:read_own', 'contrato:download_own', 'boleta:read_own'];

export const ROLES: Record<string, { nombre: string; permisos: string[] }> = {
  ADMIN_GENERAL: {
    nombre: 'Administrador General (accesos y parámetros; NO datos de RRHH ni sueldos)',
    permisos: ['usuario:create', 'usuario:read', 'usuario:update', 'usuario:assign_role', 'sistema:config', 'parametros_ley:update', ...PROPIOS],
  },
  RRHH_OPERATIVO: {
    nombre: 'Gestión Humana (opera personal, vacaciones y contratos; NO cierra planilla)',
    permisos: [
      'personal:create', 'personal:read', 'personal:read_salary', 'personal:update', 'personal:ratify',
      'personal:baja', 'personal:inamovilidad', 'catalogo:manage', 'organigrama:read',
      'vacaciones:read_all', 'vacaciones:approve_rrhh', 'vacaciones:excepcion_resolve', 'licencias:manage', 'vacaciones:config',
      'contrato:template_manage', 'contrato:generate', 'contrato:read',
      'dashboard:read', 'export:data', ...PROPIOS,
    ],
  },
  ENCARGADO_NOMINA: {
    nombre: 'Encargado de Nómina (calcula/cierra planilla y emite boletas)',
    permisos: [
      'personal:read', 'personal:read_salary', 'planilla:calculate', 'planilla:close', 'boleta:issue',
      'boleta:read_all', 'planilla:read', 'dashboard:read', 'export:data', ...PROPIOS,
    ],
  },
  JEFE_AREA: {
    nombre: 'Jefe de Área',
    permisos: ['organigrama:read', 'vacaciones:read_area', 'vacaciones:approve_jefe', 'dashboard:read_area', ...PROPIOS],
  },
  FUNCIONARIO: { nombre: 'Funcionario', permisos: [...PROPIOS] },
  GERENCIA: {
    nombre: 'Gerencia / Directorio (lectura transversal y excepciones)',
    permisos: [
      'personal:read', 'organigrama:read', 'vacaciones:read_all', 'vacaciones:excepcion_resolve',
      'contrato:read', 'planilla:read', 'dashboard:read', ...PROPIOS,
    ],
  },
  AUDITOR: {
    nombre: 'Auditor (solo lectura, único con acceso al Audit Trail)',
    permisos: [
      'auditoria:read', 'personal:read', 'organigrama:read', 'vacaciones:read_all', 'contrato:read',
      'boleta:read_all', 'planilla:read', 'dashboard:read', ...PROPIOS,
    ],
  },
};

const CONFIG: Record<string, [string, string]> = {
  MAX_FAILED_LOGIN_ATTEMPTS: ['3', 'Intentos fallidos antes del bloqueo temporal'],
  LOGIN_LOCK_MINUTES: ['15', 'Duración del bloqueo temporal'],
  JWT_ACCESS_TTL_MIN: ['15', 'TTL access token (min)'],
  JWT_REFRESH_TTL_H: ['8', 'TTL refresh token (horas)'],
};

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!username || !password) throw new Error('Define SEED_ADMIN_USERNAME y SEED_ADMIN_PASSWORD (no se hardcodean credenciales)');
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.$transaction(
    async (tx) => {
      for (const [codigo, [modulo, descripcion]] of Object.entries(PERMISOS)) {
        await tx.permiso.upsert({ where: { codigo }, update: { modulo, descripcion }, create: { codigo, modulo, descripcion } });
      }
      const permisos = await tx.permiso.findMany();
      const idPermiso = new Map(permisos.map((p) => [p.codigo, p.id]));

      for (const [codigo, { nombre, permisos: lista }] of Object.entries(ROLES)) {
        const rol = await tx.rol.upsert({ where: { codigo }, update: { nombre }, create: { codigo, nombre } });
        await tx.rolPermiso.deleteMany({ where: { rolId: rol.id } });
        await tx.rolPermiso.createMany({
          data: [...new Set(lista)].map((p) => {
            const permisoId = idPermiso.get(p);
            if (!permisoId) throw new Error(`Permiso inexistente en la matriz: ${p}`);
            return { rolId: rol.id, permisoId };
          }),
        });
      }
    },
    { timeout: 30000 },
  );

  for (const [clave, [valor, descripcion]] of Object.entries(CONFIG)) {
    await prisma.configuracionSistema.upsert({ where: { clave }, update: {}, create: { clave, valor, descripcion } });
  }

  const rolAdmin = await prisma.rol.findUniqueOrThrow({ where: { codigo: 'ADMIN_GENERAL' } });
  await prisma.usuario.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      rolId: rolAdmin.id,
      debeCambiarPassword: true,
    },
  });
}

if (require.main === module) {
  void main().finally(() => prisma.$disconnect());
}
