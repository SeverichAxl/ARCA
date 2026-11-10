import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  CreatePlantillaData,
  Page,
  PlantillaDetalle,
  PlantillaListado,
  PlantillaListQuery,
  UpdatePlantillaData,
} from '../../domain/templates/template.models';
import type { PlantillaRepository } from '../../domain/templates/template.repository';
import type { CreatePlantillaDto, ListPlantillasQueryDto } from './template.dto';
import { PlantillaService } from './template.service';

const actorId = '11111111-1111-4111-8111-111111111111';

class FakePlantillaRepository implements PlantillaRepository {
  readonly rows: PlantillaDetalle[] = [];
  private sequence = 0;

  async list(query: PlantillaListQuery): Promise<Page<PlantillaListado>> {
    const filtered = this.rows
      .filter((row) => (query.activa === undefined ? true : row.activa === query.activa))
      .filter((row) => (query.q ? row.nombre.toLowerCase().includes(query.q.toLowerCase()) : true))
      .map<PlantillaListado>((row) => ({
        id: row.id,
        nombre: row.nombre,
        descripcion: row.descripcion,
        activa: row.activa,
        versionActual: row.versionActual,
        actualizadoEn: row.actualizadoEn,
      }));

    const start = (query.page - 1) * query.pageSize;
    return {
      data: filtered.slice(start, start + query.pageSize),
      total: filtered.length,
    };
  }

  async findById(id: string): Promise<PlantillaDetalle | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async create(data: CreatePlantillaData): Promise<PlantillaDetalle> {
    this.sequence += 1;
    const id = `00000000-0000-4000-8000-${String(this.sequence).padStart(12, '0')}`;
    const now = new Date(`2026-11-0${this.sequence}T10:00:00.000Z`);
    const row: PlantillaDetalle = {
      id,
      nombre: data.nombre,
      descripcion: data.descripcion,
      activa: data.activa,
      versionActual: 1,
      contenidoHtml: data.contenidoHtml,
      variablesDetectadas: data.variablesDetectadas,
      versiones: [
        {
          id: `${id}-v1`,
          version: 1,
          contenidoHtml: data.contenidoHtml,
          variablesDetectadas: data.variablesDetectadas,
          creadoEn: now,
        },
      ],
      creadoEn: now,
      actualizadoEn: now,
    };
    this.rows.push(row);
    return row;
  }

  async update(id: string, data: UpdatePlantillaData): Promise<PlantillaDetalle | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;

    const current = this.rows[index]!;
    const now = new Date('2026-11-10T10:00:00.000Z');
    let versionActual = current.versionActual;
    let contenidoHtml = current.contenidoHtml;
    let variablesDetectadas = current.variablesDetectadas;
    let versiones = current.versiones;

    if (data.contenidoHtml !== undefined) {
      versionActual += 1;
      contenidoHtml = data.contenidoHtml;
      variablesDetectadas = data.variablesDetectadas ?? [];
      versiones = [
        {
          id: `${id}-v${versionActual}`,
          version: versionActual,
          contenidoHtml,
          variablesDetectadas,
          creadoEn: now,
        },
        ...versiones,
      ];
    }

    const updated: PlantillaDetalle = {
      ...current,
      nombre: data.nombre ?? current.nombre,
      descripcion: data.descripcion !== undefined ? data.descripcion : current.descripcion,
      activa: data.activa ?? current.activa,
      versionActual,
      contenidoHtml,
      variablesDetectadas,
      versiones,
      actualizadoEn: now,
    };
    this.rows[index] = updated;
    return updated;
  }
}

function createDto(overrides: Partial<CreatePlantillaDto> = {}): CreatePlantillaDto {
  return {
    nombre: 'Contrato indefinido estándar',
    descripcion: 'Modelo Ministerio de Trabajo',
    contenidoHtml: '<h1>Contrato</h1><p>Yo {{nombre_empleado}}, CI {{ci}}.</p>',
    activa: true,
    ...overrides,
  };
}

async function captureRejection<T>(promise: Promise<T>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la promesa fuera rechazada.');
}

