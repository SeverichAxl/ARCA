import { spawnSync } from 'node:child_process';

const services = [
  { name: 'ms-auth', prefix: 'AUTH' },
  { name: 'ms-personal', prefix: 'PERSONAL' },
  { name: 'ms-vacaciones', prefix: 'VACACIONES' },
  { name: 'ms-contratos', prefix: 'CONTRATOS' },
  { name: 'ms-planillas', prefix: 'PLANILLAS' },
];

const operation = process.argv[2];
if (!['migrate', 'seed', 'reset'].includes(operation)) {
  throw new Error('Uso: db-all.ts <migrate|seed|reset>.');
}

function hostDatabaseUrl(value: string, key: string): string {
  const url = new URL(value);
  if (url.hostname === 'postgres') {
    url.hostname = '127.0.0.1';
    url.port = process.env.POSTGRES_PORT ?? '5432';
  }
  if (!url.hostname || !url.port) {
    throw new Error(`${key} debe incluir host y puerto.`);
  }
  return url.toString();
}

for (const service of services) {
  const configuredDatabaseUrl = process.env[`${service.prefix}_DATABASE_URL`];
  const configuredDirectUrl = process.env[`${service.prefix}_DIRECT_URL`];
  if (!configuredDatabaseUrl || !configuredDirectUrl) {
    throw new Error(
      `Faltan ${service.prefix}_DATABASE_URL o ${service.prefix}_DIRECT_URL en .env.`,
    );
  }
  const databaseUrl = hostDatabaseUrl(
    configuredDatabaseUrl,
    `${service.prefix}_DATABASE_URL`,
  );
  const directUrl = hostDatabaseUrl(configuredDirectUrl, `${service.prefix}_DIRECT_URL`);
  if (operation === 'seed' && !['ms-auth', 'ms-personal', 'ms-vacaciones'].includes(service.name)) {
    continue;
  }

  const args =
    operation === 'seed'
      ? ['pnpm', '--filter', service.name, 'exec', 'prisma', 'db', 'seed']
      : [
          'pnpm',
          '--filter',
          service.name,
          'exec',
          'prisma',
          'migrate',
          operation === 'reset' ? 'reset' : 'deploy',
          ...(operation === 'reset' ? ['--force'] : []),
        ];
  console.log(`${operation} ${service.name}...`);
  const result = spawnSync('corepack', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: directUrl },
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${operation} de ${service.name} terminó con código ${result.status}.`);
  }
}
