-- Booking Service: Initial Migration
-- Creates tables for booking management and payment processing

CREATE TYPE booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'ATTENDED', 'NO_SHOW', 'REFUNDED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE payment_method AS ENUM ('CREDIT_CARD', 'DEBIT_CARD', 'PAYPAL', 'STRIPE', 'APPLE_PAY', 'GOOGLE_PAY');

CREATE TABLE bookings (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    event_id VARCHAR(50) NOT NULL,
    vendor_id VARCHAR(50) NOT NULL,
    ticket_count INTEGER NOT NULL DEFAULT 1,
    total_amount REAL NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status booking_status NOT NULL DEFAULT 'PENDING',
    ticket_type VARCHAR(20) DEFAULT 'GENERAL',
    promo_code VARCHAR(50),
    discount_amount REAL DEFAULT 0,
    source VARCHAR(20) DEFAULT 'web',
    metadata jsonb DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    amount REAL NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
    status payment_status NOT NULL DEFAULT 'PENDING',
    method payment_method NOT NULL DEFAULT 'STRIPE',
    stripe_payment_intent_id VARCHAR(100),
    stripe_charge_id VARCHAR(100),
    refund_amount REAL,
    refund_reason TEXT,
    metadata jsonb DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE booking_activities (
    id VARCHAR(50) PRIMARY KEY,
    booking_id VARCHAR(50) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    metadata jsonb DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX bookings_user_id_idx ON bookings(user_id);
CREATE INDEX bookings_event_id_idx ON bookings(event_id);
CREATE INDEX bookings_vendor_id_idx ON bookings(vendor_id);
CREATE INDEX bookings_status_idx ON bookings(status);
CREATE INDEX payments_booking_id_idx ON payments(booking_id);
CREATE INDEX booking_activities_booking_id_idx ON booking_activities(booking_id);
