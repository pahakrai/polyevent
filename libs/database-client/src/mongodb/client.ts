import { Injectable, Logger, Inject, Optional } from '@nestjs/common';

export interface MongoDBClientConfig {
  uri: string;
  dbName?: string;
}

export const MONGODB_CLIENT_CONFIG = 'MONGODB_CLIENT_CONFIG';

/**
 * MongoDB client using Mongoose for connection management.
 * Provides connection lifecycle and basic query operations.
 */
@Injectable()
export class MongoDBClient {
  private readonly logger = new Logger(MongoDBClient.name);
  private mongoose: any;
  private connection: any;

  constructor(
    @Optional() @Inject(MONGODB_CLIENT_CONFIG) private readonly config?: MongoDBClientConfig,
  ) {}

  async connect(uri?: string): Promise<void> {
    try {
      this.mongoose = require('mongoose');
      const connectionUri = uri || this.config?.uri;

      if (!connectionUri) {
        throw new Error('MongoDB connection URI not provided');
      }

      await this.mongoose.connect(connectionUri, {
        dbName: this.config?.dbName,
      });

      this.connection = this.mongoose.connection;
      this.logger.log('Connected to MongoDB');
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.mongoose) {
      await this.mongoose.disconnect();
      this.logger.log('Disconnected from MongoDB');
    }
  }

  isConnected(): boolean {
    return this.mongoose?.connection?.readyState === 1;
  }

  getModel(name: string, schema?: any): any {
    if (!this.mongoose) {
      throw new Error('MongoDB not connected. Call connect() first.');
    }
    if (schema) {
      const mongooseSchema = new this.mongoose.Schema(schema.definition, schema.options);
      return this.mongoose.model(name, mongooseSchema);
    }
    return this.mongoose.model(name);
  }

  async find(collection: string, filter: any = {}): Promise<any[]> {
    const model = this.getModel(collection);
    return model.find(filter).exec();
  }

  async insert(collection: string, document: any): Promise<any> {
    const model = this.getModel(collection);
    return model.create(document);
  }

  getClient(): any {
    return this.mongoose;
  }
}
