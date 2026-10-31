import { spawnSync } from 'node:child_process';

interface ServiceDatabase {
  service: string;
  appRole: string;
  appPassword: string;
  database: string;
  directOwner: string;
}

const services: ServiceDatabase[] = [
  {
    service: 'ms-auth',
    appRole: 'ms_auth_app',
    appPassword: required('AUTH_DB_APP_PASSWORD'),
    database: 'db_auth',
    directOwner: 'ms_auth_owner',
  },
  {
    service: 'ms-personal',
    appRole: 'ms_personal_app',
    appPassword: required('PERSONAL_DB_APP_PASSWORD'),
    database: 'db_personal',
    directOwner: 'ms_personal_owner',
  },
  {
    service: 'ms-vacaciones',
    appRole: 'ms_vacaciones_app',
    appPassword: required('VACACIONES_DB_APP_PASSWORD'),
    database: 'db_vacaciones',
    directOwner: 'ms_vacaciones_owner',
  },
  {
    service: 'ms-contratos',
    appRole: 'ms_contratos_app',
    appPassword: required('CONTRATOS_DB_APP_PASSWORD'),
    database: 'db_contratos',
    directOwner: 'ms_contratos_owner',
  },
  {
    service: 'ms-planillas',
    appRole: 'ms_planillas_app',
    appPassword: required('PLANILLAS_DB_APP_PASSWORD'),
    database: 'db_planillas',
    directOwner: 'ms_planillas_owner',
  },
];

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta configurar ${name} en el entorno.`);
  }
  return value;
}

function runDocker(args: string[]): string {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `docker ${args.join(' ')} terminó con ${result.status}.`);
  }
  return result.stdout.trim();
}

function runPsqlAsApp(
  service: ServiceDatabase,
  database: string,
  expectDenied = false,
): string {
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      '-e',
      `PGPASSWORD=${service.appPassword}`,
      'postgres',
      'psql',
      '-w',
      '-h',
      '127.0.0.1',
      '-U',
      service.appRole,
      '-d',
      database,
      '-v',
      'ON_ERROR_STOP=1',
      '-Atc',
      'SELECT 1',
    ],
    {
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    },
  );
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const message = result.stderr.trim();
    if (expectDenied && /permission denied for database/i.test(message)) {
      return '';
    }
    throw new Error(message || `psql terminó con ${result.status}.`);
  }
  return result.stdout.trim();
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
  console.log(`OK ${message}`);
}

function verifyComposeUrls(): void {
  const compose = JSON.parse(runDocker(['compose', 'config', '--format', 'json'])) as {
    services: Record<string, { environment?: Record<string, string> }>;
  };
  for (const service of services) {
    const environment = compose.services[service.service]?.environment;
    if (!environment) {
      throw new Error(`No se encontró environment para ${service.service} en docker compose config.`);
    }
    const databaseUrl = new URL(environment.DATABASE_URL);
    const directUrl = new URL(environment.DIRECT_URL);
    assert(
      decodeURIComponent(databaseUrl.username) === service.appRole &&
        databaseUrl.pathname.slice(1) === service.database,
      `${service.service} usa solo su usuario app y su base en DATABASE_URL`,
    );
    assert(
      decodeURIComponent(directUrl.username) === service.directOwner &&
        directUrl.pathname.slice(1) === service.database,
      `${service.service} usa solo su owner y su base en DIRECT_URL`,
    );
    assert(
      !Object.keys(environment).some(
        (key) => /^(AUTH|PERSONAL|VACACIONES|CONTRATOS|PLANILLAS)_(DATABASE|DIRECT)_URL$/.test(key),
      ),
      `${service.service} no recibe URLs de bases ajenas`,
    );
  }
}

function verifyDatabaseGrants(): void {
  for (const service of services) {
    assert(
      runPsqlAsApp(service, service.database) === '1',
      `${service.appRole} se conecta a ${service.database}`,
    );
    for (const target of services.filter((candidate) => candidate !== service)) {
      const result = runPsqlAsApp(service, target.database, true);
      assert(
        result === '',
        `${service.appRole} no se conecta a ${target.database}`,
      );
    }
  }

  const sql =
    "SELECT has_table_privilege('ms_auth_app', 'public.auditoria_log', 'UPDATE')::text || ',' || has_table_privilege('ms_auth_app', 'public.auditoria_log', 'DELETE')::text";
  const result = runDocker([
    'compose',
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    required('POSTGRES_USER'),
    '-d',
    'db_auth',
    '-v',
    'ON_ERROR_STOP=1',
    '-Atc',
    sql,
  ]);
  assert(result === 'false,false', 'ms_auth_app no tiene UPDATE ni DELETE en auditoria_log');
}

try {
  verifyComposeUrls();
  verifyDatabaseGrants();
} catch (error) {
  console.error('Falló la verificación de aislamiento:', error);
  process.exitCode = 1;
}
