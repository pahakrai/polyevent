import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '@polydom/kafka-client';
import { NotificationModule } from './notification/notification.module';
import { HealthController } from './health.controller';

const imports: any[] = [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../../.env'] }),
  NotificationModule,
];

if (process.env.KAFKA_BROKERS) {
  imports.push(
    KafkaModule.register({
      clientId: 'notification-service',
      brokers: process.env.KAFKA_BROKERS.split(','),
      consumer: { groupId: 'notification-service' },
    }),
  );
}

@Module({ imports, controllers: [HealthController] })
export class AppModule {}
