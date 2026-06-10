import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { KafkaModule } from '@polydom/kafka-client';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { PaymentModule } from './payment/payment.module';
import { PayoutModule } from './payout/payout.module';
import { HealthController } from './health.controller';

const imports: any[] = [
  NestConfigModule.forRoot({
    isGlobal: true,
    envFilePath: ['.env', '../../../.env'],
  }),
  ConfigModule,
  PaymentModule,
  PayoutModule,
];

if (process.env.KAFKA_BROKERS) {
  imports.push(
    KafkaModule.register({
      clientId: 'booking-service',
      brokers: process.env.KAFKA_BROKERS.split(','),
      producer: true,
    }),
  );
}

@Module({
  imports,
  controllers: [HealthController],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.config.loadAll();
  }
}
