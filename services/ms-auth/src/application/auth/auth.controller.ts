import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { SkipAudit } from '@arca/audit';
import { CurrentPrincipal, type InternalPrincipal } from '@arca/internal-auth';
import { AuthenticatedOnly } from '../../common/decorators/authenticated-only.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, LogoutDto, RefreshDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
  @SkipAudit()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Iniciar sesión y emitir tokens RS256' })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.service.login(dto, {
      ipOrigen: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Public()
  @SkipAudit()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotar refresh token y renovar el access token' })
  refresh(@Body() dto: RefreshDto, @Req() request: Request) {
    return this.service.refresh(dto.refreshToken, {
      ipOrigen: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }

  @Post('logout')
  @AuthenticatedOnly()
  @SkipAudit()
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Revocar la familia del refresh token' })
  logout(
    @Body() dto: LogoutDto,
    @Req() request: Request,
    @CurrentPrincipal() principal?: InternalPrincipal,
  ) {
    return this.service.logout(
      dto.refreshToken,
      principal?.userId,
      principal?.empleadoId,
      {
        ipOrigen: request.ip,
        userAgent: request.headers['user-agent'],
      },
    );
  }
}
