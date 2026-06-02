-- ============================================================
-- MenuAI: Subscription & Billing Schema
-- Run this in Supabase SQL Editor AFTER 001_initial_schema.sql
-- ============================================================

-- ── SUBSCRIPTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id       UUID REFERENCES restaurants(id) ON DELETE SET NULL,

  -- Plan
  plan                TEXT NOT NULL DEFAULT 'trial',
  -- 'trial'   → 7-day free, no card
  -- 'active'  → paid, ₹999/month
  -- 'expired' → trial over, no payment
  -- 'cancelled' → was active, cancelled

  -- Trial window
  trial_start         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  trial_reminder_sent BOOLEAN DEFAULT false,

  -- Paid billing
  current_period_start  TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,

  -- Razorpay IDs
  razorpay_customer_id      TEXT,
  razorpay_subscription_id  TEXT,
  razorpay_payment_id       TEXT,   -- last successful payment

  -- Metadata
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_subscription_updated
BEFORE UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION update_subscription_timestamp();

-- ── PAYMENT HISTORY ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_history (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id       UUID REFERENCES subscriptions(id),
  razorpay_order_id     TEXT,
  razorpay_payment_id   TEXT,
  razorpay_signature    TEXT,
  amount_paise          INTEGER NOT NULL,   -- 99900 = ₹999
  currency              TEXT DEFAULT 'INR',
  status                TEXT NOT NULL,      -- 'created' | 'paid' | 'failed'
  failure_reason        TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ────────────────────────────────────────────────────
CREATE INDEX idx_subscriptions_user     ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_plan     ON subscriptions(plan);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end) WHERE plan = 'trial';
CREATE INDEX idx_payment_history_user   ON payment_history(user_id);

-- ── RLS ────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "sub_self_read" ON subscriptions
  FOR SELECT USING (user_id = auth.uid());

-- Service role only for writes (done via API routes with service key)
CREATE POLICY "sub_service_write" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "pay_self_read" ON payment_history
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "pay_service_write" ON payment_history
  FOR ALL USING (auth.role() = 'service_role');

-- ── AUTO-CREATE SUBSCRIPTION ON SIGNUP ────────────────────────
-- Trigger: when a new user signs up → immediately create their trial row
CREATE OR REPLACE FUNCTION handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, plan, trial_start, trial_end)
  VALUES (
    NEW.id,
    'trial',
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user_subscription();

-- ── VIEW: subscription status (easy to query) ─────────────────
CREATE OR REPLACE VIEW subscription_status AS
SELECT
  s.user_id,
  s.plan,
  s.trial_start,
  s.trial_end,
  s.current_period_end,
  s.razorpay_subscription_id,
  CASE
    WHEN s.plan = 'active'
      AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
    THEN true
    WHEN s.plan = 'trial'
      AND s.trial_end > NOW()
    THEN true
    ELSE false
  END AS has_access,
  CASE
    WHEN s.plan = 'trial'
    THEN GREATEST(0, EXTRACT(EPOCH FROM (s.trial_end - NOW())) / 86400)::INTEGER
    ELSE NULL
  END AS trial_days_remaining
FROM subscriptions s;
