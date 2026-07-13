-- ============================================================
-- 068_shop_subscriptions.sql
-- 샵 구독 (빌링키 심사용) 테이블
-- KG이니시스 자동결제(빌링) 심사용 구독 정보 저장
-- ============================================================

CREATE TABLE IF NOT EXISTS public.shop_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_id         TEXT NOT NULL DEFAULT 'STORAGE_BASIC',
  plan_name       TEXT NOT NULL DEFAULT '보관함 기본 구독',
  monthly_amount  INTEGER NOT NULL DEFAULT 9900,
  pg_bill_key     TEXT,
  pg_oid          TEXT,
  pg_provider     TEXT NOT NULL DEFAULT 'kg_inicis',
  status          TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | ACTIVE | CANCELLED
  last_paid_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.shop_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_subscriptions: owner read"
  ON public.shop_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- service_role은 RLS 자동 우회
