import 'reflect-metadata';
import { AUDIT_METADATA_KEY } from '@arca/audit';
import { ANY_PERMISSIONS_KEY } from '../../common/decorators/require-any-permission.decorator';
import { PERMISSIONS_KEY } from '../../common/decorators/require-permission.decorator';
import type { InternalPrincipal } from '@arca/internal-auth';
import type {
  CreateContratoDto,
  GenerarPdfDatosDto,
  PreviewContratoDto,
} from './contract.dto';
import { ContractService } from './contract.service';
import { ContractsController } from './contracts.controller';

const principal: InternalPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  empleadoId: null,
  rol: 'RRHH_OPERATIVO',
  permisos: ['contrato:generate', 'contrato:read'],
};

const plantillaId = '22222222-2222-4222-8222-222222222222';
const empleadoId = '33333333-3333-4333-8333-333333333333';
const contratoId = '44444444-4444-4444-8444-444444444444';

const created = {
  id: contratoId,
  empleadoId,
  plantillaId,
  plantillaVersion: 1,
  estado: 'BORRADOR',
  creadoEn: new Date('2026-11-01T10:00:00.000Z'),
};

const preview = {
  contratoId: null,
  empleadoId,
  plantillaId,
  plantillaVersion: 1,
  htmlPreview: '<p>Ana Rojas</p>',
  variablesResueltas: ['nombre_empleado'],
  camposFaltantes: [],
  advertencias: [],
};

