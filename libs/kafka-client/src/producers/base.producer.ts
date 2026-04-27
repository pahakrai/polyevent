import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { Kafka, Producer, ProducerRecord, RecordMetadata, CompressionTypes } from 'kafkajs';

export interface ProducerConfig {
  clientId: string;
  brokers: string[];
  retry?: {
    retries: number;
    initialRetryTime?: number;
  };
}

@Injectable()
export class BaseProducer implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(BaseProducer.name);
  private kafka: Kafka;
  private producer: Producer;
  private connected = false;
  private readonly deadLetterSuffix = '.dlq';

  constructor(@Inject('KAFKA_PRODUCER_CONFIG') private readonly config: ProducerConfig) {
    this.kafka = new Kafka({
      clientId: config.clientId,
      brokers: config.brokers,
      retry: config.retry ?? { retries: 5, initialRetryTime: 300 },
    });
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: false,
      maxInFlightRequests: 5,
      idempotent: true,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.connect();
    } catch (error) {
      this.logger.warn(`Failed to connect to Kafka (non-blocking): ${(error as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.logger.log(`Connecting to Kafka brokers: ${this.config.brokers.join(',')}`);
    await this.producer.connect();
    this.connected = true;
    this.logger.log('Kafka producer connected');
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.producer.disconnect();
    this.connected = false;
    this.logger.log('Kafka producer disconnected');
  }

  async send(topic: string, messages: any | any[], key?: string): Promise<RecordMetadata[]> {
    if (!this.connected) {
      this.logger.warn(`Cannot send to ${topic}: producer not connected`);
      return [];
    }

    const msgs = Array.isArray(messages) ? messages : [messages];

    const record: ProducerRecord = {
      topic,
      messages: msgs.map((msg, i) => ({
        key: key ?? (msg.userId || msg.eventId || msg.bookingId || undefined),
        value: JSON.stringify(msg),
        headers: {
          'content-type': 'application/json',
          'produced-at': new Date().toISOString(),
          'message-index': String(i),
        },
      })),
    };

    try {
      const result = await this.producer.send({
        ...record,
        compression: CompressionTypes.GZIP,
      });
      this.logger.debug(`Sent ${msgs.length} message(s) to ${topic}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to send to ${topic}: ${(error as Error).message}`);
      throw error;
    }
  }

  async sendBatch(topic: string, messageBatches: { messages: any[]; key?: string }[]): Promise<void> {
    await Promise.all(
      messageBatches.map((batch) => this.send(topic, batch.messages, batch.key)),
    );
  }

  async sendToDeadLetter(originalTopic: string, message: any, error: Error): Promise<void> {
    const dlqMessage = {
      originalTopic,
      originalMessage: message,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    await this.send(`${originalTopic}${this.deadLetterSuffix}`, dlqMessage);
  }

  isConnected(): boolean {
    return this.connected;
  }
}
