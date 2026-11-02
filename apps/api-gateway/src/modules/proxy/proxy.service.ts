import { Injectable, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import * as http from 'node:http';
import * as https from 'node:https';
import { sendError } from '../../rbac/http-error';

export interface ProxyForwardOptions {
  targetBaseUrl: string;
  destinationPath: string;
  search: string;
  method: string;
  headers: http.OutgoingHttpHeaders;
  traceId: string;
}

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);

  forward(request: Request, response: Response, options: ProxyForwardOptions): void {
    let targetUrl: URL;
    try {
      targetUrl = new URL(`${options.destinationPath}${options.search}`, options.targetBaseUrl);
    } catch {
      sendError(
        response,
        502,
        'INTERNAL_ERROR',
        'Servicio no disponible.',
        options.traceId,
      );
      return;
    }

    const transport = targetUrl.protocol === 'https:' ? https : http;
    const headers = { ...options.headers };
    delete headers.host;
    delete headers['content-length'];
    delete headers.connection;

    const proxyRequest = transport.request(
      targetUrl,
      {
        method: options.method,
        headers,
      },
      (proxyResponse) => {
        response.writeHead(proxyResponse.statusCode ?? 502, proxyResponse.headers);
        proxyResponse.pipe(response);
      },
    );

    proxyRequest.on('error', (error: Error) => {
      this.logger.error(
        `Error de proxy ${options.method} ${options.destinationPath}: ${error.message}`,
      );
      sendError(
        response,
        502,
        'INTERNAL_ERROR',
        'Servicio no disponible.',
        options.traceId,
      );
    });

    if (!this.writeParsedBody(request, proxyRequest)) {
      request.pipe(proxyRequest);
    }
  }

  private writeParsedBody(request: Request, proxyRequest: http.ClientRequest): boolean {
    const body = request.body as unknown;

    if (body === undefined || request.method === 'GET' || request.method === 'HEAD') {
      return false;
    }

    const serialized =
      request.is('application/x-www-form-urlencoded') && typeof body === 'object' && body !== null
        ? new URLSearchParams(body as Record<string, string>).toString()
        : JSON.stringify(body);

    proxyRequest.setHeader('content-length', Buffer.byteLength(serialized));
    proxyRequest.write(serialized);
    proxyRequest.end();

    return true;
  }
}
