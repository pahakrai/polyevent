import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { StripeService } from './stripe.service';
import { PlatformFeeService } from './platform-fee.service';
import { StripeWebhookController } from './webhook.controller';

@Module({
  controllers: [PaymentController, StripeWebhookController],
  providers: [PaymentService, StripeService, PlatformFeeService],
  exports: [PaymentService, PlatformFeeService],
})
export class PaymentModule {}
