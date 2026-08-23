import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { PaymentService, CreateBookingInput } from './payment.service';
import { RefundService } from './refund.service';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly refundService: RefundService,
  ) {}

  @Post('create-booking')
  async createBooking(@Body() input: CreateBookingInput) {
    return this.paymentService.createBooking(input);
  }

  @Get('bookings/:id')
  async getBooking(@Param('id') id: string) {
    return this.paymentService.getBooking(id);
  }

  @Post('bookings/:id/confirm')
  async confirmBooking(
    @Param('id') id: string,
    @Body('stripePaymentIntentId') stripePaymentIntentId?: string,
  ) {
    await this.paymentService.confirmBooking(id, stripePaymentIntentId);
    return { status: 'confirmed' };
  }

  @Post('bookings/:id/refund')
  async refundBooking(
    @Param('id') id: string,
    @Body('reason') reason?: string,
    @Body('amountCents') amountCents?: number,
  ) {
    return this.refundService.refund({ bookingId: id, reason, amountCents });
  }
}
