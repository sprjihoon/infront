-- =============================================
-- 034: 소포 크기 코드 (우체국 택배 규격 기반)
-- =============================================

-- 우체국 택배 규격 → 부피(L) 매핑
-- SMALL(소형)=8L / MEDIUM(중형)=30L / LARGE(대형)=80L / XLARGE(특대)=200L
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS parcel_size_code TEXT DEFAULT NULL;

COMMENT ON COLUMN parcels.parcel_size_code IS
  '우체국 택배 규격: SMALL(소형 ~8L) / MEDIUM(중형 ~30L) / LARGE(대형 ~80L) / XLARGE(특대 ~200L)';
