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
