-- ============================================================
-- 046_parcel_storage_link.sql
-- parcels ↔ customer_storages 연결
-- - parcels.customer_storage_id FK 추가
-- - 기존 INBOUND 물품을 고객의 활성 스토리지에 자동 연결
-- - 신규 입고 시 자동 연결 트리거
-- ============================================================

-- 1. parcels에 customer_storage_id 컬럼 추가
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS customer_storage_id UUID
    REFERENCES customer_storages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parcels_customer_storage
  ON parcels(customer_storage_id)
  WHERE customer_storage_id IS NOT NULL;

COMMENT ON COLUMN parcels.customer_storage_id
  IS '이 소포가 속한 고객 보관 서비스 스토리지. NULL이면 미분류';

-- 2. 기존 INBOUND 물품을 고객의 활성 스토리지에 자동 연결
-- (고객당 활성 스토리지가 1개인 경우 자동 매핑)
UPDATE parcels p
SET customer_storage_id = cs.id
FROM customer_storages cs
WHERE cs.user_id = p.customer_id
  AND cs.status IN ('ACTIVE', 'PENDING_PAYMENT')
  AND p.status IN ('INBOUND', 'INSPECTING', 'HOLD', 'READY')
  AND p.customer_storage_id IS NULL
  -- 고객당 활성 스토리지가 1개일 때만 자동 매핑
  AND (
    SELECT COUNT(*) FROM customer_storages cs2
    WHERE cs2.user_id = p.customer_id
      AND cs2.status IN ('ACTIVE', 'PENDING_PAYMENT')
  ) = 1;

-- 3. 새 소포 입고 시 자동으로 활성 스토리지에 연결하는 트리거
CREATE OR REPLACE FUNCTION auto_link_parcel_to_storage()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_storage_id UUID;
BEGIN
  -- 이미 스토리지가 지정되어 있으면 스킵
  IF NEW.customer_storage_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- status가 INBOUND 등 입고 상태일 때만 처리
  IF NEW.status NOT IN ('INBOUND', 'INSPECTING', 'HOLD', 'READY') THEN
    RETURN NEW;
  END IF;

  -- 고객의 활성 스토리지가 정확히 1개인 경우 자동 연결
  SELECT id INTO v_storage_id
  FROM customer_storages
  WHERE user_id = NEW.customer_id
    AND status IN ('ACTIVE', 'PENDING_PAYMENT')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_storage_id IS NOT NULL THEN
    NEW.customer_storage_id := v_storage_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_parcel_to_storage ON parcels;
CREATE TRIGGER trg_auto_link_parcel_to_storage
  BEFORE INSERT OR UPDATE OF status
  ON parcels
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_parcel_to_storage();

-- 4. used_score 트리거에 parcels도 포함 (스토리지 용량에 소포도 반영)
CREATE OR REPLACE FUNCTION update_storage_used_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_storage_id UUID;
BEGIN
  v_storage_id := COALESCE(NEW.customer_storage_id, OLD.customer_storage_id);
  IF v_storage_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  UPDATE customer_storages
  SET
    used_score = (
      -- customer_storage_items COUNT
      (SELECT COUNT(*) FROM customer_storage_items
       WHERE storage_id = v_storage_id
         AND status NOT IN ('RELEASED', 'DISPOSED'))
      +
      -- parcels COUNT
      (SELECT COUNT(*) FROM parcels
       WHERE customer_storage_id = v_storage_id
         AND status NOT IN ('SHIPPED', 'RETURNED', 'PICKUP_CANCELLED', 'DISPOSED'))
    ),
    updated_at = NOW()
  WHERE id = v_storage_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- parcels 테이블에도 used_score 갱신 트리거 적용
DROP TRIGGER IF EXISTS trg_update_storage_score_on_parcel ON parcels;
CREATE TRIGGER trg_update_storage_score_on_parcel
  AFTER INSERT OR UPDATE OR DELETE ON parcels
  FOR EACH ROW
  EXECUTE FUNCTION update_storage_used_score();

-- 5. 연결 후 used_score 재계산
UPDATE customer_storages cs
SET used_score = (
  (SELECT COUNT(*) FROM customer_storage_items csi
   WHERE csi.storage_id = cs.id
     AND csi.status NOT IN ('RELEASED', 'DISPOSED'))
  +
  (SELECT COUNT(*) FROM parcels p
   WHERE p.customer_storage_id = cs.id
     AND p.status NOT IN ('SHIPPED', 'RETURNED', 'PICKUP_CANCELLED', 'DISPOSED'))
);
