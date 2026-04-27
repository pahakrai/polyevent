import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '@polydom/kafka-client';
import { HealthController } from './health.controller';
import { TrackingController } from './tracking/tracking.controller';
import { TrackingService } from './tracking/tracking.service';
import { AnalyticsInterceptor } from './analytics/analytics.interceptor';
import { AuthProxyController } from './proxy/auth-proxy.controller';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../.env'],
    }),
    KafkaModule.register({
      clientId: 'api-gateway',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      producer: true,
    }),
    HttpModule,
  ],
  controllers: [HealthController, TrackingController, AuthProxyController],
  providers: [
    TrackingService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AnalyticsInterceptor,
    },
  ],
})
export class AppModule {}
