import { Module } from '@nestjs/common';
import { AUTH_REPOSITORY, PASSWORD_HASHER, TOKEN_SERVICE } from '../../domain/auth/auth.ports';
import { PrismaAuthRepository } from '../../infrastructure/prisma/repositories/prisma-auth.repository';
import { ArgonPasswordHasher } from '../../infrastructure/security/argon-password-hasher';
import { Rs256TokenService } from '../../infrastructure/security/rs256-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: PASSWORD_HASHER, useClass: ArgonPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: Rs256TokenService },
  ],
})
export class AuthModule {}
