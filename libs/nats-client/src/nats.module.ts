import { Module, DynamicModule, Provider, Global } from '@nestjs/common';
import { NatsProducer, NatsProducerConfig } from './nats.producer';
import { NatsConsumer, NatsConsumerConfig } from './nats.consumer';

export interface NatsModuleOptions {
  servers: string[];
  producer?: boolean;
  consumer?: {
    queueGroup?: string;
  };
}

@Global()
@Module({})
export class NatsModule {
  static register(options: NatsModuleOptions): DynamicModule {
    const providers: Provider[] = [];
    const exports: any[] = [];

    if (options.producer !== false) {
      const producerConfig: NatsProducerConfig = {
        servers: options.servers,
      };
      providers.push({
        provide: 'NATS_PRODUCER_CONFIG',
        useValue: producerConfig,
      });
      providers.push(NatsProducer);
      exports.push(NatsProducer);
    }

    if (options.consumer) {
      const consumerConfig: NatsConsumerConfig = {
        servers: options.servers,
        queueGroup: options.consumer.queueGroup,
      };
      providers.push({
        provide: 'NATS_CONSUMER_CONFIG',
        useValue: consumerConfig,
      });
      providers.push(NatsConsumer);
      exports.push(NatsConsumer);
    }

    return {
      module: NatsModule,
      providers,
      exports,
    };
  }
}
