import 'reflect-metadata';
import { AuditContext } from '@arca/audit';
import type { InternalPrincipal } from '@arca/internal-auth';
import type {
  ContratoCreado,
  ContratoDetalle,
  ContratoVersionDetalle,
} from '../../domain/contracts/contract.models';
import type { ContratoRepository } from '../../domain/contracts/contract.repository';
import type { ContratoStoragePort } from '../../domain/contracts/contrato-storage.port';
import type {
  DatosEmpleadoContrato,
  PersonalDataPort,
} from '../../domain/contracts/personal-data.port';
import type { PdfGeneratorPort } from '../../domain/contracts/pdf-generator.port';
import type { PlantillaDetalle } from '../../domain/templates/template.models';
import type { PlantillaRepository } from '../../domain/templates/template.repository';
import { ContractService } from './contract.service';

const plantillaId = '11111111-1111-4111-8111-111111111111';
const empleadoId = '22222222-2222-4222-8222-222222222222';
const contratoId = '33333333-3333-4333-8333-333333333333';
const versionId = '44444444-4444-4444-8444-444444444444';

const principal: InternalPrincipal = {
  userId: '55555555-5555-4555-8555-555555555555',
  empleadoId: null,
  rol: 'RRHH_OPERATIVO',
  permisos: ['contrato:generate', 'personal:read_salary'],
};

const datos: DatosEmpleadoContrato = {
  empleadoId,
  nombreEmpleado: 'Ana Rojas',
  ci: '12345678',
  cargo: 'Analista',
  remuneracion: '6000.00',
  fechaIngreso: '2026-01-01',
  duracionPrueba: '90 días',
};

function plantilla(overrides: Partial<PlantillaDetalle> = {}): PlantillaDetalle {
  return {
    id: plantillaId,
    nombre: 'Contrato indefinido',
    descripcion: null,
    activa: true,
    versionActual: 2,
    contenidoHtml:
      '<p>{{nombre_empleado}}|{{ci}}|{{cargo}}|{{remuneracion}}|{{fecha_ingreso}}|{{duracion_prueba}}</p>',
    variablesDetectadas: [
      'nombre_empleado',
      'ci',
      'cargo',
      'remuneracion',
      'fecha_ingreso',
      'duracion_prueba',
    ],
    versiones: [
      {
        id: versionId,
        version: 2,
        contenidoHtml:
          '<p>{{nombre_empleado}}|{{ci}}|{{cargo}}|{{remuneracion}}|{{fecha_ingreso}}|{{duracion_prueba}}</p>',
        variablesDetectadas: [
          'nombre_empleado',
          'ci',
          'cargo',
          'remuneracion',
          'fecha_ingreso',
          'duracion_prueba',
        ],
        creadoEn: new Date('2026-10-01T10:00:00.000Z'),
      },
    ],
    creadoEn: new Date('2026-10-01T10:00:00.000Z'),
    actualizadoEn: new Date('2026-10-01T10:00:00.000Z'),
    ...overrides,
  };
}

function contratoDetalle(): ContratoDetalle {
  const current = plantilla();
  return {
    id: contratoId,
    empleadoId,
    plantillaId,
    plantillaVersionId: versionId,
    plantillaVersion: current.versiones[0]!,
    estado: 'BORRADOR',
    fechaInicio: null,
    observacion: null,
    creadoEn: new Date('2026-11-01T10:00:00.000Z'),
  };
}

