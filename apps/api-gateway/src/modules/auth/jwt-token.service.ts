import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JwtPayload } from 'common-dtos';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class JwtTokenService {
  private readonly publicKey: string;
  private readonly issuer?: string;
  private readonly audience?: string;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('JWT_PUBLIC_KEY');

    if (!rawKey) {
      throw new Error('JWT_PUBLIC_KEY no configurada. Revise el archivo .env.');
    }

    this.publicKey = rawKey.includes('BEGIN PUBLIC KEY')
      ? rawKey.replace(/\\n/g, '\n')
      : Buffer.from(rawKey, 'base64').toString('utf8');

    this.issuer = this.configService.get<string>('JWT_ISSUER');
    this.audience = this.configService.get<string>('JWT_AUDIENCE');
  }

  verify(token: string): JwtPayload {
    const options: jwt.VerifyOptions = { algorithms: ['RS256'] };

    if (this.issuer) {
      options.issuer = this.issuer;
    }
    if (this.audience) {
      options.audience = this.audience;
    }

    try {
      return jwt.verify(token, this.publicKey, options) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
