import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KafkaModule } from '@polydom/kafka-client';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health.controller';

const imports: any[] = [
  ConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '../../../.env'],
  }),
  AuthModule,
];

if (process.env.KAFKA_BROKERS) {
  imports.push(
    KafkaModule.register({
      clientId: 'auth-service',
      brokers: process.env.KAFKA_BROKERS.split(','),
      producer: true,
    }),
  );
}

@Module({
  imports,
  controllers: [HealthController],
})
export class AppModule {}
