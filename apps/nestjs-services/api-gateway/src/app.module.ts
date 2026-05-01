import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule, BaseProducer } from '@polydom/kafka-client';
import { HealthController } from './health.controller';
import { TrackingController } from './tracking/tracking.controller';
import { TrackingService } from './tracking/tracking.service';
import { AnalyticsInterceptor } from './analytics/analytics.interceptor';
import { AuthProxyController } from './proxy/auth-proxy.controller';
import { VendorProxyController } from './proxy/vendor-proxy.controller';
import { UserProxyController } from './proxy/user-proxy.controller';
import { EventProxyController } from './proxy/event-proxy.controller';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';

const imports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '../../../.env'],
  }),
  HttpModule,
];

const controllers: any[] = [HealthController, AuthProxyController, VendorProxyController, UserProxyController, EventProxyController, TrackingController];

const providers: any[] = [TrackingService];

const hasKafka = !!process.env.KAFKA_BROKERS;

if (hasKafka) {
  imports.push(
    KafkaModule.register({
      clientId: 'api-gateway',
      brokers: process.env.KAFKA_BROKERS!.split(','),
      producer: true,
    }),
  );
  providers.push({
    provide: APP_INTERCEPTOR,
    useClass: AnalyticsInterceptor,
  });
} else {
  providers.push({
    provide: BaseProducer,
    useFactory: () => ({
      send: async () => [],
      sendBatch: async () => {},
      sendToDeadLetter: async () => {},
      isConnected: () => false,
      onModuleInit: async () => {},
      onModuleDestroy: async () => {},
      connect: async () => {},
      disconnect: async () => {},
    }),
  });
}

@Module({
  imports,
  controllers,
  providers,
})
export class AppModule {}
