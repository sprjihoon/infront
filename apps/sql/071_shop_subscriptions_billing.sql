-- ============================================================
-- 071_shop_subscriptions_billing.sql
-- 샵 구독 월정액 자동청구용 컬럼 (next_billing_date, 실패 추적)
-- 빌링 MID: infrontbil
-- ============================================================

ALTER TABLE public.shop_subscriptions
  ADD COLUMN IF NOT EXISTS next_billing_date DATE,
  ADD COLUMN IF NOT EXISTS fail_count        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_fail_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_fail_reason  TEXT;

CREATE INDEX IF NOT EXISTS idx_shop_subscriptions_billing
  ON public.shop_subscriptions (status, next_billing_date)
  WHERE status = 'ACTIVE';

COMMENT ON COLUMN public.shop_subscriptions.next_billing_date IS
  '다음 자동청구일 (매월 1일 기준 cron)';
COMMENT ON COLUMN public.shop_subscriptions.fail_count IS
  '연속 청구 실패 횟수';
