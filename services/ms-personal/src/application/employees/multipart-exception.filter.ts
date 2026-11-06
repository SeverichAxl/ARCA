import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  HttpStatus,
  PayloadTooLargeException,
  type ExceptionFilter,
} from '@nestjs/common';
import multer from 'multer';
import type { Response } from 'express';

@Catch(multer.MulterError, BadRequestException, PayloadTooLargeException)
export class MultipartExceptionFilter implements ExceptionFilter {
  catch(
    exception: multer.MulterError | BadRequestException | PayloadTooLargeException,
    host: ArgumentsHost,
  ): void {
    const response = host.switchToHttp().getResponse<Response>();
    const isMulter = exception instanceof multer.MulterError;
    const errorResponse = isMulter ? null : exception.getResponse();
    const message =
      typeof errorResponse === 'object' &&
      errorResponse !== null &&
      'message' in errorResponse
        ? errorResponse.message
        : errorResponse;
    const isMultipart =
      isMulter ||
      exception instanceof PayloadTooLargeException ||
      (typeof message === 'string' && message.startsWith('Multipart:'));

    if (isMultipart) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'PERS_ARCHIVO_INVALIDO',
        message: 'El archivo no es válido o supera el tamaño permitido.',
      });
      return;
    }

    response.status(exception.getStatus()).json(errorResponse);
  }
}