describe('ContractsController', () => {
  let service: {
    create: jest.Mock;
    preview: jest.Mock;
    previewById: jest.Mock;
    generatePdf: jest.Mock;
    firmar: jest.Mock;
    getDescarga: jest.Mock;
    getUltimaDescarga: jest.Mock;
    listarPorEmpleado: jest.Mock;
  };
  let controller: ContractsController;

  beforeEach(() => {
    service = {
      create: jest.fn(),
      preview: jest.fn(),
      previewById: jest.fn(),
      generatePdf: jest.fn(),
      firmar: jest.fn(),
      getDescarga: jest.fn(),
      getUltimaDescarga: jest.fn(),
      listarPorEmpleado: jest.fn(),
    };
    controller = new ContractsController(service as unknown as ContractService);
  });

  it('delega la creación con el actor autenticado', async () => {
    const dto: CreateContratoDto = { plantillaId, empleadoId };
    service.create.mockResolvedValue(created);

    await expect(controller.create(dto, principal)).resolves.toBe(created);
    expect(service.create).toHaveBeenCalledWith(dto, principal);
  });

  it('delega la vista previa efímera', async () => {
    const dto: PreviewContratoDto = { plantillaId, empleadoId };
    service.preview.mockResolvedValue(preview);

    await expect(controller.preview(dto, principal)).resolves.toBe(preview);
    expect(service.preview).toHaveBeenCalledWith(dto, principal);
  });

  it('delega la vista previa de un contrato persistido', async () => {
    const expected = { ...preview, contratoId };
    service.previewById.mockResolvedValue(expected);

    await expect(controller.previewById(contratoId, principal)).resolves.toBe(expected);
    expect(service.previewById).toHaveBeenCalledWith(contratoId, principal);
  });

  it('declara los permisos RBAC de contratos', () => {
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.create)).toEqual([
      'contrato:generate',
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.preview)).toEqual([
      'contrato:generate',
    ]);
    expect(
      Reflect.getMetadata(ANY_PERMISSIONS_KEY, ContractsController.prototype.previewById),
    ).toEqual(['contrato:generate', 'contrato:read']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.generatePdf),
    ).toEqual(['contrato:generate']);
    expect(
      Reflect.getMetadata(PERMISSIONS_KEY, ContractsController.prototype.firmar),
    ).toEqual(['contrato:generate']);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ContractsController.prototype.getLatestPdf,
      ),
    ).toEqual(['contrato:read', 'contrato:download_own']);
    expect(
      Reflect.getMetadata(
        ANY_PERMISSIONS_KEY,
        ContractsController.prototype.getVersionPdf,
      ),
    ).toEqual(['contrato:read', 'contrato:download_own']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ContractsController.prototype.listarPorEmpleado,
      ),
    ).toEqual(['contrato:read']);
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        ContractsController.prototype.listarPorEmpleadoAlias,
      ),
    ).toEqual(['contrato:read']);
  });

  it('audita la generación PDF y el registro de firmas', () => {
    expect(
      Reflect.getMetadata(AUDIT_METADATA_KEY, ContractsController.prototype.generatePdf),
    ).toEqual({ modulo: 'contratos', accion: 'CONTRATO_PDF_GENERAR' });
    expect(
      Reflect.getMetadata(AUDIT_METADATA_KEY, ContractsController.prototype.firmar),
    ).toEqual({ modulo: 'contratos', accion: 'CONTRATO_FIRMAR' });
  });

  it('parsea datos multipart y delega PDF con firmas opcionales', async () => {
    const workerSignature = {
      originalname: 'firma.png',
      mimetype: 'image/png',
      size: 8,
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    } as Express.Multer.File;
    service.generatePdf.mockResolvedValue(created);

    await controller.generatePdf(
      contratoId,
      { datos: '{"incluirFirmas":false}' },
      { firmaTrabajador: [workerSignature] },
      principal,
    );

    expect(service.generatePdf).toHaveBeenCalledWith(
      contratoId,
      { incluirFirmas: false } satisfies GenerarPdfDatosDto,
      {
        firmaTrabajador: {
          originalname: 'firma.png',
          mimetype: 'image/png',
          size: 8,
          buffer: workerSignature.buffer,
        },
      },
      principal,
    );
  });

  it('delega firma y descarga controlada al servicio', async () => {
    const files = {
      firmaRepresentante: [
        {
          originalname: 'firma.jpg',
          mimetype: 'image/jpeg',
          size: 3,
          buffer: Buffer.from([0xff, 0xd8, 0xff]),
        } as Express.Multer.File,
      ],
    };
    const response = { url: 'https://cloudinary.example/short-lived', versionId: contratoId };
    service.firmar.mockResolvedValue(created);
    service.getUltimaDescarga.mockResolvedValue(response);
    service.getDescarga.mockResolvedValue(response);

    await expect(controller.firmar(contratoId, files, principal)).resolves.toBe(created);
    expect(service.firmar).toHaveBeenCalledWith(
      contratoId,
      {
        firmaRepresentante: {
          originalname: 'firma.jpg',
          mimetype: 'image/jpeg',
          size: 3,
          buffer: files.firmaRepresentante[0]?.buffer,
        },
      },
      principal,
    );
    await expect(controller.getLatestPdf(contratoId, principal)).resolves.toBe(response);
    await expect(
      controller.getVersionPdf(contratoId, contratoId, principal),
    ).resolves.toBe(response);
  });

  it('delega la consulta por empleado tanto en la ruta nueva como en el alias', async () => {
    const response = { data: [], meta: { total: 0 } };
    service.listarPorEmpleado.mockResolvedValue(response);

    await expect(controller.listarPorEmpleado(empleadoId, principal)).resolves.toBe(
      response,
    );
    await expect(
      controller.listarPorEmpleadoAlias(empleadoId, principal),
    ).resolves.toBe(response);
    expect(service.listarPorEmpleado).toHaveBeenNthCalledWith(
      1,
      empleadoId,
      principal,
    );
    expect(service.listarPorEmpleado).toHaveBeenNthCalledWith(
      2,
      empleadoId,
      principal,
    );
    expect(
      Reflect.getMetadata(
        AUDIT_METADATA_KEY,
        ContractsController.prototype.listarPorEmpleado,
      ),
    ).toEqual({
      modulo: 'contratos',
      accion: 'CONTRATOS_POR_EMPLEADO_LISTAR',
    });
  });
});
