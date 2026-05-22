-- ============================================================
-- 015_pickup_box_specs.sql
-- 수거 박스 규격 · 다박스 수거 배치 ID
-- ============================================================

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS pickup_batch_id   UUID,
  ADD COLUMN IF NOT EXISTS pickup_box_seq    INT,
  ADD COLUMN IF NOT EXISTS pickup_box_count  INT,
  ADD COLUMN IF NOT EXISTS pickup_weight_kg  INT,
  ADD COLUMN IF NOT EXISTS pickup_volume_cm  INT,
  ADD COLUMN IF NOT EXISTS pickup_micro_yn   TEXT CHECK (pickup_micro_yn IN ('Y', 'N'));

CREATE INDEX IF NOT EXISTS idx_parcels_pickup_batch ON parcels(pickup_batch_id)
  WHERE pickup_batch_id IS NOT NULL;

COMMENT ON COLUMN parcels.pickup_batch_id IS '동일 수거 신청(다박스) 묶음 UUID';
COMMENT ON COLUMN parcels.pickup_box_seq IS '배치 내 박스 순번 (1-based)';
COMMENT ON COLUMN parcels.pickup_box_count IS '해당 수거 신청 총 박스 수';
COMMENT ON COLUMN parcels.pickup_weight_kg IS 'InsertOrder weight — 물품중량(kg)';
COMMENT ON COLUMN parcels.pickup_volume_cm IS 'InsertOrder volume — 세변의 합(cm)';
COMMENT ON COLUMN parcels.pickup_micro_yn IS 'InsertOrder microYn — 극소(Y/N)';
