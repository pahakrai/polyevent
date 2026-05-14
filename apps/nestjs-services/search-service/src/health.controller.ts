import { Controller, Get } from '@nestjs/common';
import { VectorService } from './vector/vector.service';

@Controller('health')
export class HealthController {
  constructor(private readonly vectorService: VectorService) {}

  @Get()
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  ready() {
    const pgvector = this.vectorService.isConnected ? 'up' : 'down';
    const allUp = pgvector === 'up';
    return {
      status: allUp ? 'ready' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: {
        pgvector,
      },
    };
  }
}
