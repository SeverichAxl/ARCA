import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

const services = ['ms-auth', 'ms-personal', 'ms-vacaciones', 'ms-contratos', 'ms-planillas'];
const prefixes: Record<string, string> = {
  'ms-auth': 'AUTH',
  'ms-personal': 'PERSONAL',
  'ms-vacaciones': 'VACACIONES',
  'ms-contratos': 'CONTRATOS',
  'ms-planillas': 'PLANILLAS',
};

function hostDatabaseUrl(value: string | undefined, key: string): string {
  if (!value) {
    throw new Error(`Falta configurar ${key} en .env.`);
  }
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

const prompt = createInterface({ input: process.stdin, output: process.stdout });
prompt.question(
  'DESTRUCTIVO: esto borra y recrea las cinco bases del monorepo. Escriba DESTRUCTIVE para continuar: ',
  (answer) => {
    prompt.close();
    if (answer !== 'DESTRUCTIVE') {
      console.log('Reset cancelado; no se modificó ninguna base.');
      return;
    }

    for (const service of services) {
      console.log(`Restableciendo ${service}...`);
      const prefix = prefixes[service];
      const result = spawnSync(
        'corepack',
        ['pnpm', '--filter', service, 'exec', 'prisma', 'migrate', 'reset', '--force'],
        {
          stdio: 'inherit',
          shell: process.platform === 'win32',
          env: {
            ...process.env,
            DATABASE_URL: hostDatabaseUrl(
              process.env[`${prefix}_DATABASE_URL`],
              `${prefix}_DATABASE_URL`,
            ),
            DIRECT_URL: hostDatabaseUrl(
              process.env[`${prefix}_DIRECT_URL`],
              `${prefix}_DIRECT_URL`,
            ),
          },
        },
      );
      if (result.error) {
        console.error(`No se pudo restablecer ${service}:`, result.error);
        process.exitCode = 1;
        return;
      }
      if (result.status !== 0) {
        console.error(`El reset de ${service} terminó con código ${result.status}.`);
        process.exitCode = result.status ?? 1;
        return;
      }
    }
  },
);
