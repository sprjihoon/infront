-- ============================================================
-- 045_storage_capacity_v2.sql
-- 스토리지 용량 체계 변경: 점수 → 아이템 개수 기반
-- - storage_plan_config.capacity_score = 플랜별 최대 수용 개수
-- - customer_storages.capacity_override = 관리자 개별 수동 설정 (nullable)
-- - customer_storages.used_score → COUNT(active items) 트리거
-- ============================================================

-- 1. 플랜별 기본 최대 수용 개수 업데이트 (점수 → 개수)
UPDATE storage_plan_config SET capacity_score = 10 WHERE plan_type = 'S';
UPDATE storage_plan_config SET capacity_score = 20 WHERE plan_type = 'M';
UPDATE storage_plan_config SET capacity_score = 30 WHERE plan_type = 'L';
-- XL은 별도 견적이므로 NULL 유지

-- 2. customer_storages에 관리자 수동 용량 설정 컬럼 추가
ALTER TABLE customer_storages
  ADD COLUMN IF NOT EXISTS capacity_override INTEGER DEFAULT NULL;

COMMENT ON COLUMN customer_storages.capacity_override
  IS '관리자가 수동으로 설정한 최대 보관 개수. NULL이면 plan capacity_score 적용';

-- 기존 customer_storages.capacity_score를 플랜 기본값으로 초기화
UPDATE customer_storages cs
SET capacity_score = spc.capacity_score
FROM storage_plan_config spc
WHERE spc.plan_type = cs.plan_type
  AND spc.capacity_score IS NOT NULL;

-- 3. used_score 트리거 교체: 점수 합산 → 활성 아이템 COUNT
CREATE OR REPLACE FUNCTION update_storage_used_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_storage_id UUID;
BEGIN
  -- INSERT / UPDATE / DELETE 모두 처리
  v_storage_id := COALESCE(NEW.storage_id, OLD.storage_id);
  IF v_storage_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE customer_storages
  SET
    used_score = (
      SELECT COUNT(*)
      FROM customer_storage_items
      WHERE storage_id = v_storage_id
        AND status NOT IN ('RELEASED', 'DISPOSED')
    ),
    updated_at = NOW()
  WHERE id = v_storage_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4. 기존 used_score 값을 실제 COUNT로 재계산
UPDATE customer_storages cs
SET used_score = (
  SELECT COUNT(*)
  FROM customer_storage_items csi
  WHERE csi.storage_id = cs.id
    AND csi.status NOT IN ('RELEASED', 'DISPOSED')
);

-- 5. usage_percent 계산 함수: capacity_override 우선 적용
-- (기존 generated column은 유지, 단 capacity_score에 override가 반영됨)
-- capacity_override 설정 시 capacity_score도 같이 갱신하는 트리거
CREATE OR REPLACE FUNCTION sync_capacity_score_from_override()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- capacity_override가 설정되면 capacity_score에도 반영 (usage_percent 자동 계산용)
  IF NEW.capacity_override IS NOT NULL THEN
    NEW.capacity_score := NEW.capacity_override;
  ELSIF NEW.plan_type IS NOT NULL THEN
    SELECT capacity_score INTO NEW.capacity_score
    FROM storage_plan_config
    WHERE plan_type = NEW.plan_type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_capacity_score ON customer_storages;
CREATE TRIGGER trg_sync_capacity_score
  BEFORE INSERT OR UPDATE OF capacity_override, plan_type
  ON customer_storages
  FOR EACH ROW
  EXECUTE FUNCTION sync_capacity_score_from_override();
