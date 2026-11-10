import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync } from 'node:fs';
import { launch, type Browser } from 'puppeteer-core';
import type { PdfGeneratorPort } from '../../domain/contracts/pdf-generator.port';

const DEFAULT_TIMEOUT_MS = 2_900;

/** Rutas habituales de Chromium/Chrome cuando no se define la variable de entorno. */
const CANDIDATE_EXECUTABLES = [
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

const DOCKER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

/**
 * Adaptador Puppeteer para renderizar el HTML ya interpolado a PDF.
 *
 * El navegador se reutiliza entre peticiones para acercarse al objetivo de
 * < 3 s. Si se desconecta, se relanza de forma perezosa. Los flags
 * `--no-sandbox` y `--disable-setuid-sandbox` son obligatorios en Docker.
 */
@Injectable()
export class PuppeteerPdfGeneratorService implements PdfGeneratorPort, OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerPdfGeneratorService.name);
  private readonly executablePath?: string;
  private readonly timeoutMs: number;
  private browserPromise?: Promise<Browser>;

  constructor(private readonly configService: ConfigService) {
    this.executablePath = this.resolveExecutablePath();
    this.timeoutMs = this.resolveTimeout();
  }

  async generate(html: string): Promise<Buffer> {
    const deadline = Date.now() + this.timeoutMs;
    const browser = await this.withinDeadline(this.getBrowser(), deadline);
    const page = await this.withinDeadline(browser.newPage(), deadline);
    try {
      page.setDefaultTimeout(this.remainingMs(deadline));
      await this.withinDeadline(
        page.setContent(html, {
          waitUntil: 'load',
          timeout: this.remainingMs(deadline),
        }),
        deadline,
      );
      const pdf = await this.withinDeadline(
        page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
        }),
        deadline,
      );
      return Buffer.from(pdf);
    } finally {
      await page.close().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'error desconocido';
        this.logger.warn(`No se pudo cerrar la página de PDF: ${message}`);
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.browserPromise) return;
    try {
      const browser = await this.browserPromise;
      await browser.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'error desconocido';
      this.logger.warn(`No se pudo cerrar Chromium: ${message}`);
    } finally {
      this.browserPromise = undefined;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = launch({
        headless: true,
        timeout: this.timeoutMs,
        ...(this.executablePath ? { executablePath: this.executablePath } : {}),
        args: DOCKER_ARGS,
      });
    }

    try {
      const browser = await this.browserPromise;
      if (browser.connected) return browser;
    } catch (error) {
      this.browserPromise = undefined;
      throw error;
    }

    this.logger.warn('El navegador de PDF se desconectó; se relanza.');
    this.browserPromise = undefined;
    return this.getBrowser();
  }

  private resolveExecutablePath(): string | undefined {
    const configured =
      this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH') ??
      this.configService.get<string>('CHROME_BIN');
    if (configured && configured.trim().length > 0) return configured.trim();

    return CANDIDATE_EXECUTABLES.find((candidate) => existsSync(candidate));
  }

  private resolveTimeout(): number {
    const raw = Number(this.configService.get<string>('PUPPETEER_TIMEOUT_MS'));
    return Number.isFinite(raw) && raw > 0
      ? Math.min(DEFAULT_TIMEOUT_MS, Math.floor(raw))
      : DEFAULT_TIMEOUT_MS;
  }

  private remainingMs(deadline: number): number {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error('La generación del PDF superó el límite de tiempo.');
    return remaining;
  }

  private async withinDeadline<T>(operation: Promise<T>, deadline: number): Promise<T> {
    const timeoutMs = this.remainingMs(deadline);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<T>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('La generación del PDF superó el límite de tiempo.')),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}
