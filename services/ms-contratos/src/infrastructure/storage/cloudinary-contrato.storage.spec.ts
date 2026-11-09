import { ConfigService } from '@nestjs/config';
import { CloudinaryContratoStorage } from './cloudinary-contrato.storage';

describe('CloudinaryContratoStorage', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sube cada PDF con un publicId nuevo y conserva los metadatos devueltos', async () => {
    const config = new ConfigService({
      CLOUDINARY_CLOUD_NAME: 'arca-test',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
    });
    const storage = new CloudinaryContratoStorage(config);
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ public_id: 'contracts/pdf-v1', version: 101, bytes: 7 }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ public_id: 'contracts/pdf-v2', version: 102, bytes: 7 }),
          { status: 200 },
        ),
      );

    const first = await storage.upload({
      buffer: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
      kind: 'documento',
      contratoId: 'contrato-1',
    });
    const second = await storage.upload({
      buffer: Buffer.from('%PDF-1.7'),
      mimeType: 'application/pdf',
      kind: 'documento',
      contratoId: 'contrato-1',
    });

    expect(first).toMatchObject({
      publicId: 'contracts/pdf-v1',
      providerVersion: '101',
      mimeType: 'application/pdf',
      bytes: 7,
    });
    expect(second).toMatchObject({
      publicId: 'contracts/pdf-v2',
      providerVersion: '102',
      mimeType: 'application/pdf',
      bytes: 7,
    });

    const requests = jest.mocked(global.fetch).mock.calls;
    const firstForm = requests[0]?.[1]?.body as FormData;
    const secondForm = requests[1]?.[1]?.body as FormData;
    expect(firstForm.get('public_id')).not.toBe(secondForm.get('public_id'));
    expect(firstForm.get('public_id')).toEqual(expect.any(String));
    expect(secondForm.get('public_id')).toEqual(expect.any(String));
    expect(requests).toHaveLength(2);
  });

  it('firma una descarga privada con timestamp y expiración de corta duración', async () => {
    const config = new ConfigService({
      CLOUDINARY_CLOUD_NAME: 'arca-test',
      CLOUDINARY_API_KEY: 'test-key',
      CLOUDINARY_API_SECRET: 'test-secret',
      CONTRATO_DOWNLOAD_TTL_SECONDS: '120',
    });
    const storage = new CloudinaryContratoStorage(config);

    const signed = await storage.signedUrl('contracts/contrato-1/pdf-1', 'documento', 'pdf');
    const url = new URL(signed.url);

    expect(url.pathname).toBe('/v1_1/arca-test/raw/download');
    expect(url.searchParams.get('public_id')).toBe('contracts/contrato-1/pdf-1');
    expect(url.searchParams.get('format')).toBe('pdf');
    expect(url.searchParams.get('type')).toBe('authenticated');
    expect(Number(url.searchParams.get('expires_at'))).toBeGreaterThan(
      Number(url.searchParams.get('timestamp')),
    );
    expect(url.searchParams.get('api_key')).toBe('test-key');
    expect(url.searchParams.get('signature')).toMatch(/^[a-f0-9]{40}$/);
    expect(signed.expiresInSeconds).toBe(120);
  });
});
