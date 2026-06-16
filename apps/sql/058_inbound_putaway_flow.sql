-- ============================================================
-- 058_inbound_putaway_flow.sql
-- 입고: 배정 예정 로케이션 + TEMP 적치
-- 로케이션 이동: 적치 확정 + 사진 1장
-- ============================================================

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS planned_storage_location_id UUID
    REFERENCES storage_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS putaway_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_parcels_planned_location
  ON parcels(planned_storage_location_id)
  WHERE planned_storage_location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_parcels_pending_putaway
  ON parcels(putaway_at)
  WHERE putaway_at IS NULL AND planned_storage_location_id IS NOT NULL;

COMMENT ON COLUMN parcels.planned_storage_location_id IS '입고 시 배정 예정 로케이션 (적치 전)';
COMMENT ON COLUMN parcels.putaway_at IS '물리적 로케이션 적치 완료 시각';

ALTER TABLE parcel_location_events
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN parcel_location_events.photo_url IS '로케이션 이동 후 적치 확인 사진 URL';

ALTER TABLE parcel_media
  ADD COLUMN IF NOT EXISTS location_event_id UUID
    REFERENCES parcel_location_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parcel_media_location_event
  ON parcel_media(location_event_id)
  WHERE location_event_id IS NOT NULL;

COMMENT ON COLUMN parcel_media.location_event_id IS 'PUTAWAY_PHOTO 등 로케이션 이동 이벤트 연결';
