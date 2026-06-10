import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { PlatformFeeService } from './platform-fee.service';
import { StripeWebhookController } from './webhook.controller';

@Module({
  imports: [ConfigModule],
  controllers: [PaymentController, StripeWebhookController],
  providers: [PaymentService, StripeService, PlatformFeeService],
  exports: [PaymentService, PlatformFeeService],
})
export class PaymentModule {}
