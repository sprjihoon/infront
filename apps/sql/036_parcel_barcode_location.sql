-- =============================================
-- 036: parcel_barcodes 내품 단위 위치 추적
-- =============================================
-- 각 내품(바코드)이 독립적으로 로케이션을 가질 수 있도록 storage_location_id 추가.
-- 소포 전체 이동: parcels.storage_location_id + 모든 바코드 동기화
-- 내품 단위 이동: parcel_barcodes.storage_location_id 만 업데이트

ALTER TABLE parcel_barcodes
  ADD COLUMN IF NOT EXISTS storage_location_id UUID
    REFERENCES storage_locations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parcel_barcodes_location
  ON parcel_barcodes(storage_location_id);

COMMENT ON COLUMN parcel_barcodes.storage_location_id
  IS '내품 현재 위치. NULL=위치 미배정, 소포 전체 이동 시 parcels.storage_location_id와 동기화';
