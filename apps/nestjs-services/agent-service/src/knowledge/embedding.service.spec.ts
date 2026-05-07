import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';

// @xenova/transformers is a heavy ESM module — mock it entirely
jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn(),
}));

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockPipeline: jest.Mock;

  beforeEach(async () => {
    mockPipeline = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const transformers = require('@xenova/transformers');
    transformers.pipeline.mockResolvedValue(mockPipeline);

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmbeddingService],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  describe('embed', () => {
    it('returns a 384-dim embedding vector', async () => {
      const vec = new Float32Array(384).fill(0.05);
      mockPipeline.mockResolvedValue({ data: vec });

      const result = await service.embed('test text');
      expect(result).toHaveLength(384);
      expect(result[0]).toBeCloseTo(0.05, 5);
    });
  });

  describe('embedBatch', () => {
    it('returns multiple 384-dim vectors', async () => {
      const data = new Float32Array(384 * 3).fill(0.03);
      mockPipeline.mockResolvedValue({ data });

      const results = await service.embedBatch(['a', 'b', 'c']);
      expect(results).toHaveLength(3);
      expect(results[0]).toHaveLength(384);
      expect(results[1]).toHaveLength(384);
      expect(results[2]).toHaveLength(384);
    });
  });
});
