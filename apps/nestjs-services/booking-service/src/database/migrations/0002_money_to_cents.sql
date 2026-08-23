-- 0002_money_to_cents
-- ---------------------------------------------------------------------------
-- Monetary columns were stored as REAL (major currency units, e.g. 12.34).
-- This caused float rounding errors in fees/payouts/reconciliation.
--
-- They now store INTEGER minor units (cents). Existing values are converted
-- by multiplying by 100.
--
-- NOTE: this migration assumes the full current schema (including
-- platform_fee_amount / net_vendor_amount and the vendor_payouts table) is
-- present, which is what `drizzle-kit push` produces.
-- ---------------------------------------------------------------------------

ALTER TABLE bookings
  ALTER COLUMN total_amount TYPE integer USING (ROUND(total_amount * 100)::integer),
  ALTER COLUMN discount_amount TYPE integer USING (ROUND(COALESCE(discount_amount, 0) * 100)::integer),
  ALTER COLUMN platform_fee_amount TYPE integer USING (ROUND(COALESCE(platform_fee_amount, 0) * 100)::integer),
  ALTER COLUMN net_vendor_amount TYPE integer USING (ROUND(net_vendor_amount * 100)::integer);

ALTER TABLE payments
  ALTER COLUMN amount TYPE integer USING (ROUND(amount * 100)::integer),
  ALTER COLUMN refund_amount TYPE integer USING (ROUND(refund_amount * 100)::integer);

ALTER TABLE payments
  ADD COLUMN stripe_refund_id text;

ALTER TABLE vendor_payouts
  ALTER COLUMN booking_amount TYPE integer USING (ROUND(booking_amount * 100)::integer),
  ALTER COLUMN platform_fee TYPE integer USING (ROUND(platform_fee * 100)::integer),
  ALTER COLUMN net_amount TYPE integer USING (ROUND(net_amount * 100)::integer);
