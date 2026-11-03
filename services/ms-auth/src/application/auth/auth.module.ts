import { Module } from '@nestjs/common';
import { AUTH_REPOSITORY, PASSWORD_HASHER, TOKEN_SERVICE } from '../../domain/auth/auth.ports';
import { PrismaAuthRepository } from '../../infrastructure/prisma/repositories/prisma-auth.repository';
import { ArgonPasswordHasher } from '../../infrastructure/security/argon-password-hasher';
import { Rs256TokenService } from '../../infrastructure/security/rs256-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { USER_REPOSITORY } from '../../domain/users/user.ports';
import { PrismaUserRepository } from '../../infrastructure/prisma/repositories/prisma-user.repository';
import { RoleController } from '../users/role.controller';
import { UserController } from '../users/user.controller';
import { UserService } from '../users/user.service';

@Module({
  controllers: [AuthController, UserController, RoleController],
  providers: [
    AuthService,
    UserService,
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: PASSWORD_HASHER, useClass: ArgonPasswordHasher },
    { provide: TOKEN_SERVICE, useClass: Rs256TokenService },
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
  ],
})
export class AuthModule {}
