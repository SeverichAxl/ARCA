// pnpm --filter ms-planillas prisma:seed — idempotente: no sobrescribe valores ya
// editados por el rol autorizado (HU-20/RF-23). Valores del Product Backlog como
// datos de configuración, no verificación normativa externa.
// Ejecutar con RUN_SEED=true y SEED_ACTOR_ID = UUID de un usuario demo existente.
import { PrismaClient, TipoParametroLegal } from './generated/client';
import { PARAMETROS_INICIALES, VIGENCIA_INICIAL } from '../src/domain/nomina/parametros-iniciales';

const prisma = new PrismaClient();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function main(): Promise<void> {
  if (process.env.RUN_SEED !== 'true') {
    throw new Error('Refusing to seed: set RUN_SEED=true explicitly.');
  }
  const creadoPor = process.env.SEED_ACTOR_ID;
  if (!creadoPor || !UUID.test(creadoPor)) {
    throw new Error('SEED_ACTOR_ID must be the UUID of an existing demo/system user.');
  }

  const vigenteDesde = new Date(`${VIGENCIA_INICIAL}T00:00:00.000Z`);
  for (const p of PARAMETROS_INICIALES) {
    await prisma.parametroLegal.upsert({
      where: {
        tipo_clave_vigenteDesde: { tipo: TipoParametroLegal[p.tipo], clave: p.clave, vigenteDesde },
      },
      update: {},
      create: {
        tipo: TipoParametroLegal[p.tipo],
        clave: p.clave,
        valor: p.valor,
        unidad: p.unidad,
        ...(p.metadata ? { metadata: p.metadata as never } : {}),
        vigenteDesde,
        activo: true,
        creadoPor,
      },
    });
  }

  await prisma.configuracionPlanillas.upsert({
    where: { clave: 'RETENCION_ANIOS' },
    update: {},
    create: {
      clave: 'RETENCION_ANIOS',
      valor: '8',
      descripcion: 'Años mínimos de conservación de planillas cerradas (RF-26).',
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
