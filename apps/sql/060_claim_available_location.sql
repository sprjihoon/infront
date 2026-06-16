-- ================================================================
-- 060_claim_available_location.sql
-- 로케이션 원자적 선점 함수
-- SELECT FOR UPDATE SKIP LOCKED 으로 동시 배정 충돌 방지
-- ================================================================

CREATE OR REPLACE FUNCTION claim_available_location(
  p_type_id     UUID,
  p_customer_id UUID
)
RETURNS TABLE(id UUID, code TEXT, zone TEXT, slot TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE storage_locations sl
  SET
    status      = 'RESERVED',
    customer_id = p_customer_id,
    assigned_at = NOW()
  WHERE sl.id = (
    SELECT sl2.id
    FROM   storage_locations sl2
    WHERE  sl2.status          = 'AVAILABLE'
      AND  sl2.customer_id     IS NULL
      AND  sl2.storage_type_id = p_type_id
    ORDER BY sl2.zone, sl2.slot
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING sl.id, sl.code, sl.zone, sl.slot;
END;
$$;

-- typeCode 문자열로도 호출할 수 있는 오버로드
CREATE OR REPLACE FUNCTION claim_available_location_by_code(
  p_type_code   TEXT,
  p_customer_id UUID
)
RETURNS TABLE(id UUID, code TEXT, zone TEXT, slot TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_type_id UUID;
BEGIN
  SELECT st.id INTO v_type_id
  FROM   storage_types st
  WHERE  st.code = p_type_code
  LIMIT 1;

  IF v_type_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM claim_available_location(v_type_id, p_customer_id);
END;
$$;
