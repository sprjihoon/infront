-- =============================================
-- 051: Oversize 요금 단일화 — 29,900원/주 확정
-- =============================================
-- price_max 제거 (범위 요금 → 단일 요금)

UPDATE storage_types
SET
  price_per_week = 29900,
  price_max      = NULL,
  updated_at     = now()
WHERE code = 'OVERSIZE';
