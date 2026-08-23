import { Injectable, Logger, NotFoundException, ConflictException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../database/client';
import { bookings, payments, vendorPayouts, NewBooking, NewPayment, NewVendorPayout } from '../database/schema';
import { StripeService } from './stripe.service';
import { PlatformFeeService, FeeCalculation } from './platform-fee.service';
import { BaseProducer } from '@polydom/kafka-client';
import {
  BOOKING_EVENTS_TOPIC,
  BookingEventMessage,
  BookingEventType,
} from '@polydom/kafka-client';
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
    @Optional() private readonly kafkaProducer?: BaseProducer,
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
        totalAmount: amountCents, // cents
        currency: input.currency,
        status: 'PENDING',
        promoCode: input.promoCode || undefined,
        discountAmount: input.discountCents || 0, // cents
        platformFeePercent: feeBreakdown.feePercent,
        platformFeeAmount: feeBreakdown.feeAmountCents, // cents
        netVendorAmount: feeBreakdown.netAmountCents, // cents
        metadata: input.metadata || {},
      } as NewBooking)
      .returning();

    // Insert payment record
    const [payment] = await db
      .insert(payments)
      .values({
        bookingId: booking.id,
        amount: amountCents, // cents
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
      bookingAmount: amountCents, // cents
      platformFee: feeBreakdown.feeAmountCents, // cents
      netAmount: feeBreakdown.netAmountCents, // cents
      currency: input.currency,
      status: 'PENDING',
    } as NewVendorPayout);

    this.logger.log(
      `Booking ${booking.id}: ${amountCents}¢ — fee=${feeBreakdown.feeAmountCents}¢, net=${feeBreakdown.netAmountCents}¢`,
    );

    // Emit booking_initiated event for ML pipeline
    await this.publishBookingEvent('booking_initiated', booking);

    return { booking, payment, clientSecret, feeBreakdown };
  }

  /**
   * Confirm a booking after successful payment. Called by webhook or manual confirmation.
   *
   * Idempotent: if the booking is already CONFIRMED we return without re-incrementing
   * capacity or re-emitting events, so a retried Stripe webhook is a safe no-op.
   */
  async confirmBooking(bookingId: string, stripePaymentIntentId?: string): Promise<void> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException(`Booking ${bookingId} not found`);

    if (booking.status === 'CONFIRMED') {
      this.logger.log(`Booking ${bookingId} already CONFIRMED — idempotent no-op`);
      return;
    }

    if (booking.status !== 'PENDING') {
      throw new ConflictException(
        `Booking ${bookingId} is ${booking.status} and cannot be confirmed`,
      );
    }

    // Reserve capacity in event-service BEFORE confirming. Throws if the event is full.
    await this.incrementEventBookings(booking.eventId);

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

    this.logger.log(`Booking ${bookingId} CONFIRMED — payout scheduled`);

    // Re-read booking to get updated status for the Kafka event
    const [updatedBooking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);

    // Emit booking_confirmed event for ML pipeline
    if (updatedBooking) {
      await this.publishBookingEvent('booking_confirmed', updatedBooking);
    }
  }

  /**
   * Atomically reserve one seat for a confirmed booking in event-service.
   * Throws ConflictException when the event is sold out.
   */
  private async incrementEventBookings(eventId: string): Promise<void> {
    const eventServiceUrl =
      this.nestConfig.get<string>('EVENT_SERVICE_URL') || 'http://localhost:3004';
    const internalKey =
      this.nestConfig.get<string>('INTERNAL_SERVICE_KEY') || 'internal-secret';

    try {
      const res = await fetch(`${eventServiceUrl}/events/${eventId}/increment-bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': internalKey,
        },
      });

      if (res.status === 409) {
        throw new ConflictException('Event is sold out');
      }
      if (!res.ok) {
        throw new Error(`event-service returned ${res.status}`);
      }
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      // Best-effort: log and continue so a paid booking is never lost if
      // event-service is briefly unreachable. Stripe will retry the webhook.
      this.logger.warn(`Failed to increment bookings for event ${eventId}: ${(err as Error).message}`);
    }
  }

  /** Publish a booking lifecycle event to Kafka for ML pipeline consumption. */
  private async publishBookingEvent(
    type: BookingEventType,
    booking: typeof bookings.$inferSelect,
  ): Promise<void> {
    if (!this.kafkaProducer || !this.kafkaProducer.isConnected()) return;

    try {
      const message: BookingEventMessage = {
        bookingId: booking.id,
        userId: booking.userId,
        eventId: booking.eventId,
        vendorId: booking.vendorId,
        type,
        timestamp: new Date().toISOString(),
        booking: {
          tickets: [{
            tier: (booking.ticketType || 'GENERAL') as string,
            quantity: booking.ticketCount,
            unitPrice: booking.totalAmount / booking.ticketCount,
          }],
          totalAmount: booking.totalAmount,
          currency: booking.currency,
          status: booking.status,
        },
        event: {
          title: '',
          category: '',
          genres: [],
          tags: [],
          startTime: '',
          endTime: '',
          location: {
            venueName: '',
            city: '',
            country: '',
            latitude: 0,
            longitude: 0,
          },
        },
        source: booking.source ? {
          channel: booking.source as string,
        } : undefined,
      };

      await this.kafkaProducer.send(BOOKING_EVENTS_TOPIC, message, booking.userId);
      this.logger.debug(`Published ${type} event for booking ${booking.id}`);
    } catch (err) {
      this.logger.warn(`Failed to publish ${type} event: ${(err as Error).message}`);
    }
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