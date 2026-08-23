import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../database/client';
import { bookings, payments, vendorPayouts } from '../database/schema';
import { StripeService } from './stripe.service';
import { BaseProducer, BOOKING_EVENTS_TOPIC, BookingEventMessage } from '@polydom/kafka-client';

export interface RefundInput {
  bookingId: string;
  reason?: string;
  amountCents?: number; // defaults to full amount
}

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly nestConfig: NestConfigService,
    @Optional() private readonly kafkaProducer?: BaseProducer,
  ) {}

  /**
   * Refund a booking end-to-end:
   *   1. Stripe refund (idempotent by booking id).
   *   2. Mark payment REFUNDED + booking REFUNDED.
   *   3. Cancel the pending/scheduled vendor payout.
   *   4. Decrement the event's booking count.
   *   5. Emit booking_refunded for the ML pipeline.
   */
  async refund(input: RefundInput) {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException(`Booking ${input.bookingId} not found`);

    if (booking.status === 'REFUNDED') {
      this.logger.log(`Booking ${input.bookingId} already refunded — idempotent no-op`);
      return { bookingId: booking.id, status: 'REFUNDED', alreadyRefunded: true };
    }

    if (booking.status !== 'CONFIRMED' && booking.status !== 'ATTENDED') {
      throw new ConflictException(
        `Booking ${input.bookingId} is ${booking.status} and cannot be refunded`,
      );
    }

    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.bookingId, booking.id), eq(payments.status, 'COMPLETED')))
      .limit(1);

    const refundCents = input.amountCents ?? booking.totalAmount;
    if (refundCents <= 0) {
      throw new ConflictException('Refund amount must be greater than zero');
    }

    let refundId: string | null = null;
    if (payment?.stripePaymentIntentId) {
      const refund = await this.stripeService.refundPaymentIntent(
        payment.stripePaymentIntentId,
        refundCents,
        `refund_${booking.id}`, // idempotency key — never double-refund
      );
      refundId = refund.id;
    } else {
      this.logger.warn(`No Stripe PaymentIntent for booking ${booking.id} — local-only refund`);
    }

    await db
      .update(bookings)
      .set({ status: 'REFUNDED' })
      .where(eq(bookings.id, booking.id));

    if (payment) {
      await db
        .update(payments)
        .set({
          status: 'REFUNDED',
          refundAmount: refundCents,
          refundReason: input.reason || 'Customer refund',
          stripeRefundId: refundId || undefined,
        })
        .where(eq(payments.id, payment.id));
    }

    // Cancel any not-yet-paid payout for this booking (PENDING or SCHEDULED).
    await db
      .update(vendorPayouts)
      .set({ status: 'CANCELLED', metadata: { refundReason: input.reason || 'Booking refunded' } })
      .where(and(
        eq(vendorPayouts.bookingId, booking.id),
        inArray(vendorPayouts.status, ['PENDING', 'SCHEDULED']),
      ));

    await this.decrementEventBookings(booking.eventId);
    await this.publishRefundEvent(booking.id, refundCents, input.reason);

    this.logger.log(`Booking ${booking.id} refunded (${refundCents} ${booking.currency})`);
    return { bookingId: booking.id, status: 'REFUNDED', refundAmountCents: refundCents };
  }

  private async decrementEventBookings(eventId: string): Promise<void> {
    const eventServiceUrl =
      this.nestConfig.get<string>('EVENT_SERVICE_URL') || 'http://localhost:3004';
    const internalKey =
      this.nestConfig.get<string>('INTERNAL_SERVICE_KEY') || 'internal-secret';
    try {
      await fetch(`${eventServiceUrl}/events/${eventId}/decrement-bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': internalKey,
        },
      });
    } catch (err) {
      this.logger.warn(`Failed to decrement event bookings: ${(err as Error).message}`);
    }
  }

  private async publishRefundEvent(
    bookingId: string,
    refundCents: number,
    reason?: string,
  ): Promise<void> {
    if (!this.kafkaProducer || !this.kafkaProducer.isConnected()) return;
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    if (!booking) return;

    const message: BookingEventMessage = {
      bookingId: booking.id,
      userId: booking.userId,
      eventId: booking.eventId,
      vendorId: booking.vendorId,
      type: 'booking_refunded',
      timestamp: new Date().toISOString(),
      booking: {
        tickets: [{
          tier: booking.ticketType || 'GENERAL',
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
      refundAmount: refundCents,
      cancellationReason: reason,
    };

    try {
      await this.kafkaProducer.send(BOOKING_EVENTS_TOPIC, message, booking.userId);
    } catch (err) {
      this.logger.warn(`Failed to publish booking_refunded: ${(err as Error).message}`);
    }
  }
}
