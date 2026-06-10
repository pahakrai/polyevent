import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'booking-service' };
  }

  @Get('ready')
  ready() {
    return { status: 'ready', timestamp: new Date().toISOString(), checks: { booking: 'up' } };
  }
}
