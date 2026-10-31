import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

const feriados = [
  { fecha: '2026-01-01', nombre: 'Año Nuevo' },
  { fecha: '2026-01-23', nombre: 'Día del Estado Plurinacional (trasladado)' },
  { fecha: '2026-02-16', nombre: 'Carnaval' },
  { fecha: '2026-02-17', nombre: 'Carnaval' },
  { fecha: '2026-04-03', nombre: 'Viernes Santo' },
  { fecha: '2026-05-01', nombre: 'Día del Trabajo' },
  { fecha: '2026-06-04', nombre: 'Corpus Christi' },
  { fecha: '2026-06-05', nombre: 'Feriado adicional' },
  { fecha: '2026-06-22', nombre: 'Año Nuevo Andino Amazónico y del Chaco (trasladado)' },
  { fecha: '2026-08-06', nombre: 'Día de la Independencia' },
  { fecha: '2026-08-07', nombre: 'Feriado adicional' },
  { fecha: '2026-11-02', nombre: 'Día de Todos los Difuntos' },
  { fecha: '2026-12-25', nombre: 'Navidad' },
];
const fechasFeriados = feriados.map(({ fecha }) => new Date(`${fecha}T00:00:00.000Z`));

const configuraciones = [
  { clave: 'DIAS_POR_GESTION', valor: '15' },
  { clave: 'MAX_GESTIONES_ACUMULADAS', valor: '2' },
  { clave: 'MODO_ESCALA', valor: 'MVP' },
];

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.feriado.deleteMany({
      where: {
        ambito: 'NACIONAL',
        fecha: {
          gte: new Date('2026-01-01T00:00:00.000Z'),
          lt: new Date('2027-01-01T00:00:00.000Z'),
          notIn: fechasFeriados,
        },
      },
    });

    for (const feriado of feriados) {
      const fecha = new Date(`${feriado.fecha}T00:00:00.000Z`);
      await tx.feriado.upsert({
        where: {
          fecha_ambito_departamento: {
            fecha,
            ambito: 'NACIONAL',
            departamento: '',
          },
        },
        update: { nombre: feriado.nombre },
        create: {
          ...feriado,
          fecha,
          ambito: 'NACIONAL',
          departamento: '',
        },
      });
    }

    for (const configuracion of configuraciones) {
      await tx.configuracionVacaciones.upsert({
        where: { clave: configuracion.clave },
        update: { valor: configuracion.valor },
        create: configuracion,
      });
    }
  });
}

main()
  .catch((error: unknown) => {
    console.error('Error al sembrar feriados y configuración de ms-vacaciones:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
