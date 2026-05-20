-- ============================================================
-- 009_parcel_tracking.sql
-- 국내 배송 추적 데이터 저장 (tracker.delivery 연동)
-- ============================================================

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS tracking_carrier_id   TEXT,          -- kr.cjlogistics, kr.hanjin, ...
  ADD COLUMN IF NOT EXISTS tracking_status       TEXT,          -- AT_PICKUP / IN_TRANSIT / DELIVERED ...
  ADD COLUMN IF NOT EXISTS tracking_last_event   JSONB,         -- 최신 이벤트 {time, status, description, location}
  ADD COLUMN IF NOT EXISTS tracking_events       JSONB DEFAULT '[]', -- 전체 이벤트 배열
  ADD COLUMN IF NOT EXISTS tracking_synced_at    TIMESTAMPTZ;   -- 마지막 API 조회 시각
