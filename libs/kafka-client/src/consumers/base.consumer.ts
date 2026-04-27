import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload, ConsumerConfig } from 'kafkajs';

export interface ConsumerConfigInput {
  clientId: string;
  brokers: string[];
  groupId: string;
  fromBeginning?: boolean;
  sessionTimeout?: number;
  heartbeatInterval?: number;
}

export type MessageHandler = (
  topic: string,
  partition: number,
  offset: string,
  key: string | null,
  value: any,
  headers: Record<string, string>,
) => Promise<void>;

@Injectable()
export class BaseConsumer implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(BaseConsumer.name);
  private kafka: Kafka;
  private consumer: Consumer;
  private connected = false;
  private handlers = new Map<string, MessageHandler>();
  private subscribedTopics: string[] = [];

  constructor(@Inject('KAFKA_CONSUMER_CONFIG') private readonly config: ConsumerConfigInput) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
    });
    this.consumer = this.kafka.consumer({
      groupId: config.groupId,
      sessionTimeout: config.sessionTimeout ?? 30000,
      heartbeatInterval: config.heartbeatInterval ?? 3000,
      allowAutoTopicCreation: false,
      maxBytesPerPartition: 5242880, // 5MB
      readUncommitted: false,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.logger.log(`Consumer ${this.config.groupId} connecting to Kafka`);
    await this.consumer.connect();
    this.connected = true;
    this.logger.log('Kafka consumer connected');
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.consumer.disconnect();
    this.connected = false;
    this.logger.log('Kafka consumer disconnected');
  }

  async subscribe(topic: string, handler: MessageHandler): Promise<void> {
    this.handlers.set(topic, handler);
    this.subscribedTopics.push(topic);

    await this.consumer.subscribe({
      topic,
      fromBeginning: this.config.fromBeginning ?? false,
    });

    this.logger.log(`Subscribed to topic: ${topic}`);
  }

  async run(): Promise<void> {
    if (this.subscribedTopics.length === 0) {
      this.logger.warn('No topics subscribed. Call subscribe() before run().');
      return;
    }

    await this.consumer.run({
      autoCommitInterval: 5000,
      eachMessage: async (payload: EachMessagePayload) => {
        const { topic, partition, message } = payload;
        const handler = this.handlers.get(topic);

        if (!handler) {
          this.logger.warn(`No handler registered for topic: ${topic}`);
          return;
        }

        try {
          const value = message.value ? JSON.parse(message.value.toString()) : null;
          const headers = this.parseHeaders(message.headers);
          const key = message.key?.toString() ?? null;

          await handler(topic, partition, message.offset, key, value, headers);
        } catch (error) {
          this.logger.error(
            `Error processing ${topic}[${partition}]@${message.offset}: ${(error as Error).message}`,
          );
          // Message will be re-delivered if auto-commit hasn't fired yet.
          // Non-retryable errors should be caught in the handler and logged.
        }
      },
    });

    this.logger.log(`Consumer running on topics: ${this.subscribedTopics.join(', ')}`);
  }

  async pause(): Promise<void> {
    for (const topic of this.subscribedTopics) {
      await this.consumer.pause([{ topic }]);
      this.logger.log(`Paused topic: ${topic}`);
    }
  }

  async resume(): Promise<void> {
    for (const topic of this.subscribedTopics) {
      this.consumer.resume([{ topic }]);
      this.logger.log(`Resumed topic: ${topic}`);
    }
  }

  async seek(topic: string, partition: number, offset: string): Promise<void> {
    await this.consumer.seek({ topic, partition, offset });
  }

  private parseHeaders(headers: any): Record<string, string> {
    if (!headers) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      result[key] = value?.toString() ?? '';
    }
    return result;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
