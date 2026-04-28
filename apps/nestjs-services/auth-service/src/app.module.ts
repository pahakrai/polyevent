import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '@polydom/kafka-client';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../.env'],
    }),
    KafkaModule.register({
      clientId: 'auth-service',
      brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      producer: true,
    }),
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
