import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, LogoutDto, RefreshDto } from './auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Public()
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
  @Public()
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiOperation({ summary: 'Revocar la familia del refresh token' })
  logout(@Body() dto: LogoutDto) {
    return this.service.logout(dto.refreshToken);
  }
}
