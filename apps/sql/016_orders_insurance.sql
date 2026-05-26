-- ============================================================
-- 016_orders_insurance.sql
-- orders: 국제우편 보험 가입 옵션
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS insurance_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS insurance_amount  NUMERIC(10,2) DEFAULT 0;

COMMENT ON COLUMN orders.insurance_enabled IS '국제우편 보험 가입 여부 (EMS boyn)';
COMMENT ON COLUMN orders.insurance_amount  IS '보험 가입 신고가액 (USD, 인보이스 합계)';
