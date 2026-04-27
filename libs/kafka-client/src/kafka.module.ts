import { Module, DynamicModule, Provider, Global } from '@nestjs/common';
import { BaseProducer, ProducerConfig } from './producers/base.producer';
import { BaseConsumer, ConsumerConfigInput } from './consumers/base.consumer';

export interface KafkaModuleOptions {
  clientId: string;
  brokers: string[];
  producer?: boolean;
  consumer?: {
    groupId: string;
    fromBeginning?: boolean;
    sessionTimeout?: number;
  };
}

@Global()
@Module({})
export class KafkaModule {
  static register(options: KafkaModuleOptions): DynamicModule {
    const providers: Provider[] = [];
    const exports: any[] = [];

    if (options.producer !== false) {
      const producerConfig: ProducerConfig = {
        clientId: options.clientId,
        brokers: options.brokers,
      };
      providers.push({
        provide: 'KAFKA_PRODUCER_CONFIG',
        useValue: producerConfig,
      });
      providers.push(BaseProducer);
      exports.push(BaseProducer);
    }

    if (options.consumer) {
      const consumerConfig: ConsumerConfigInput = {
        clientId: options.clientId,
        brokers: options.brokers,
        groupId: options.consumer.groupId,
        fromBeginning: options.consumer.fromBeginning,
        sessionTimeout: options.consumer.sessionTimeout,
      };
      providers.push({
        provide: 'KAFKA_CONSUMER_CONFIG',
        useValue: consumerConfig,
      });
      providers.push(BaseConsumer);
      exports.push(BaseConsumer);
    }

    return {
      module: KafkaModule,
      providers,
      exports,
    };
  }
}
