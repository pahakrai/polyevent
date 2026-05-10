import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class ElasticsearchClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ElasticsearchClient.name);
  private client: any = null;
  private readonly node: string;

  constructor() {
    this.node = process.env['ELASTICSEARCH_URL'] || 'http://localhost:9200';
  }

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    try {
      const { Client } = await import('@elastic/elasticsearch');
      this.client = new Client({ node: this.node });
      const info = await this.client.info();
      this.logger.log(
        `Connected to Elasticsearch ${info.version.number} at ${this.node}`,
      );
    } catch (error) {
      this.logger.warn(
        `Elasticsearch not available at ${this.node}: ${error}. Using no-op client.`,
      );
      this.client = null;
    }
  }

  async search(
    index: string,
    query: any,
  ): Promise<{ hits: { hits: any[]; total?: number } }> {
    if (!this.client) {
      this.logger.debug(`ES not connected — returning empty search for ${index}`);
      return { hits: { hits: [] } };
    }

    try {
      const result = await this.client.search({
        index,
        body: query,
      });
      return {
        hits: {
          hits: result.hits.hits,
          total: result.hits.total?.value || 0,
        },
      };
    } catch (error) {
      this.logger.error(`Search error on index ${index}: ${error}`);
      return { hits: { hits: [] } };
    }
  }

  async indexDocument(
    index: string,
    id: string,
    document: any,
  ): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.index({
        index,
        id,
        body: document,
        refresh: false,
      });
    } catch (error) {
      this.logger.error(`Index error for ${id} in ${index}: ${error}`);
    }
  }

  async bulkIndex(
    index: string,
    documents: Array<{ id: string; body: any }>,
  ): Promise<void> {
    if (!this.client || documents.length === 0) return;

    try {
      const body = documents.flatMap((doc) => [
        { index: { _index: index, _id: doc.id } },
        doc.body,
      ]);
      await this.client.bulk({ body, refresh: false });
      this.logger.debug(`Bulk indexed ${documents.length} docs into ${index}`);
    } catch (error) {
      this.logger.error(`Bulk index error on ${index}: ${error}`);
    }
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.delete({ index, id });
    } catch (error) {
      this.logger.error(`Delete error for ${id} in ${index}: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.logger.log('Disconnected from Elasticsearch');
    }
  }
}
