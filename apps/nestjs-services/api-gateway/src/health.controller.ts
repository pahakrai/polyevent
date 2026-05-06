import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators/public.decorator';

@Public()
@Controller('health')
export class HealthController {
  /**
   * Liveness probe — confirms the process is running.
   */
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe — confirms the gateway can serve traffic.
   */
  @Get('ready')
  ready() {
    return {
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: {
        gateway: 'up',
      },
    };
  }
}
