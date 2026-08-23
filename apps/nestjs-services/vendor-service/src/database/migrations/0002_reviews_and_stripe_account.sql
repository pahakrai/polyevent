-- 0002_reviews_and_stripe_account
-- ---------------------------------------------------------------------------
-- 1. Adds `stripe_account_id` to vendors (Stripe connected account for payouts).
-- 2. Adds the `reviews` table so the reputation system (rating/total_reviews)
--    is backed by real data instead of being a phantom.
-- ---------------------------------------------------------------------------

ALTER TABLE vendors
  ADD COLUMN stripe_account_id text;

CREATE TABLE reviews (
    id VARCHAR(50) PRIMARY KEY,
    vendor_id VARCHAR(50) NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    user_id VARCHAR(50) NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX reviews_vendor_id_idx ON reviews(vendor_id);
CREATE INDEX reviews_user_id_idx ON reviews(user_id);
