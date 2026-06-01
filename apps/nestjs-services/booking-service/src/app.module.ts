import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { PaymentModule } from './payment/payment.module';
import { PayoutModule } from './payout/payout.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../../.env'],
    }),
    ConfigModule,
    PaymentModule,
    PayoutModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    await this.config.loadAll();
  }
}
