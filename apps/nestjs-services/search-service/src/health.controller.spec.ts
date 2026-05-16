import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { VectorService } from './vector/vector.service';

describe('HealthController', () => {
  let controller: HealthController;
  let mockIsConnected: boolean;

  beforeEach(async () => {
    mockIsConnected = true;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: VectorService,
          useValue: { get isConnected() { return mockIsConnected; } },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health', () => {
    it('returns ok status with timestamp', () => {
      const result = controller.check();
      expect(result.status).toBe('ok');
      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });

  describe('GET /health/ready', () => {
    it('returns ready when pgvector is connected', () => {
      mockIsConnected = true;
      const result = controller.ready();
      expect(result.status).toBe('ready');
      expect(result.checks.pgvector).toBe('up');
    });

    it('returns degraded when pgvector is down', () => {
      mockIsConnected = false;
      const result = controller.ready();
      expect(result.status).toBe('degraded');
      expect(result.checks.pgvector).toBe('down');
    });

    it('includes valid ISO timestamp', () => {
      const result = controller.ready();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });
});
