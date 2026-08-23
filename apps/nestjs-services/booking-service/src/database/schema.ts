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
  decimal,
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
  'ALIPAY',
  'WECHAT_PAY',
]);

export const payoutStatusEnum = pgEnum('payout_status', [
  'PENDING',
  'SCHEDULED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export const bookings = pgTable('bookings', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  eventId: text('event_id').notNull(),
  vendorId: text('vendor_id').notNull(),
  ticketCount: integer('ticket_count').notNull().default(1),
  // Monetary amounts are stored as integer minor units (cents) to avoid float rounding.
  totalAmount: integer('total_amount').notNull(),
  currency: text('currency').notNull().default('EUR'),
  status: bookingStatusEnum('status').notNull().default('PENDING'),
  ticketType: text('ticket_type').default('GENERAL'),
  promoCode: text('promo_code'),
  discountAmount: integer('discount_amount').default(0),
  source: text('source').default('web'),
  platformFeePercent: real('platform_fee_percent').default(0),
  platformFeeAmount: integer('platform_fee_amount').default(0),
  netVendorAmount: integer('net_vendor_amount'),
  metadata: json('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

export const payments = pgTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bookingId: text('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // cents
  currency: text('currency').notNull().default('EUR'),
  status: paymentStatusEnum('status').notNull().default('PENDING'),
  method: paymentMethodEnum('method').notNull().default('STRIPE'),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeChargeId: text('stripe_charge_id'),
  stripeRefundId: text('stripe_refund_id'),
  alipayTransactionId: text('alipay_transaction_id'),
  wechatPayTransactionId: text('wechat_pay_transaction_id'),
  refundAmount: integer('refund_amount'), // cents
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

// Runtime application configuration — key-value, DB-first with env fallback
export const appConfig = pgTable('app_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  value: json('value').notNull(),
  description: text('description'),
  category: text('category').notNull().default('general'),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const appConfigKeyIdx = index('app_config_key_idx').on(appConfig.key);

// Vendor payout tracking
export const vendorPayouts = pgTable('vendor_payouts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  vendorId: text('vendor_id').notNull(),
  bookingId: text('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  bookingAmount: integer('booking_amount').notNull(), // cents
  platformFee: integer('platform_fee').notNull().default(0), // cents
  netAmount: integer('net_amount').notNull(), // cents
  currency: text('currency').notNull().default('EUR'),
  status: payoutStatusEnum('status').notNull().default('PENDING'),
  stripeTransferId: text('stripe_transfer_id'),
  scheduledAt: timestamp('scheduled_at'),
  paidAt: timestamp('paid_at'),
  metadata: json('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().$onUpdateFn(() => new Date()),
});

// Indexes
export const bookingsUserIdIdx = index('bookings_user_id_idx').on(bookings.userId);
export const bookingsEventIdIdx = index('bookings_event_id_idx').on(bookings.eventId);
export const bookingsVendorIdIdx = index('bookings_vendor_id_idx').on(bookings.vendorId);
export const bookingsStatusIdx = index('bookings_status_idx').on(bookings.status);
export const paymentsBookingIdIdx = index('payments_booking_id_idx').on(payments.bookingId);
export const bookingActivitiesBookingIdIdx = index('booking_activities_booking_id_idx').on(bookingActivities.bookingId);
export const vendorPayoutsVendorIdIdx = index('vendor_payouts_vendor_id_idx').on(vendorPayouts.vendorId);
export const vendorPayoutsBookingIdIdx = index('vendor_payouts_booking_id_idx').on(vendorPayouts.bookingId);

export const schema = {
  bookings,
  payments,
  bookingActivities,
  appConfig,
  vendorPayouts,
};

export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type BookingActivity = typeof bookingActivities.$inferSelect;
export type NewBookingActivity = typeof bookingActivities.$inferInsert;
export type AppConfig = typeof appConfig.$inferSelect;
export type NewAppConfig = typeof appConfig.$inferInsert;
export type VendorPayout = typeof vendorPayouts.$inferSelect;
export type NewVendorPayout = typeof vendorPayouts.$inferInsert;
