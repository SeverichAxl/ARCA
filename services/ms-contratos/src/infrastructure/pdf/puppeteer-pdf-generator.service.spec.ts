import type { ConfigService } from '@nestjs/config';
import { launch, type Browser } from 'puppeteer-core';
import { PuppeteerPdfGeneratorService } from './puppeteer-pdf-generator.service';

jest.mock('puppeteer-core', () => ({ launch: jest.fn() }));

describe('PuppeteerPdfGeneratorService', () => {
  const pdf = Buffer.from('%PDF-1.7');
  const page = {
    setDefaultTimeout: jest.fn(),
    setContent: jest.fn().mockResolvedValue(undefined),
    pdf: jest.fn().mockResolvedValue(pdf),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const browser = {
    connected: true,
    newPage: jest.fn().mockResolvedValue(page),
    close: jest.fn().mockResolvedValue(undefined),
  } as unknown as Browser;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(launch).mockResolvedValue(browser);
  });

  it('renderiza PDF con Chromium y flags compatibles con Docker', async () => {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'PUPPETEER_EXECUTABLE_PATH' ? '/usr/bin/chromium' : undefined,
      ),
    } as unknown as ConfigService;
    const service = new PuppeteerPdfGeneratorService(configService);

    await expect(service.generate('<html><body>Contrato</body></html>')).resolves.toEqual(
      pdf,
    );

    expect(launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        executablePath: '/usr/bin/chromium',
        args: expect.arrayContaining(['--no-sandbox', '--disable-setuid-sandbox']),
      }),
    );
    expect(page.setContent).toHaveBeenCalledWith(
      '<html><body>Contrato</body></html>',
      expect.objectContaining({ waitUntil: 'load' }),
    );
    expect(page.pdf).toHaveBeenCalled();
    expect(page.close).toHaveBeenCalled();
  });
});
