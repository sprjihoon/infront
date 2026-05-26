-- ============================================================
-- 017_orders_intl_tracking.sql
-- 국제 EMS/K-Packet 행방 조회 결과 저장
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS intl_tracking_status     TEXT,
  ADD COLUMN IF NOT EXISTS intl_tracking_last_event JSONB,
  ADD COLUMN IF NOT EXISTS intl_tracking_events     JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS intl_tracking_synced_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at             TIMESTAMPTZ;

COMMENT ON COLUMN orders.intl_tracking_status     IS '국제배송 추적 상태 (DELIVERED / IN_TRANSIT 등)';
COMMENT ON COLUMN orders.intl_tracking_last_event IS '국제배송 최신 행방 이벤트 JSON';
COMMENT ON COLUMN orders.intl_tracking_events     IS '국제배송 행방 이벤트 목록 JSON';
COMMENT ON COLUMN orders.intl_tracking_synced_at  IS '국제배송 행방 API 마지막 동기화 시각';
COMMENT ON COLUMN orders.delivered_at             IS '해외 배달 완료 시각';
