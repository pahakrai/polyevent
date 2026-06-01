import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../database/client';
import { bookings, payments, vendorPayouts, NewBooking, NewPayment, NewVendorPayout } from '../database/schema';
import { StripeService } from './stripe.service';
import { PlatformFeeService, FeeCalculation } from './platform-fee.service';
import { v4 as uuid } from 'uuid';

export interface CreateBookingInput {
  userId: string;
  eventId: string;
  vendorId: string;
  amountCents: number;
  currency: string;
  ticketCount?: number;
  promoCode?: string;
  discountCents?: number;
  metadata?: Record<string, any>;
}

export interface BookingResult {
  booking: typeof bookings.$inferSelect;
  payment: typeof payments.$inferSelect;
  clientSecret: string | null;
  feeBreakdown: FeeCalculation;
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly feeService: PlatformFeeService,
    private readonly nestConfig: ConfigService,
  ) {}

  /**
   * Create a booking and a Stripe PaymentIntent in one flow.
   * Returns the booking, payment record, and Stripe client_secret for the frontend.
   */
  async createBooking(input: CreateBookingInput): Promise<BookingResult> {
    const amountCents = input.amountCents - (input.discountCents || 0);
    const feeBreakdown = await this.feeService.calculateFee(amountCents);

    // Create Stripe PaymentIntent
    let paymentIntent: any = null;
    let clientSecret: string | null = null;

    try {
      paymentIntent = await this.stripeService.createPaymentIntent(
        amountCents,
        input.currency,
        {
          eventId: input.eventId,
          vendorId: input.vendorId,
          userId: input.userId,
        },
      );
      clientSecret = paymentIntent.client_secret || null;
    } catch (err) {
      this.logger.warn(`Stripe PaymentIntent creation failed: ${(err as Error).message}`);
      // Fall back to creating booking without Stripe (dev mode / free events)
    }

    // Insert booking
    const bookingId = uuid();
    const [booking] = await db
      .insert(bookings)
      .values({
        id: bookingId,
        userId: input.userId,
        eventId: input.eventId,
        vendorId: input.vendorId,
        ticketCount: input.ticketCount || 1,
        totalAmount: amountCents / 100,
        currency: input.currency,
        status: 'PENDING',
        promoCode: input.promoCode || undefined,
        discountAmount: (input.discountCents || 0) / 100,
        platformFeePercent: feeBreakdown.feePercent,
        platformFeeAmount: feeBreakdown.feeAmountCents / 100,
        netVendorAmount: feeBreakdown.netAmountCents / 100,
        metadata: input.metadata || {},
      } as NewBooking)
      .returning();

    // Insert payment record
    const [payment] = await db
      .insert(payments)
      .values({
        bookingId: booking.id,
        amount: amountCents / 100,
        currency: input.currency,
        status: 'PENDING',
        method: 'STRIPE',
        stripePaymentIntentId: paymentIntent?.id || undefined,
        metadata: {},
      } as NewPayment)
      .returning();

    // Create pending payout record
    await db.insert(vendorPayouts).values({
      vendorId: input.vendorId,
      bookingId: booking.id,
      bookingAmount: amountCents / 100,
      platformFee: feeBreakdown.feeAmountCents / 100,
      netAmount: feeBreakdown.netAmountCents / 100,
      currency: input.currency,
      status: 'PENDING',
    } as NewVendorPayout);

    this.logger.log(
      `Booking ${booking.id}: ${amountCents}¢ — fee=${feeBreakdown.feeAmountCents}¢, net=${feeBreakdown.netAmountCents}¢`,
    );

    return { booking, payment, clientSecret, feeBreakdown };
  }

  /** Confirm a booking after successful payment. Called by webhook or manual confirmation. */
  async confirmBooking(bookingId: string, stripePaymentIntentId?: string): Promise<void> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    await db
      .update(bookings)
      .set({ status: 'CONFIRMED' })
      .where(eq(bookings.id, bookingId));

    if (stripePaymentIntentId) {
      await db
        .update(payments)
        .set({ status: 'COMPLETED', stripePaymentIntentId })
        .where(eq(payments.bookingId, bookingId));
    }

    // Mark payout as SCHEDULED (execution happens in PayoutService)
    await db
      .update(vendorPayouts)
      .set({ status: 'SCHEDULED' })
      .where(eq(vendorPayouts.bookingId, bookingId));

    // Notify event-service to increment currentBookings
    const eventServiceUrl = this.nestConfig.get<string>(
      'EVENT_SERVICE_URL',
      'http://localhost:3004',
    );
    try {
      await fetch(`${eventServiceUrl}/events/${booking.eventId}/increment-bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      this.logger.warn(`Failed to notify event-service: ${(err as Error).message}`);
    }

    this.logger.log(`Booking ${bookingId} CONFIRMED — payout scheduled`);
  }

  async getBooking(bookingId: string) {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);
    return booking;
  }
}