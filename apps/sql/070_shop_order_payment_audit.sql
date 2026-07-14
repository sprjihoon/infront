-- ============================================================
-- 070_shop_order_payment_audit.sql
-- KG이니시스 해외카드 심사 — 주문 결제/배송 메타 필드
-- ============================================================

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_code TEXT,
  ADD COLUMN IF NOT EXISTS is_foreign_card BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_item_type TEXT DEFAULT 'one_time'
    CHECK (payment_item_type IN ('one_time', 'recurring')),
  ADD COLUMN IF NOT EXISTS payment_item_key TEXT,
  ADD COLUMN IF NOT EXISTS shipping_type TEXT DEFAULT 'none'
    CHECK (shipping_type IN ('domestic', 'intl', 'none')),
  ADD COLUMN IF NOT EXISTS tracking_available BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN shop_orders.payment_method IS '결제수단 UI 라벨 (예: 해외카드)';
COMMENT ON COLUMN shop_orders.payment_method_code IS '결제수단 코드 (CARD, FOREIGN_CARD 등)';
COMMENT ON COLUMN shop_orders.is_foreign_card IS '해외카드 사용 여부';
COMMENT ON COLUMN shop_orders.payment_item_type IS '단건결제(one_time) / 정기결제(recurring)';
COMMENT ON COLUMN shop_orders.payment_item_key IS '결제항목 키 (pickup_fee, international_shipping_fee 등)';
COMMENT ON COLUMN shop_orders.shipping_type IS '배송유형: domestic / intl / none';
COMMENT ON COLUMN shop_orders.tracking_available IS '배송추적 가능 여부';
