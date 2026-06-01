import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { PaymentService, CreateBookingInput } from './payment.service';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

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
}
