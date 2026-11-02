import { Module } from '@nestjs/common';
import { InternalHeadersService } from './internal-headers.service';
import { JwtTokenService } from './jwt-token.service';

@Module({
  providers: [JwtTokenService, InternalHeadersService],
  exports: [JwtTokenService, InternalHeadersService],
})
export class AuthModule {}
