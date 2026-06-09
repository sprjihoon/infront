-- ============================================================
-- 048_parcel_storage_link_shippable.sql
-- SHIPPABLE 상태 소포를 customer_storage_id에 연결
-- - 046에서 SHIPPABLE 상태가 누락되어 세부 페이지에서 출고 가능 물품이 안 보이는 문제 수정
-- ============================================================

-- 1. 기존 SHIPPABLE 소포 소급 연결 (고객당 활성 스토리지가 있는 경우)
UPDATE parcels p
SET customer_storage_id = (
  SELECT cs.id FROM customer_storages cs
  WHERE cs.user_id = p.customer_id
    AND cs.status IN ('ACTIVE', 'PENDING_PAYMENT')
  ORDER BY cs.created_at DESC
  LIMIT 1
)
WHERE p.status IN ('SHIPPABLE', 'INSPECTION')
  AND p.customer_storage_id IS NULL
  AND EXISTS (
    SELECT 1 FROM customer_storages cs2
    WHERE cs2.user_id = p.customer_id
      AND cs2.status IN ('ACTIVE', 'PENDING_PAYMENT')
  );

-- 2. 트리거 함수에 SHIPPABLE, INSPECTION 상태 추가
CREATE OR REPLACE FUNCTION auto_link_parcel_to_storage()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_storage_id UUID;
BEGIN
  IF NEW.customer_storage_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('INBOUND', 'INSPECTING', 'INSPECTION', 'HOLD', 'READY', 'SHIPPABLE') THEN
    RETURN NEW;
  END IF;

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

-- 3. used_score 재계산
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
