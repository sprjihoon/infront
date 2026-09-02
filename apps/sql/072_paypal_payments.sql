-- ============================================================
-- 072_paypal_payments.sql
-- 해외고객 PayPal 단건(USD) + 구독 필드
-- ============================================================

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS pg_provider TEXT NOT NULL DEFAULT 'kg_inicis',
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KRW',
  ADD COLUMN IF NOT EXISTS amount_fx NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS fx_locked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shop_orders_paypal_order
  ON shop_orders (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

COMMENT ON COLUMN shop_orders.pg_provider IS 'kg_inicis | paypal';
COMMENT ON COLUMN shop_orders.amount_fx IS 'PayPal 청구 USD';
COMMENT ON COLUMN shop_orders.fx_rate IS '주문 시점 USD/KRW';

ALTER TABLE storage_payments
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KRW',
  ADD COLUMN IF NOT EXISTS amount_fx NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS fx_locked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_storage_payments_paypal_order
  ON storage_payments (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

ALTER TABLE shop_subscriptions
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KRW',
  ADD COLUMN IF NOT EXISTS amount_fx NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS fx_locked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_paypal
  ON shop_subscriptions (paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;

ALTER TABLE storage_recurring_profiles
  ALTER COLUMN pg_bill_key DROP NOT NULL;

ALTER TABLE storage_recurring_profiles
  ADD COLUMN IF NOT EXISTS paypal_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS paypal_plan_id TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'KRW',
  ADD COLUMN IF NOT EXISTS amount_fx NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(12, 4),
  ADD COLUMN IF NOT EXISTS fx_locked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_recurring_paypal
  ON storage_recurring_profiles (paypal_subscription_id)
  WHERE paypal_subscription_id IS NOT NULL;
