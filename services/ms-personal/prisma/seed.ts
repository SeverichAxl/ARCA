import { PrismaClient } from './generated/client';

const prisma = new PrismaClient();

const areas = [
  { id: '00000000-0000-4000-8000-000000000001', nombre: 'Gerencia General', padreId: null },
  { id: '00000000-0000-4000-8000-000000000002', nombre: 'Gestión Humana', padreId: '00000000-0000-4000-8000-000000000001' },
  { id: '00000000-0000-4000-8000-000000000003', nombre: 'Tecnología', padreId: '00000000-0000-4000-8000-000000000001' },
  { id: '00000000-0000-4000-8000-000000000004', nombre: 'Finanzas', padreId: '00000000-0000-4000-8000-000000000001' },
  { id: '00000000-0000-4000-8000-000000000005', nombre: 'Operaciones', padreId: '00000000-0000-4000-8000-000000000001' },
  { id: '00000000-0000-4000-8000-000000000006', nombre: 'Selección y Desarrollo', padreId: '00000000-0000-4000-8000-000000000002' },
  { id: '00000000-0000-4000-8000-000000000007', nombre: 'Administración de Personal', padreId: '00000000-0000-4000-8000-000000000002' },
  { id: '00000000-0000-4000-8000-000000000008', nombre: 'Desarrollo de Sistemas', padreId: '00000000-0000-4000-8000-000000000003' },
  { id: '00000000-0000-4000-8000-000000000009', nombre: 'Infraestructura', padreId: '00000000-0000-4000-8000-000000000003' },
  { id: '00000000-0000-4000-8000-000000000010', nombre: 'Contabilidad', padreId: '00000000-0000-4000-8000-000000000004' },
  { id: '00000000-0000-4000-8000-000000000011', nombre: 'Tesorería', padreId: '00000000-0000-4000-8000-000000000004' },
  { id: '00000000-0000-4000-8000-000000000012', nombre: 'Atención al Cliente', padreId: '00000000-0000-4000-8000-000000000005' },
  { id: '00000000-0000-4000-8000-000000000013', nombre: 'Logística', padreId: '00000000-0000-4000-8000-000000000005' },
];

const cargos = [
  'Gerente General',
  'Gerente de Área',
  'Jefe de Área',
  'Coordinador',
  'Analista',
  'Técnico',
  'Asistente',
  'Funcionario',
];

async function main(): Promise<void> {
  const actualAreaIds = new Map<string, string>();

  for (const area of areas) {
    const padreId = area.padreId === null
      ? null
      : actualAreaIds.get(area.padreId);
    if (area.padreId !== null && padreId === undefined) {
      throw new Error(`No se encontró el área padre del catálogo para ${area.nombre}.`);
    }

    const existente = await prisma.area.findFirst({
      where: { nombre: area.nombre, padreId: padreId ?? null },
    });
    const guardada = existente
      ? await prisma.area.update({
          where: { id: existente.id },
          data: { nombre: area.nombre, padreId: padreId ?? null },
        })
      : await prisma.area.create({
          data: {
            id: area.id,
            nombre: area.nombre,
            padreId: padreId ?? null,
            activa: true,
            jefeId: null,
          },
        });
    actualAreaIds.set(area.id, guardada.id);
  }

  for (const nombre of cargos) {
    await prisma.cargo.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre, activo: true },
    });
  }

  await prisma.configuracionPersonal.upsert({
    where: { clave: 'DIAS_PRUEBA_DEFAULT' },
    update: { valor: '90' },
    create: { clave: 'DIAS_PRUEBA_DEFAULT', valor: '90' },
  });
  await prisma.configuracionPersonal.upsert({
    where: { clave: 'LIMITE_EXTRANJEROS_PCT' },
    update: { valor: '15' },
    create: { clave: 'LIMITE_EXTRANJEROS_PCT', valor: '15' },
  });
}

main()
  .catch((error: unknown) => {
    console.error('Error al sembrar el catálogo de ms-personal:', error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
