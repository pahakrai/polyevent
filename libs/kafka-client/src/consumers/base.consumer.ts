import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class BaseConsumer {
  protected readonly logger = new Logger(BaseConsumer.name);

  constructor() {}

  async connect(): Promise<void> {
    // TODO: Implement Kafka connection
    this.logger.log('Connecting to Kafka...');
  }

  async disconnect(): Promise<void> {
    // TODO: Implement Kafka disconnection
    this.logger.log('Disconnecting from Kafka...');
  }

  protected async subscribe(topic: string, handler: (message: any) => void): Promise<void> {
    // TODO: Implement topic subscription
    this.logger.log(`Subscribing to topic ${topic}`);
  }
}