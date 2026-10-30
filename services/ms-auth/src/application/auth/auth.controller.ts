import { Controller, NotImplementedException, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Inicio de sesión (pendiente de implementación)' })
  login(): never {
    throw new NotImplementedException('Inicio de sesión pendiente de implementación');
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Renovación de token (pendiente de implementación)' })
  refresh(): never {
    throw new NotImplementedException('Renovación de token pendiente de implementación');
  }
}
