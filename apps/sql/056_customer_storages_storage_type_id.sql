-- =============================================
-- 056: customer_storages에 storage_type_id 추가
-- plan_type (→ storage_plan_config) = 청구 플랜 (S/M/L/XL)
-- storage_type_id (→ storage_types) = 물리 박스 타입 (MINI/STANDARD/LONG/XL/OVERSIZE)
-- 이전 코드에서 plan_type에 MINI/STANDARD 등을 넣어 FK 위반 발생
-- =============================================
ALTER TABLE customer_storages
  ADD COLUMN IF NOT EXISTS storage_type_id UUID REFERENCES storage_types(id) ON DELETE SET NULL;

COMMENT ON COLUMN customer_storages.storage_type_id IS '물리 보관함 타입 (storage_types.id) — 청구 플랜(plan_type)과 별개';
