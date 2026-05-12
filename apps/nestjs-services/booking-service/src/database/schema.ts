import crypto from 'crypto';
import {
  pgTable,
  text,
  timestamp,
  boolean,
  json,
  integer,
  real,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';

export const bookingStatusEnum = pgEnum('booking_status', [
  'PENDING',
  'CONFIRMED',
  'CANCELLED',
  'ATTENDED',
  'NO_SHOW',
  'REFUNDED',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'PENDING',
  'COMPLETED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);

export const paymentMethodEnum = pgEnum('payment_method', [
  'CREDIT_CARD',
  'DEBIT_CARD',
  'PAYPAL',
  'STRIPE',
  'APPLE_PAY',
  'GOOGLE_PAY',
]);

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  eventId: text('event_id').notNull(),
  vendorId: text('vendor_id').notNull(),
  ticketCount: integer('ticket_count').notNull().default(1),
  totalAmount: real('total_amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  status: bookingStatusEnum('status').notNull().default('PENDING'),
  ticketType: text('ticket_type').default('GENERAL'),
  promoCode: text('promo_code'),
  discountAmount: real('discount_amount').default(0),
  source: text('source').default('web'),
  metadata: json('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const payments = pgTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: text('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  amount: real('amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  method: paymentMethodEnum('method').notNull().default('STRIPE'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeChargeId: text('stripe_charge_id'),
  refundAmount: real('refund_amount'),
  refundReason: text('refund_reason'),
  metadata: json('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const bookingActivities = pgTable('booking_activities', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: text('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  eventType: text('event_type').notNull(),
  metadata: json('metadata').default({}),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
});

// Indexes
export const bookingsUserIdIdx = index('bookings_user_id_idx').on(bookings.userId);
export const bookingsEventIdIdx = index('bookings_event_id_idx').on(bookings.eventId);
export const bookingsVendorIdIdx = index('bookings_vendor_id_idx').on(bookings.vendorId);
export const bookingsStatusIdx = index('bookings_status_idx').on(bookings.status);
export const paymentsBookingIdIdx = index('payments_booking_id_idx').on(payments.bookingId);
export const bookingActivitiesBookingIdIdx = index('booking_activities_booking_id_idx').on(bookingActivities.bookingId);

export const schema = {
  bookings,
  payments,
  bookingActivities,
};

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type BookingActivity = typeof bookingActivities.$inferSelect;
export type NewBookingActivity = typeof bookingActivities.$inferInsert;
