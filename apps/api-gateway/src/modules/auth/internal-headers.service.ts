import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  signInternalHeaders,
  type InternalPrincipal,
  type SignedInternalHeaders,
} from '@arca/internal-auth';
import { isPlaceholder } from './pem';

@Injectable()
export class InternalHeadersService {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('INTERNAL_HMAC_KEY');

    if (isPlaceholder(secret)) {
      throw new Error(
        'INTERNAL_HMAC_KEY es obligatoria y no puede ser un placeholder: el gateway no arranca sin ella.',
      );
    }

    this.secret = secret as string;
  }

  sign(
    method: string,
    path: string,
    principal: InternalPrincipal,
    timestamp: number = Date.now(),
  ): SignedInternalHeaders {
    return signInternalHeaders({
      secret: this.secret,
      method,
      path,
      principal,
      timestamp,
    });
  }
}
