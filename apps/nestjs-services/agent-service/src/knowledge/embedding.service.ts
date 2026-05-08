import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private readonly logger = new Logger(EmbeddingService.name);
  private pipeline: unknown = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';

  async onModuleInit() {
    this.logger.log(`Loading embedding model: ${this.modelName} (first call lazy-loads)`);
  }

  private async getPipeline() {
    if (this.pipeline) return this.pipeline;
    try {
      // Use require so webpack externals (nodeExternals) can externalize this properly
      const { pipeline } = require('@xenova/transformers');
      this.pipeline = await pipeline('feature-extraction', this.modelName);
      this.logger.log(`Embedding model ${this.modelName} loaded`);
      return this.pipeline;
    } catch (err) {
      this.logger.error(`Failed to load embedding model, using zero vectors`, err as Error);
      return null;
    }
  }

  /** Generate a single embedding vector (384-dim). */
  async embed(text: string): Promise<number[]> {
    const pipe = await this.getPipeline();
    if (!pipe) return new Array(384).fill(0);
    const result = await (pipe as any)(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  /** Batch-embed multiple texts. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const pipe = await this.getPipeline();
    if (!pipe) return texts.map(() => new Array(384).fill(0));
    const result = await (pipe as any)(texts, { pooling: 'mean', normalize: true });
    const dim = 384;
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      vectors.push(Array.from(result.data.slice(i * dim, (i + 1) * dim)));
    }
    return vectors;
  }
}
