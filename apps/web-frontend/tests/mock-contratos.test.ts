import test from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '../src/lib/api/api-error';
import {
  createPlantilla,
  duplicatePlantilla,
  getPlantilla,
  getPreviewSubjects,
  listPlantillas,
  resetMockContratosStore,
  updatePlantilla,
} from '../src/lib/api/mocks/contratos.mock';

process.env.NEXT_PUBLIC_API_MOCK_LATENCY = '0';

function resetEnv(): void {
  delete process.env.NEXT_PUBLIC_API_MOCK_ERROR;
}

function freshStore(): void {
  resetMockContratosStore();
  resetEnv();
}

test('el almacén inicial trae plantillas deterministas y paginadas', async () => {
  freshStore();
  const page = await listPlantillas({ page: 1, pageSize: 4 });

  assert.equal(page.meta.page, 1);
  assert.equal(page.meta.pageSize, 4);
  assert.equal(page.meta.total, 6);
  assert.equal(page.data.length, 4);
  assert.ok(page.data.every((row) => typeof row.nombre === 'string'));
});

test('lista filtra por nombre y estado activa', async () => {
  freshStore();
  const byName = await listPlantillas({ q: 'pasantía' });
  assert.equal(byName.meta.total, 1);
  assert.match(byName.data[0]!.nombre, /pasantía/i);

  const inactive = await listPlantillas({ activa: false });
  assert.equal(inactive.meta.total, 2);
  assert.ok(inactive.data.every((row) => row.activa === false));
});

test('crear, obtener y duplicar una plantilla conserva variables detectadas', async () => {
  freshStore();
  const created = await createPlantilla({
    nombre: 'Plantilla de prueba',
    descripcion: 'Creada por test',
    contenidoHtml: '<p>{{nombre_empleado}} {{ci}}</p>',
  });

  assert.equal(created.nombre, 'Plantilla de prueba');
  assert.equal(created.versionActual, 1);
  assert.deepEqual(created.variablesDetectadas, ['nombre_empleado', 'ci']);

  const fetched = await getPlantilla(created.id);
  assert.equal(fetched.contenidoHtml, '<p>{{nombre_empleado}} {{ci}}</p>');

  const copy = await duplicatePlantilla(created.id);
  assert.equal(copy.nombre, 'Plantilla de prueba (copia)');
  assert.equal(copy.versionActual, 1);
});

test('actualizar contenido incrementa la versión y recalcula variables', async () => {
  freshStore();
  const created = await createPlantilla({
    nombre: 'Versionable',
    contenidoHtml: '<p>{{nombre_empleado}}</p>',
  });

  const updated = await updatePlantilla(created.id, {
    contenidoHtml: '<p>{{nombre_empleado}} {{cargo}}</p>',
  });

  assert.equal(updated.versionActual, 2);
  assert.deepEqual(updated.variablesDetectadas, ['nombre_empleado', 'cargo']);
  assert.equal(updated.versiones.length, 2);

  const sameContent = await updatePlantilla(created.id, {
    contenidoHtml: '<p>{{nombre_empleado}} {{cargo}}</p>',
  });
  assert.equal(sameContent.versionActual, 2);
});

test('archivar y reactivar usa el campo activa', async () => {
  freshStore();
  const created = await createPlantilla({
    nombre: 'Archivable',
    contenidoHtml: '<p>Contenido</p>',
  });

  const archived = await updatePlantilla(created.id, { activa: false });
  assert.equal(archived.activa, false);

  const reactivated = await updatePlantilla(created.id, { activa: true });
  assert.equal(reactivated.activa, true);
});

test('crear con nombre duplicado responde 409', async () => {
  freshStore();
  await createPlantilla({
    nombre: 'Nombre repetido',
    contenidoHtml: '<p>Uno</p>',
  });

  await assert.rejects(
    () =>
      createPlantilla({
        nombre: '  nombre repetido  ',
        contenidoHtml: '<p>Dos</p>',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 409);
      assert.equal(error.code, 'CONFLICT');
      return true;
    },
  );
});

test('obtener un id inexistente responde 404', async () => {
  freshStore();
  await assert.rejects(
    () => getPlantilla('00000000-0000-4000-8000-000000000000'),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});

test('NEXT_PUBLIC_API_MOCK_ERROR=500 simula un error interno', async () => {
  freshStore();
  process.env.NEXT_PUBLIC_API_MOCK_ERROR = 'contratos:500';

  await assert.rejects(
    () => listPlantillas(),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 500);
      assert.match(error.traceId, /^mock-/);
      return true;
    },
  );
});

test('NEXT_PUBLIC_API_MOCK_ERROR=409 simula un conflicto', async () => {
  freshStore();
  process.env.NEXT_PUBLIC_API_MOCK_ERROR = '409';

  await assert.rejects(
    () =>
      createPlantilla({
        nombre: 'Conflicto',
        contenidoHtml: '<p>Contenido</p>',
      }),
    (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test('los funcionarios de ejemplo son datos bolivianos deterministas', () => {
  const subjects = getPreviewSubjects();
  assert.equal(subjects.length, 4);
  assert.ok(subjects.every((subject) => / (LP|SC|CB)$/.test(subject.ci)));
  assert.ok(subjects.every((subject) => subject.remuneracion > 0));
});
