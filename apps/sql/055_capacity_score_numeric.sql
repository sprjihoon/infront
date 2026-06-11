-- =============================================
-- 055: customer_storages capacity/used score를 NUMERIC으로 변경
-- "invalid input syntax for type integer: "40.5"" 오류 수정
-- =============================================

-- 1) used_score를 참조하는 트리거 임시 제거
DROP TRIGGER IF EXISTS trg_update_storage_max_plan ON customer_storages;

-- 2) usage_percent generated column 임시 제거
ALTER TABLE customer_storages
  DROP COLUMN IF EXISTS usage_percent;

-- 3) capacity_score / used_score → NUMERIC
ALTER TABLE customer_storages
  ALTER COLUMN capacity_score TYPE NUMERIC(8,2) USING capacity_score::NUMERIC(8,2);

ALTER TABLE customer_storages
  ALTER COLUMN used_score TYPE NUMERIC(8,2) USING used_score::NUMERIC(8,2);

-- 4) usage_percent generated column 재생성
ALTER TABLE customer_storages
  ADD COLUMN usage_percent NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN capacity_score IS NULL OR capacity_score = 0 THEN 0
      ELSE ROUND((used_score::NUMERIC / capacity_score::NUMERIC) * 100, 2)
    END
  ) STORED;

-- 5) 트리거 재생성
CREATE TRIGGER trg_update_storage_max_plan
  AFTER UPDATE OF used_score ON public.customer_storages
  FOR EACH ROW EXECUTE FUNCTION update_storage_max_plan();

COMMENT ON COLUMN customer_storages.capacity_score IS '보관함 총 용량 (volume_liter 기준, 소수점 허용)';
COMMENT ON COLUMN customer_storages.used_score IS '현재 사용 용량 (소수점 허용)';
COMMENT ON COLUMN customer_storages.usage_percent IS '사용율 (%) — capacity_score 기준 자동 계산';