describe('PlantillaService', () => {
  let repository: FakePlantillaRepository;
  let service: PlantillaService;

  beforeEach(() => {
    repository = new FakePlantillaRepository();
    service = new PlantillaService(repository);
  });

  describe('create', () => {
    it('sanea el HTML, detecta variables y crea la versión inicial', async () => {
      const result = await service.create(
        createDto({
          contenidoHtml:
            '<h1 onclick="alert(1)">Contrato</h1><script>alert(1)</script>' +
            '<p>Yo {{nombre_empleado}}.</p>',
        }),
        actorId,
      );

      expect(result).toMatchObject({
        nombre: 'Contrato indefinido estándar',
        descripcion: 'Modelo Ministerio de Trabajo',
        variablesDetectadas: ['nombre_empleado'],
        activa: true,
        versionActual: 1,
      });
      expect(repository.rows).toHaveLength(1);
      expect(repository.rows[0]?.contenidoHtml).toBe(
        '<h1>Contrato</h1><p>Yo {{nombre_empleado}}.</p>',
      );
      expect(repository.rows[0]?.versiones).toHaveLength(1);
      expect(repository.rows[0]?.versiones[0]?.creadoEn).toBeInstanceOf(Date);
    });

    it('aplica activa=true por defecto', async () => {
      const dto = createDto();
      delete dto.activa;

      const result = await service.create(dto, actorId);

      expect(result.activa).toBe(true);
    });

    it('rechaza variables fuera del catálogo con 400', async () => {
      const error = await captureRejection(
        service.create(
          createDto({ contenidoHtml: '<p>{{nombre_empleado}} {{sueldo}}</p>' }),
          actorId,
        ),
      );

      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'CONTR_VARIABLE_NO_PERMITIDA',
        details: { variables: ['sueldo'] },
      });
      expect(repository.rows).toHaveLength(0);
    });

    it('rechaza HTML inválido o placeholders malformados con 400', async () => {
      const malformed = await captureRejection(
        service.create(createDto({ contenidoHtml: '<p>{{ nombre_empleado }}</p>' }), actorId),
      );
      const empty = await captureRejection(
        service.create(createDto({ contenidoHtml: '<script>alert(1)</script>' }), actorId),
      );

      expect((malformed as BadRequestException).getResponse()).toMatchObject({
        code: 'CONTR_TEMPLATE_INVALIDA',
      });
      expect((empty as BadRequestException).getResponse()).toMatchObject({
        code: 'CONTR_TEMPLATE_INVALIDA',
      });
      expect(repository.rows).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('devuelve data y meta con paginación', async () => {
      await service.create(createDto({ nombre: 'Contrato indefinido' }), actorId);
      await service.create(createDto({ nombre: 'Contrato a plazo fijo' }), actorId);

      const query: ListPlantillasQueryDto = {
        page: 1,
        pageSize: 1,
        activa: true,
        q: 'Contrato',
      };
      const result = await service.list(query);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    });

    it('filtra por estado activo', async () => {
      const created = await service.create(createDto(), actorId);
      await service.update(created.id, { activa: false }, actorId);

      const result = await service.list({ page: 1, pageSize: 20, activa: false });

      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.activa).toBe(false);
    });
  });

  describe('get', () => {
    it('devuelve el detalle de la plantilla', async () => {
      const created = await service.create(createDto(), actorId);

      const result = await service.get(created.id);

      expect(result.id).toBe(created.id);
      expect(result.contenidoHtml).toContain('{{nombre_empleado}}');
      expect(result.versiones).toHaveLength(1);
    });

    it('responde 404 cuando la plantilla no existe', async () => {
      const error = await captureRejection(service.get('99999999-9999-4999-8999-999999999999'));

      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('crea una nueva versión cuando cambia el contenido HTML', async () => {
      const created = await service.create(createDto(), actorId);

      const updated = await service.update(
        created.id,
        {
          nombre: 'Contrato indefinido actualizado',
          contenidoHtml: '<h1>Contrato v2</h1><p>CI {{ci}}</p><script>alert(1)</script>',
        },
        actorId,
      );

      expect(updated.versionActual).toBe(2);
      expect(updated.nombre).toBe('Contrato indefinido actualizado');
      expect(updated.variablesDetectadas).toEqual(['ci']);
      expect(updated.contenidoHtml).toBe('<h1>Contrato v2</h1><p>CI {{ci}}</p>');
      expect(updated.versiones).toHaveLength(2);
      expect(updated.versiones[1]?.version).toBe(1);
      expect(updated.versiones[1]?.contenidoHtml).toContain('{{nombre_empleado}}');
    });

    it('no incrementa la versión si el contenido saneado no cambia', async () => {
      const created = await service.create(createDto(), actorId);

      const updated = await service.update(
        created.id,
        {
          activa: false,
          contenidoHtml: '<h1>Contrato</h1><p>Yo {{nombre_empleado}}, CI {{ci}}.</p>',
        },
        actorId,
      );

      expect(updated.activa).toBe(false);
      expect(updated.versionActual).toBe(1);
      expect(updated.versiones).toHaveLength(1);
    });

    it('rechaza variables inválidas sin modificar la plantilla', async () => {
      const created = await service.create(createDto(), actorId);

      const error = await captureRejection(
        service.update(
          created.id,
          { contenidoHtml: '<p>{{duracion_prueba}} {{antiguedad}}</p>' },
          actorId,
        ),
      );

      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'CONTR_VARIABLE_NO_PERMITIDA',
        details: { variables: ['antiguedad'] },
      });
      const current = await service.get(created.id);
      expect(current.versionActual).toBe(1);
      expect(current.variablesDetectadas).toEqual(['nombre_empleado', 'ci']);
    });

    it('responde 404 al actualizar una plantilla inexistente', async () => {
      const error = await captureRejection(
        service.update('99999999-9999-4999-8999-999999999999', { nombre: 'No existe' }, actorId),
      );

      expect(error).toBeInstanceOf(NotFoundException);
    });
  });
});
