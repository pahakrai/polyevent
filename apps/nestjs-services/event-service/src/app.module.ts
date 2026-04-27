import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '@polydom/kafka-client';
import { EventModule } from './event/event.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../.env'],
    }),
    KafkaModule.register({
      clientId: 'event-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      producer: true,
    }),
    EventModule,
  ],
})
export class AppModule {}
