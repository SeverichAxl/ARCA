// Seed idempotente para los parámetros de referencia del motor de nómina.
import { PrismaClient, TipoParametroLegal } from './generated/client';
import {
  ESCALA_ANTIGUEDAD_INICIAL,
  PARAMETROS_INICIALES,
  VIGENCIA_INICIAL,
} from '../src/domain/nomina/parametros-iniciales';

const prisma = new PrismaClient();

const PARAMETER_TYPES: Record<string, TipoParametroLegal> = {
  SMN: TipoParametroLegal.SMN,
  APORTE_LABORAL_PCT: TipoParametroLegal.APORTE_LABORAL,
  APORTE_PATRONAL_PCT: TipoParametroLegal.APORTE_PATRONAL,
  RC_IVA_PCT: TipoParametroLegal.RC_IVA,
  RC_IVA_MINIMO_NO_IMPONIBLE_SMN: TipoParametroLegal.RC_IVA,
  BONO_ANTIGUEDAD_BASE_SMN: TipoParametroLegal.BONO_ANTIGUEDAD,
  ANS_TRAMO_1_LIMITE: TipoParametroLegal.OTRO,
  ANS_TRAMO_1_PCT: TipoParametroLegal.OTRO,
  ANS_TRAMO_2_LIMITE: TipoParametroLegal.OTRO,
  ANS_TRAMO_2_PCT: TipoParametroLegal.OTRO,
  ANS_TRAMO_3_LIMITE: TipoParametroLegal.OTRO,
  ANS_TRAMO_3_PCT: TipoParametroLegal.OTRO,
};

async function main(): Promise<void> {
  if (process.env.RUN_SEED !== 'true') {
    throw new Error('Refusing to seed: set RUN_SEED=true explicitly.');
  }

  const creadoPor = process.env.SEED_ACTOR_ID;
  if (
    !creadoPor ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      creadoPor,
    )
  ) {
    throw new Error('SEED_ACTOR_ID must be the UUID of an existing demo/system user.');
  }

  const vigenteDesde = new Date(`${VIGENCIA_INICIAL}T00:00:00.000Z`);

  await prisma.$transaction(async (tx) => {
    for (const parametro of PARAMETROS_INICIALES) {
      const tipo = PARAMETER_TYPES[parametro.clave];
      if (!tipo) throw new Error(`Missing legal parameter type for ${parametro.clave}.`);

      await tx.parametroLegal.upsert({
        where: {
          tipo_clave_vigenteDesde: {
            tipo,
            clave: parametro.clave,
            vigenteDesde,
          },
        },
        update: {},
        create: {
          tipo,
          clave: parametro.clave,
          valor: parametro.valor,
          vigenteDesde,
          activo: true,
          creadoPor,
        },
      });
    }

    for (const tramo of ESCALA_ANTIGUEDAD_INICIAL) {
      await tx.escalaAntiguedad.upsert({
        where: {
          vigenteDesde_aniosDesde: {
            vigenteDesde,
            aniosDesde: tramo.aniosDesde,
          },
        },
        update: {},
        create: { ...tramo, vigenteDesde, creadoPor },
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
