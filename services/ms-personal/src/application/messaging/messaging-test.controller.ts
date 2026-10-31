import { Controller, NotFoundException, Post } from '@nestjs/common';
import { OutboxService } from '@arca/messaging';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

@Controller('internal/events')
export class MessagingTestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  @Post('empleado-creado')
  @Public()
  async publishSample(): Promise<{ eventId: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new NotFoundException();
    }

    const payload = {
      empleadoId: '00000000-0000-4000-8000-000000000101',
      nombreCompleto: 'Evento de prueba ARCA',
      areaId: '00000000-0000-4000-8000-000000000002',
      jefeEmpleadoId: null,
      estado: 'RATIFICADO',
      fechaIngreso: '2025-01-15',
      fechaBaja: null,
    };

    const event = await this.prisma.$transaction((tx) =>
      this.outbox.add(tx, 'EMPLEADO_CREADO', payload),
    );
    return { eventId: event.eventId };
  }
}
