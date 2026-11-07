import { PrismaClient, TipoParametroLegal } from './generated/client';

/**
 * Seed Sprint 2: parámetros legales de referencia (HU-20/RF-23).
 * Valores del Product Backlog como datos de configuración, no verificación normativa externa.
 * Ejecutar con RUN_SEED=true y credenciales de owner/migración según entorno.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const creadoPor = '00000000-0000-0000-0000-000000000001'; // reemplazar por usuario sistema real

  const base = [
    { tipo: TipoParametroLegal.SMN, clave: 'SMN_NACIONAL', valor: '3300.0000', unidad: 'BOB' },
    { tipo: TipoParametroLegal.APORTE_LABORAL, clave: 'AFP_LABORAL', valor: '12.7100', unidad: 'PCT' },
    { tipo: TipoParametroLegal.APORTE_PATRONAL, clave: 'AFP_PATRONAL', valor: '16.7100', unidad: 'PCT' },
  ];

  for (const p of base) {
    await prisma.parametroLegal.create({
      data: {
        ...p,
        valor: p.valor as any,
        vigenteDesde: new Date('2026-01-01'),
        activo: true,
        creadoPor,
      },
    });
  }

  // Bono de antigüedad: escala LGT referencial (15/20/30 días por tramos; ajustar en app/config).
  await prisma.parametroLegal.create({
    data: {
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
        nota: 'Completar porcentajes/escala exacta según parametrización aprobada.',
      },
      vigenteDesde: new Date('2026-01-01'),
      activo: true,
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