describe('ContractService', () => {
  let plantillas: { findById: jest.Mock };
  let contratos: {
    create: jest.Mock;
    findById: jest.Mock;
    findByEmpleadoId: jest.Mock;
    findLatestVersion: jest.Mock;
    findVersion: jest.Mock;
    createVersion: jest.Mock;
  };
  let personal: { getDatosContrato: jest.Mock };
  let pdfGenerator: { generate: jest.Mock };
  let storage: {
    upload: jest.Mock;
    signedUrl: jest.Mock;
    download: jest.Mock;
    delete: jest.Mock;
  };
  let auditContext: AuditContext;
  let service: ContractService;

  beforeEach(() => {
    plantillas = { findById: jest.fn() };
    contratos = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmpleadoId: jest.fn(),
      findLatestVersion: jest.fn(),
      findVersion: jest.fn(),
      createVersion: jest.fn(),
    };
    personal = { getDatosContrato: jest.fn() };
    pdfGenerator = { generate: jest.fn() };
    storage = {
      upload: jest.fn(),
      signedUrl: jest.fn(),
      download: jest.fn(),
      delete: jest.fn(),
    };
    auditContext = new AuditContext();
    service = new ContractService(
      plantillas as unknown as PlantillaRepository,
      contratos as unknown as ContratoRepository,
      personal as unknown as PersonalDataPort,
      pdfGenerator as unknown as PdfGeneratorPort,
      storage as unknown as ContratoStoragePort,
      auditContext,
    );
  });

  it('genera una vista previa efímera sustituyendo los placeholders sin persistir', async () => {
    plantillas.findById.mockResolvedValue(plantilla());
    personal.getDatosContrato.mockResolvedValue(datos);

    const result = await service.preview({ plantillaId, empleadoId }, principal);

    expect(result).toMatchObject({
      contratoId: null,
      empleadoId,
      plantillaId,
      plantillaVersion: 2,
      variablesResueltas: [
        'nombre_empleado',
        'ci',
        'cargo',
        'remuneracion',
        'fecha_ingreso',
        'duracion_prueba',
      ],
      camposFaltantes: [],
      advertencias: [],
    });
    expect(result.htmlPreview).toBe(
      '<p>Ana Rojas|12345678|Analista|6000.00|2026-01-01|90 días</p>',
    );
    expect(personal.getDatosContrato).toHaveBeenCalledWith(empleadoId, principal);
    expect(contratos.create).not.toHaveBeenCalled();

    const auditSnapshot = auditContext.snapshot();
    expect(auditSnapshot.hasAfter).toBe(true);
    expect(auditSnapshot.after).not.toHaveProperty('htmlPreview');
  });

  it('deja la remuneración como campo faltante cuando el actor no puede verla', async () => {
    const sinSalario: DatosEmpleadoContrato = { ...datos };
    delete sinSalario.remuneracion;
    plantillas.findById.mockResolvedValue(plantilla());
    personal.getDatosContrato.mockResolvedValue(sinSalario);

    const result = await service.preview({ plantillaId, empleadoId }, principal);

    expect(result.htmlPreview).toContain('{{remuneracion}}');
    expect(result.camposFaltantes).toEqual(['remuneracion']);
    expect(result.advertencias[0]).toContain('personal:read_salary');
  });

  it('persiste el contrato con la versión vigente y un snapshot sin datos sensibles', async () => {
    const created: ContratoCreado = {
      id: contratoId,
      empleadoId,
      plantillaId,
      plantillaVersion: 2,
      estado: 'BORRADOR',
      creadoEn: new Date('2026-11-01T10:00:00.000Z'),
    };
    plantillas.findById.mockResolvedValue(plantilla());
    personal.getDatosContrato.mockResolvedValue(datos);
    contratos.create.mockResolvedValue(created);

    const result = await service.create(
      {
        plantillaId,
        empleadoId,
        fechaInicio: '2026-02-01',
        observacion: 'Alta de personal',
      },
      principal,
    );

    expect(result).toBe(created);
    expect(contratos.create).toHaveBeenCalledTimes(1);
    const data = contratos.create.mock.calls[0]?.[0];
    expect(data).toMatchObject({
      empleadoId,
      plantillaId,
      plantillaVersionId: versionId,
      fechaInicio: new Date('2026-02-01T00:00:00.000Z'),
      observacion: 'Alta de personal',
      creadoPor: principal.userId,
    });
    expect(data.empleadoSnapshot).toEqual({
      nombreEmpleado: 'Ana Rojas',
      cargo: 'Analista',
      fechaIngreso: '2026-01-01',
      duracionPrueba: '90 días',
      plantillaVersion: 2,
    });
    expect(data.empleadoSnapshot).not.toHaveProperty('ci');
    expect(data.empleadoSnapshot).not.toHaveProperty('remuneracion');
  });

  it('rechaza una plantilla inexistente o inactiva', async () => {
    plantillas.findById.mockResolvedValueOnce(null);
    await expect(
      service.preview({ plantillaId, empleadoId }, principal),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });

    plantillas.findById.mockResolvedValueOnce(plantilla({ activa: false }));
    await expect(
      service.preview({ plantillaId, empleadoId }, principal),
    ).rejects.toMatchObject({ response: { code: 'CONTR_PLANTILLA_INACTIVA' } });
  });

  it('rechaza una fecha de inicio imposible', async () => {
    plantillas.findById.mockResolvedValue(plantilla());
    personal.getDatosContrato.mockResolvedValue(datos);

    await expect(
      service.create(
        { plantillaId, empleadoId, fechaInicio: '2026-02-31' },
        principal,
      ),
    ).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
    expect(contratos.create).not.toHaveBeenCalled();
  });

  it('previsualiza un contrato persistido con la versión congelada', async () => {
    contratos.findById.mockResolvedValue(contratoDetalle());
    personal.getDatosContrato.mockResolvedValue(datos);

    const result = await service.previewById(contratoId, principal);

    expect(result).toMatchObject({
      contratoId,
      empleadoId,
      plantillaId,
      plantillaVersion: 2,
    });
    expect(result.htmlPreview).toContain('Ana Rojas');
    expect(contratos.findById).toHaveBeenCalledWith(contratoId);
  });

  it('responde 404 cuando el contrato a previsualizar no existe', async () => {
    contratos.findById.mockResolvedValue(null);

    await expect(service.previewById(contratoId, principal)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('lista los contratos del empleado con metadatos de sus versiones', async () => {
    const resumen = {
      id: contratoId,
      empleadoId,
      plantillaId,
      plantillaNombre: 'Contrato indefinido',
      plantillaVersion: 2,
      estado: 'EMITIDO' as const,
      versionVigente: 1,
      versiones: [
        {
          id: versionId,
          version: 1,
          estado: 'EMITIDO' as const,
          hashSha256: 'a'.repeat(64),
          firmadoTrabajador: true,
          firmadoRepresentante: true,
          creadoEn: new Date('2026-11-01T10:00:00.000Z'),
          documento: {
            publicIdRef: `${contratoId}/v1`,
            versionId,
            mime: 'application/pdf',
            bytes: 125000,
          },
        },
      ],
      creadoEn: new Date('2026-11-01T10:00:00.000Z'),
    };
    contratos.findByEmpleadoId.mockResolvedValue([resumen]);
    const lector: InternalPrincipal = {
      ...principal,
      permisos: [...principal.permisos, 'contrato:read'],
    };

    await expect(service.listarPorEmpleado(empleadoId, lector)).resolves.toEqual({
      data: [resumen],
      meta: { total: 1 },
    });
    expect(contratos.findByEmpleadoId).toHaveBeenCalledWith(empleadoId);
    expect(auditContext.snapshot().after).toEqual({
      empleadoId,
      total: 1,
      contratos: [{ id: contratoId, estado: 'EMITIDO', versionVigente: 1 }],
    });
  });

  it('responde 403 si el principal no tiene contrato:read', async () => {
    const sinPermiso: InternalPrincipal = { ...principal, permisos: [] };

    await expect(
      service.listarPorEmpleado(empleadoId, sinPermiso),
    ).rejects.toMatchObject({
      response: { code: 'FORBIDDEN' },
    });
    expect(contratos.findByEmpleadoId).not.toHaveBeenCalled();
  });

  it('responde 404 si no hay contratos registrados para el empleado', async () => {
    contratos.findByEmpleadoId.mockResolvedValue([]);
    const lector: InternalPrincipal = {
      ...principal,
      permisos: [...principal.permisos, 'contrato:read'],
    };

    await expect(service.listarPorEmpleado(empleadoId, lector)).rejects.toMatchObject({
      response: { code: 'NOT_FOUND' },
    });
  });

  it('rechaza firmas con mime-type o contenido no permitido', async () => {
    contratos.findById.mockResolvedValue(contratoDetalle());
    personal.getDatosContrato.mockResolvedValue(datos);
    contratos.findLatestVersion.mockResolvedValue(null);

    await expect(
      service.firmar(
        contratoId,
        {
          firmaTrabajador: {
            mimetype: 'image/gif',
            buffer: Buffer.from('not-an-image'),
          },
        },
        principal,
      ),
    ).rejects.toMatchObject({
      response: { code: 'CONTR_ARCHIVO_INVALIDO' },
    });

    expect(pdfGenerator.generate).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(contratos.createVersion).not.toHaveBeenCalled();
  });

  it('crea versiones sucesivas con nuevos publicId y metadatos de PDF', async () => {
    contratos.findById.mockResolvedValue(contratoDetalle());
    personal.getDatosContrato.mockResolvedValue(datos);
    contratos.findLatestVersion.mockResolvedValue(null);
    pdfGenerator.generate.mockResolvedValue(Buffer.from('%PDF-1.7'));
    let uploadCount = 0;
    storage.upload.mockImplementation(async (input) => {
      uploadCount += 1;
      return {
        publicId: `cloudinary-document-${uploadCount}`,
        providerVersion: `provider-${uploadCount}`,
        mimeType: input.mimeType,
        bytes: input.buffer.length,
      };
    });
    contratos.createVersion.mockImplementation(
      async (input: Parameters<ContratoRepository['createVersion']>[0]) => {
        const version = contratos.createVersion.mock.calls.length;
        const result: ContratoVersionDetalle = {
          id: `version-${version}`,
          contratoId,
          plantillaVersionId: versionId,
          version,
          estado: input.estado,
          documentoPublicId: input.documentoPublicId,
          documentoVersion: input.documentoVersion,
          documentoMime: input.documentoMime,
          documentoBytes: input.documentoBytes,
          hashSha256: input.hashSha256,
          firmadoTrabajador: false,
          firmadoRepresentante: false,
          firmaTrabajadorRef: null,
          firmaTrabajadorVersion: null,
          firmaTrabajadorMime: null,
          firmaTrabajadorBytes: null,
          firmaRepresentanteRef: null,
          firmaRepresentanteVersion: null,
          firmaRepresentanteMime: null,
          firmaRepresentanteBytes: null,
          generadoPor: principal.userId,
          generadoEn: new Date('2026-11-01T10:00:00.000Z'),
        };
        return result;
      },
    );

    const first = await service.generatePdf(
      contratoId,
      {},
      {},
      principal,
    );
    const second = await service.generatePdf(
      contratoId,
      {},
      {},
      principal,
    );

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(contratos.createVersion).toHaveBeenCalledTimes(2);
    expect(contratos.createVersion.mock.calls[0]?.[0]).toMatchObject({
      documentoPublicId: 'cloudinary-document-1',
      documentoVersion: 'provider-1',
      documentoMime: 'application/pdf',
      documentoBytes: Buffer.byteLength('%PDF-1.7'),
      hashSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      generadoPor: principal.userId,
    });
    expect(contratos.createVersion.mock.calls[1]?.[0]).toMatchObject({
      documentoPublicId: 'cloudinary-document-2',
      documentoVersion: 'provider-2',
    });
    expect(contratos.createVersion.mock.calls[1]?.[0].documentoPublicId).not.toBe(
      contratos.createVersion.mock.calls[0]?.[0].documentoPublicId,
    );
  });

  it('persiste publicId, versión y metadatos de una firma sin reemplazarla', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    contratos.findById.mockResolvedValue(contratoDetalle());
    personal.getDatosContrato.mockResolvedValue(datos);
    contratos.findLatestVersion.mockResolvedValue(null);
    pdfGenerator.generate.mockResolvedValue(Buffer.from('%PDF-1.7'));
    storage.upload.mockImplementation(async (input) => ({
      publicId: input.kind === 'firma' ? 'signature-public-id' : 'pdf-public-id',
      providerVersion: input.kind === 'firma' ? 'signature-provider-version' : 'pdf-provider-version',
      mimeType: input.mimeType,
      bytes: input.buffer.length,
    }));
    contratos.createVersion.mockImplementation(
      async (input: Parameters<ContratoRepository['createVersion']>[0]) => ({
        id: 'version-with-signature',
        contratoId,
        plantillaVersionId: versionId,
        version: 1,
        estado: input.estado,
        documentoPublicId: input.documentoPublicId,
        documentoVersion: input.documentoVersion,
        documentoMime: input.documentoMime,
        documentoBytes: input.documentoBytes,
        hashSha256: input.hashSha256,
        firmadoTrabajador: input.firmadoTrabajador,
        firmadoRepresentante: input.firmadoRepresentante,
        firmaTrabajadorRef: input.firmaTrabajadorRef,
        firmaTrabajadorVersion: input.firmaTrabajadorVersion,
        firmaTrabajadorMime: input.firmaTrabajadorMime,
        firmaTrabajadorBytes: input.firmaTrabajadorBytes,
        firmaRepresentanteRef: input.firmaRepresentanteRef,
        firmaRepresentanteVersion: input.firmaRepresentanteVersion,
        firmaRepresentanteMime: input.firmaRepresentanteMime,
        firmaRepresentanteBytes: input.firmaRepresentanteBytes,
        generadoPor: principal.userId,
        generadoEn: new Date('2026-11-01T10:00:00.000Z'),
      }),
    );

    await service.firmar(
      contratoId,
      { firmaTrabajador: { mimetype: 'image/png', buffer: png } },
      principal,
    );

    expect(contratos.createVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        firmaTrabajadorRef: 'signature-public-id',
        firmaTrabajadorVersion: 'signature-provider-version',
        firmaTrabajadorMime: 'image/png',
        firmaTrabajadorBytes: png.length,
        firmaRepresentanteRef: null,
        firmaRepresentanteVersion: null,
        firmaRepresentanteMime: null,
        firmaRepresentanteBytes: null,
      }),
    );
    expect(storage.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'firma',
        buffer: png,
        mimeType: 'image/png',
      }),
    );
  });

  it('autoriza descarga propia y oculta contratos ajenos a download_own', async () => {
    const owner: InternalPrincipal = {
      ...principal,
      empleadoId,
      permisos: ['contrato:download_own'],
    };
    contratos.findById.mockResolvedValue(contratoDetalle());
    contratos.findLatestVersion.mockResolvedValue({
      id: versionId,
      contratoId,
      plantillaVersionId: versionId,
      version: 1,
      estado: 'GENERADO',
      documentoPublicId: 'document-public-id',
      documentoVersion: 'provider-version',
      documentoMime: 'application/pdf',
      documentoBytes: 128,
      hashSha256: 'hash',
      firmadoTrabajador: false,
      firmadoRepresentante: false,
      firmaTrabajadorRef: null,
      firmaTrabajadorVersion: null,
      firmaTrabajadorMime: null,
      firmaTrabajadorBytes: null,
      firmaRepresentanteRef: null,
      firmaRepresentanteVersion: null,
      firmaRepresentanteMime: null,
      firmaRepresentanteBytes: null,
      generadoPor: principal.userId,
      generadoEn: new Date('2026-11-01T10:00:00.000Z'),
    });
    storage.signedUrl.mockResolvedValue({
      url: 'https://cloudinary.example/temporary',
      expiresInSeconds: 300,
    });

    await expect(service.getUltimaDescarga(contratoId, owner)).resolves.toEqual({
      url: 'https://cloudinary.example/temporary',
      expiresInSeconds: 300,
      versionId,
    });
    expect(storage.signedUrl).toHaveBeenCalledWith(
      'document-public-id',
      'documento',
      'pdf',
    );

    await expect(
      service.getUltimaDescarga(contratoId, {
        ...owner,
        empleadoId: '99999999-9999-4999-8999-999999999999',
      }),
    ).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
  });
});
