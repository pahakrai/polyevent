import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '@polydom/kafka-client';
import { NatsModule } from '@polydom/nats-client';
import { EventModule } from './event/event.module';
import { HealthController } from './health.controller';

const imports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '../../../.env'],
  }),
  EventModule,
];

if (process.env.KAFKA_BROKERS) {
  imports.push(
    KafkaModule.register({
      clientId: 'event-service',
      brokers: process.env.KAFKA_BROKERS.split(','),
      producer: true,
    }),
  );
}

if (process.env.NATS_SERVERS) {
  imports.push(
    NatsModule.register({
      servers: process.env.NATS_SERVERS.split(','),
      producer: true,
    }),
  );
}

@Module({
  imports,
  controllers: [HealthController],
})
export class AppModule {}
