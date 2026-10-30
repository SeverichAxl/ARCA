import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const PERMISOS = [
  'personal:leer',
  'personal:crear',
  'personal:editar',
  'vacaciones:leer',
  'vacaciones:aprobar',
  'contratos:leer',
  'contratos:crear',
  'planillas:leer',
  'planillas:aprobar',
  'auditoria:leer',
];

async function main(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  const nombre = process.env.SEED_ADMIN_NOMBRE ?? 'Administrador ARCA';

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorios para ejecutar el seed.');
  }

  const permisos = await Promise.all(
    PERMISOS.map((codigo) =>
      prisma.permiso.upsert({
        where: { codigo },
        update: {},
        create: { codigo, descripcion: codigo },
      }),
    ),
  );

  const rol = await prisma.rol.upsert({
    where: { nombre: 'ADMINISTRADOR' },
    update: {},
    create: { nombre: 'ADMINISTRADOR', descripcion: 'Acceso total al sistema' },
  });

  await Promise.all(
    permisos.map((permiso) =>
      prisma.rolPermiso.upsert({
        where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
        update: {},
        create: { rolId: rol.id, permisoId: permiso.id },
      }),
    ),
  );

  const passwordHash = await hash(password, 12);

  await prisma.usuario.upsert({
    where: { email },
    update: { nombre, passwordHash, rolId: rol.id, activo: true },
    create: { nombre, email, passwordHash, rolId: rol.id },
  });

  console.log(`Seed completado. Usuario administrador: ${email}`);
}

main()
  .catch((error: unknown) => {
    console.error('Error ejecutando el seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
