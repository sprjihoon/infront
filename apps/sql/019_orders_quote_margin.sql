-- 견적 원가·마진 분리 (관리자 견적 화면)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS quote_ems_cost   NUMERIC(10,0),
  ADD COLUMN IF NOT EXISTS shipping_margin  NUMERIC(10,0);

COMMENT ON COLUMN orders.quote_ems_cost  IS '견적 시 EMS 원가 (KRW)';
COMMENT ON COLUMN orders.shipping_margin   IS '견적 시 마진 (KRW)';
