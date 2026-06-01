-- =============================================
-- 029: storage_locations 확장
--      + Zone/Type FK 연결
--      + 상태 세분화
--      + 슬롯 자동생성 함수
-- =============================================

-- -----------------------------------------------
-- 1. 새 컬럼 추가
-- -----------------------------------------------

-- Zone FK (storage_zones 참조)
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS zone_id UUID REFERENCES storage_zones(id) ON DELETE RESTRICT;

-- 타입 FK (storage_types 참조)
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS storage_type_id UUID REFERENCES storage_types(id) ON DELETE RESTRICT;

-- 용량 (타입 기본값을 개별 override 가능)
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS max_parcels INT;
  -- NULL이면 storage_types.max_parcels 를 따름

-- 반출 관련
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS pending_out_at       TIMESTAMPTZ;  -- 반출 요청 시각
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS pending_out_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;
  -- 반출과 연결된 해외배송 주문

-- 청구/결제 추적
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS last_billed_at TIMESTAMPTZ;  -- 마지막 청구 완료 시각
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS last_paid_at   TIMESTAMPTZ;  -- 마지막 결제 시각

-- -----------------------------------------------
-- 2. status 값 확장 (기존: AVAILABLE/OCCUPIED/DISABLED)
-- 추가: RESERVED, PENDING_OUT
-- TEXT 컬럼이므로 기존 데이터 영향 없음
-- -----------------------------------------------
-- AVAILABLE   : 비어있음, 즉시 배정 가능
-- RESERVED    : 고객 배정 완료, 아직 파슬 미입고
-- OCCUPIED    : 파슬 보관 중 (정상 사용)
-- PENDING_OUT : 반출 요청 접수됨, 곧 비워질 예정
-- DISABLED    : 사용불가 (파손, 점검, 영구 비활성)

COMMENT ON COLUMN storage_locations.status IS
  'AVAILABLE: 빈 슬롯 | RESERVED: 배정완료(파슬없음) | OCCUPIED: 보관중 | PENDING_OUT: 반출요청 | DISABLED: 사용불가';

-- -----------------------------------------------
-- 3. 추가 인덱스
-- -----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_storage_locations_zone_id
  ON storage_locations(zone_id);
CREATE INDEX IF NOT EXISTS idx_storage_locations_type_id
  ON storage_locations(storage_type_id);
CREATE INDEX IF NOT EXISTS idx_storage_locations_pending_out
  ON storage_locations(pending_out_at)
  WHERE pending_out_at IS NOT NULL;

-- -----------------------------------------------
-- 4. updated_at 자동 갱신 트리거 (026에 없었음)
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION touch_storage_locations()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_storage_locations_updated_at
  BEFORE UPDATE ON storage_locations
  FOR EACH ROW EXECUTE FUNCTION touch_storage_locations();

-- -----------------------------------------------
-- 5. Zone 슬롯 자동생성 함수
-- -----------------------------------------------
-- 사용 예:
--   SELECT generate_zone_slots('A 구역의 UUID', 'STANDARD 타입의 UUID', 1, 100);
--   → A-001 ~ A-100 을 storage_locations 에 INSERT

CREATE OR REPLACE FUNCTION generate_zone_slots(
  p_zone_id        UUID,
  p_type_id        UUID,
  p_start          INT DEFAULT 1,
  p_end            INT DEFAULT 100
)
RETURNS INT AS $$
DECLARE
  v_zone_code   TEXT;
  v_prefix      TEXT;
  v_pad_len     INT;
  v_inserted    INT := 0;
  n             INT;
  v_slot        TEXT;
  v_code        TEXT;
BEGIN
  -- Zone 코드 조회
  SELECT code, COALESCE(slot_prefix, code || '-')
  INTO v_zone_code, v_prefix
  FROM storage_zones
  WHERE id = p_zone_id;

  IF v_zone_code IS NULL THEN
    RAISE EXCEPTION 'storage_zones id=% not found', p_zone_id;
  END IF;

  -- 패딩 자릿수: p_end 의 자릿수에 맞춤 (최소 3자리)
  v_pad_len := GREATEST(3, LENGTH(p_end::TEXT));

  FOR n IN p_start .. p_end LOOP
    v_slot := LPAD(n::TEXT, v_pad_len, '0');
    v_code := v_prefix || v_slot;

    INSERT INTO storage_locations
      (zone_id, storage_type_id, zone, slot, code, status)
    VALUES
      (p_zone_id, p_type_id, v_zone_code, v_slot, v_code, 'AVAILABLE')
    ON CONFLICT (code) DO NOTHING;  -- 이미 있으면 스킵

    v_inserted := v_inserted + 1;
  END LOOP;

  -- Zone 의 slot_count 업데이트
  UPDATE storage_zones
  SET slot_count = (
    SELECT COUNT(*) FROM storage_locations WHERE zone_id = p_zone_id
  ),
  updated_at = now()
  WHERE id = p_zone_id;

  RETURN v_inserted;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------
-- 6. Zone 슬롯 일괄 비활성화 함수
-- -----------------------------------------------
-- 사용 예: SELECT disable_zone_slots('A 구역의 UUID');
-- 사용중 슬롯은 건너뜀 (OCCUPIED / RESERVED / PENDING_OUT)

CREATE OR REPLACE FUNCTION disable_zone_slots(p_zone_id UUID)
RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE storage_locations
  SET status = 'DISABLED', updated_at = now()
  WHERE zone_id = p_zone_id
    AND status = 'AVAILABLE';

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------
-- 7. 로케이션 고객 배정 헬퍼 함수
-- -----------------------------------------------
-- 사용 예: SELECT assign_storage(location_id, customer_id);

CREATE OR REPLACE FUNCTION assign_storage(
  p_location_id UUID,
  p_customer_id UUID
)
RETURNS VOID AS $$
BEGIN
  UPDATE storage_locations
  SET
    customer_id = p_customer_id,
    status      = 'RESERVED',
    assigned_at = now(),
    updated_at  = now()
  WHERE id = p_location_id
    AND status = 'AVAILABLE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'location % is not AVAILABLE', p_location_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------
-- 8. 로케이션 반납(해제) 헬퍼 함수
-- -----------------------------------------------
-- 사용 예: SELECT release_storage(location_id);

CREATE OR REPLACE FUNCTION release_storage(p_location_id UUID)
RETURNS VOID AS $$
DECLARE
  v_parcel_count INT;
BEGIN
  -- 아직 보관 중인 파슬이 있으면 반납 불가
  SELECT COUNT(*) INTO v_parcel_count
  FROM parcels
  WHERE storage_location_id = p_location_id;

  IF v_parcel_count > 0 THEN
    RAISE EXCEPTION 'location % still has % parcel(s)', p_location_id, v_parcel_count;
  END IF;

  UPDATE storage_locations
  SET
    customer_id          = NULL,
    status               = 'AVAILABLE',
    assigned_at          = NULL,
    pending_out_at       = NULL,
    pending_out_order_id = NULL,
    last_billed_at       = NULL,
    last_paid_at         = NULL,
    updated_at           = now()
  WHERE id = p_location_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_zone_slots IS
  'Zone 에 슬롯을 일괄 생성. generate_zone_slots(zone_id, type_id, 시작번호, 끝번호)';
COMMENT ON FUNCTION assign_storage IS
  '로케이션을 고객에게 배정 (AVAILABLE → RESERVED). 이미 사용중이면 예외 발생';
COMMENT ON FUNCTION release_storage IS
  '로케이션 반납 (파슬이 남아있으면 예외 발생)';
