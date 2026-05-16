import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('GET /health', () => {
    it('returns healthy status with service name and timestamp', () => {
      const result = controller.check();
      expect(result.status).toBe('healthy');
      expect(result.service).toBe('agent-service');
      expect(result.timestamp).toBeDefined();
      expect(() => new Date(result.timestamp)).not.toThrow();
    });
  });

  describe('GET /health/ready', () => {
    it('returns ready status with agent check up', () => {
      const result = controller.ready();
      expect(result.status).toBe('ready');
      expect(result.service).toBe('agent-service');
      expect(result.checks.agent).toBe('up');
    });
  });
});
