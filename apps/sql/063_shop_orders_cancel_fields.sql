-- ============================================================
-- 063_shop_orders_cancel_fields.sql
-- shop_orders 테이블에 취소 및 관리자 메모 컬럼 추가
-- ============================================================

ALTER TABLE shop_orders
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancel_msg    TEXT,
  ADD COLUMN IF NOT EXISTS admin_memo    TEXT;

COMMENT ON COLUMN shop_orders.cancelled_at IS '결제 취소 일시';
COMMENT ON COLUMN shop_orders.cancel_msg   IS '취소 사유';
COMMENT ON COLUMN shop_orders.admin_memo   IS '관리자 메모';
