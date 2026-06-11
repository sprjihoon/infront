-- =============================================
-- 050: storage_types 에 월 단위 요금 컬럼 추가
-- =============================================
-- price_per_week 는 주간 단기 요금,
-- price_per_month 는 월정액 장기 요금 (NULL 이면 미설정)

ALTER TABLE storage_types
  ADD COLUMN IF NOT EXISTS price_per_month NUMERIC(10,0) DEFAULT NULL;

COMMENT ON COLUMN storage_types.price_per_month IS '월정액 요금 (NULL이면 미설정, 설정 시 고객이 월 단위 플랜 선택 가능)';
