-- =============================================
-- 035: parcel_size_code 값을 storage_types.code 와 통일
-- =============================================
-- 기존: SMALL(8L) / MEDIUM(30L) / LARGE(80L) / XLARGE(200L)  (우체국 택배 규격)
-- 변경: MINI(16L) / STANDARD(40.5L) / LONG(96L) / XL(108.2L) / OVERSIZE(480L)
--       (= storage_types.code 와 동일)
--
-- 픽업 무게 기준 자동 배정:
--   ≤  2 kg → MINI
--   ≤  5 kg → STANDARD
--   ≤ 10 kg → LONG
--   ≤ 20 kg → XL
--   ≤ 30 kg → OVERSIZE

-- 기존 레거시 코드 → 새 코드 변환
UPDATE parcels
SET parcel_size_code = CASE parcel_size_code
  WHEN 'SMALL'  THEN 'MINI'
  WHEN 'MEDIUM' THEN 'STANDARD'
  WHEN 'LARGE'  THEN 'LONG'
  WHEN 'XLARGE' THEN 'XL'
  ELSE parcel_size_code
END
WHERE parcel_size_code IN ('SMALL', 'MEDIUM', 'LARGE', 'XLARGE');

-- pickup_weight_kg 이 있는데 parcel_size_code 가 없는 소포에 자동 채우기
UPDATE parcels
SET parcel_size_code = CASE
  WHEN pickup_weight_kg <= 2  THEN 'MINI'
  WHEN pickup_weight_kg <= 5  THEN 'STANDARD'
  WHEN pickup_weight_kg <= 10 THEN 'LONG'
  WHEN pickup_weight_kg <= 20 THEN 'XL'
  ELSE 'OVERSIZE'
END
WHERE parcel_size_code IS NULL
  AND pickup_weight_kg IS NOT NULL;

-- 컬럼 코멘트 업데이트
COMMENT ON COLUMN parcels.parcel_size_code IS
  '스토리지 타입 코드와 동일: MINI(≤2kg,16L) / STANDARD(≤5kg,40.5L) / LONG(≤10kg,96L) / XL(≤20kg,108.2L) / OVERSIZE(≤30kg,480L)';
