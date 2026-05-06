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
    // Dynamic import to avoid blocking startup
    const { pipeline } = await import('@xenova/transformers');
    this.pipeline = await pipeline('feature-extraction', this.modelName);
    this.logger.log(`Embedding model ${this.modelName} loaded`);
    return this.pipeline;
  }

  /** Generate a single embedding vector (384-dim). */
  async embed(text: string): Promise<number[]> {
    const pipe = (await this.getPipeline()) as {
      (text: string, options: { pooling: string; normalize: boolean }): Promise<{ data: Float32Array }>;
    };
    const result = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  /** Batch-embed multiple texts. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    const pipe = (await this.getPipeline()) as {
      (texts: string[], options: { pooling: string; normalize: boolean }): Promise<{ data: Float32Array }>;
    };
    const result = await pipe(texts, { pooling: 'mean', normalize: true });
    const dim = 384;
    const vectors: number[][] = [];
    for (let i = 0; i < texts.length; i++) {
      vectors.push(Array.from(result.data.slice(i * dim, (i + 1) * dim)));
    }
    return vectors;
  }
}
