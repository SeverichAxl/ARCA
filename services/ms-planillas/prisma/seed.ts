// pnpm prisma db seed — idempotente. No sobrescribe valores ya editados.
import { PrismaClient } from './generated/client';
import {
  ESCALA_ANTIGUEDAD_INICIAL,
  PARAMETROS_INICIALES,
  VIGENCIA_INICIAL,
} from '../src/domain/nomina/parametros-iniciales';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const vigenteDesde = new Date(`${VIGENCIA_INICIAL}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    for (const parametro of PARAMETROS_INICIALES) {
      await tx.parametroLegal.upsert({
        where: { clave_vigenteDesde: { clave: parametro.clave, vigenteDesde } },
        update: {},
        create: {
          clave: parametro.clave,
          valor: parametro.valor,
          vigenteDesde,
          descripcion: parametro.descripcion,
        },
      });
    }
    for (const tramo of ESCALA_ANTIGUEDAD_INICIAL) {
      await tx.escalaAntiguedad.upsert({
        where: { vigenteDesde_aniosDesde: { vigenteDesde, aniosDesde: tramo.aniosDesde } },
        update: {},
        create: { ...tramo, vigenteDesde },
      });
    }
    await tx.configuracionPlanillas.upsert({
      where: { clave: 'RETENCION_ANIOS' },
      update: {},
      create: {
        clave: 'RETENCION_ANIOS',
        valor: '8',
        descripcion: 'Años mínimos de conservación de planillas cerradas (RF-26).',
      },
    });
  });
}

if (require.main === module) {
  void main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
import { PrismaClient, TipoParametroLegal } from './generated/client';

/**
 * Seed Sprint 2: parámetros legales de referencia (HU-20/RF-23).
 * Valores del Product Backlog como datos de configuración, no verificación normativa externa.
 * Ejecutar con RUN_SEED=true y SEED_ACTOR_ID de un usuario demo existente.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  if (process.env.RUN_SEED !== 'true') {
    throw new Error('Refusing to seed: set RUN_SEED=true explicitly.');
  }

  const creadoPor = process.env.SEED_ACTOR_ID;
  if (
    !creadoPor ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(creadoPor)
  ) {
    throw new Error('SEED_ACTOR_ID must be the UUID of an existing demo/system user.');
  }

  const base = [
    { tipo: TipoParametroLegal.SMN, clave: 'SMN_NACIONAL', valor: '3300.0000', unidad: 'BOB' },
    {
      tipo: TipoParametroLegal.APORTE_LABORAL,
      clave: 'AFP_LABORAL',
      valor: '12.7100',
      unidad: 'PCT',
    },
    {
      tipo: TipoParametroLegal.APORTE_PATRONAL,
      clave: 'AFP_PATRONAL',
      valor: '16.7100',
      unidad: 'PCT',
    },
  ];

  for (const p of base) {
    const vigenteDesde = new Date('2026-01-01');
    await prisma.parametroLegal.upsert({
      where: {
        tipo_clave_vigenteDesde: {
          tipo: p.tipo,
          clave: p.clave,
          vigenteDesde,
        },
      },
      update: {},
      create: { ...p, vigenteDesde, activo: true, creadoPor },
    });
  }

  const vigenteDesde = new Date('2026-01-01');
  await prisma.parametroLegal.upsert({
    where: {
      tipo_clave_vigenteDesde: {
        tipo: TipoParametroLegal.BONO_ANTIGUEDAD,
        clave: 'ESCALA_LGT_REFERENCIAL',
        vigenteDesde,
      },
    },
    update: {},
    create: {
      tipo: TipoParametroLegal.BONO_ANTIGUEDAD,
      clave: 'ESCALA_LGT_REFERENCIAL',
      valor: '0.0000',
      unidad: 'ESCALA',
      metadata: {
        tramos: [
          { desdeAnios: 2, hastaAnios: 4, porcentajeSMN: 0 },
          { desdeAnios: 5, hastaAnios: 7, porcentajeSMN: 0 },
          { desdeAnios: 8, hastaAnios: 10, porcentajeSMN: 0 },
        ],
        nota: 'Referencia de demo; completar y aprobar la escala antes de activar.',
      },
      vigenteDesde,
      activo: false,
      creadoPor,
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
