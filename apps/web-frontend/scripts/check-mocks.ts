/**
 * Verificación de mocks para CI y demo.
 *
 * - Uso normal (`pnpm check:mocks`): informa qué dominios están simulados y
 *   termina con código 0 para no romper el desarrollo local.
 * - Uso para demo/CI (`CHECK_DEMO=1 pnpm check:mocks`): falla si queda algún
 *   dominio simulado activo, de modo que el pipeline no publique una demo con
 *   datos falsos.
 *
 * `NEXT_PUBLIC_API_MOCKS` se lee en tiempo de ejecución del script. Por
 * defecto solo se simula `planillas`; `contratos` ya usa el backend real. Para
 * la build real recuerda compilar con `NEXT_PUBLIC_API_MOCKS=""` (o `none`).
 */
import {
  evaluateDemoCheck,
  getActiveMockDomains,
} from '../src/lib/api/mock-status';

const demoMode = process.env.CHECK_DEMO === '1' || process.argv.includes('--demo');
const domains = getActiveMockDomains();
const result = evaluateDemoCheck(domains);

if (result.ok) {
  console.log(`check:mocks OK — ${result.message}`);
  process.exit(0);
}

if (demoMode) {
  console.error(`check:mocks FALLÓ — ${result.message}`);
  process.exit(1);
}

console.warn(`check:mocks AVISO — ${result.message}`);
console.warn(
  'Ejecuta con CHECK_DEMO=1 (o --demo) para que este chequeo falle cuando haya mocks activos.',
);
process.exit(0);
