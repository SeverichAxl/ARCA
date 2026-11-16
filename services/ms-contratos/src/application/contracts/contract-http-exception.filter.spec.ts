import { NotFoundException } from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { ContractHttpExceptionFilter } from './contract-http-exception.filter';

describe('ContractHttpExceptionFilter', () => {
  it('responde con el envelope estándar y conserva el trace id entrante', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-request-id': 'qa-trace-312' } }),
        getResponse: () => ({ status }),
      }),
    } as unknown as ArgumentsHost;

    new ContractHttpExceptionFilter().catch(
      new NotFoundException({ code: 'NOT_FOUND', message: 'Contrato no encontrado.' }),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Contrato no encontrado.',
      traceId: 'qa-trace-312',
    });
  });
});
