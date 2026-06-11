-- =============================================
-- 052: 스토리지 변경 요청
-- 용량 변경, 단기→장기 전환, 슬롯 추가 등 고객 요청 추적
-- PG 미연동 상태에서 관리자 수동 처리 플로우 지원
-- =============================================

CREATE TABLE storage_change_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  storage_id          UUID NOT NULL REFERENCES customer_storages(id) ON DELETE CASCADE,

  request_type        TEXT NOT NULL,
  -- 'CAPACITY_CHANGE'      : 용량(타입) 변경 요청
  -- 'CONVERT_TO_LONG_TERM' : 단기→장기 전환 요청
  -- 'ADD_SLOT'             : 추가 슬롯 배정 요청

  -- 용량 변경 시 선택한 타입
  requested_type_id   UUID REFERENCES storage_types(id) ON DELETE SET NULL,
  requested_type_code TEXT,   -- 빠른 조회용 비정규화

  -- 장기 전환 시 선택한 플랜
  requested_plan_type TEXT REFERENCES storage_plan_config(plan_type) ON DELETE SET NULL,

  -- 고객 메모
  customer_note       TEXT,

  -- 처리 상태
  status              TEXT NOT NULL DEFAULT 'PENDING',
  -- 'PENDING'   : 접수됨 (처리 대기)
  -- 'APPROVED'  : 승인됨 (로케이션 배정 등 처리 완료)
  -- 'REJECTED'  : 반려
  -- 'CANCELLED' : 고객이 취소

  admin_note          TEXT,     -- 관리자 처리 메모
  processed_by        UUID REFERENCES customers(id) ON DELETE SET NULL,
  processed_at        TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_request_type CHECK (
    request_type IN ('CAPACITY_CHANGE', 'CONVERT_TO_LONG_TERM', 'ADD_SLOT')
  ),
  CONSTRAINT valid_status CHECK (
    status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')
  )
);

CREATE INDEX idx_change_requests_user    ON storage_change_requests(user_id);
CREATE INDEX idx_change_requests_storage ON storage_change_requests(storage_id);
CREATE INDEX idx_change_requests_status  ON storage_change_requests(status);
CREATE INDEX idx_change_requests_pending ON storage_change_requests(created_at DESC)
  WHERE status = 'PENDING';

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION touch_storage_change_requests()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_change_requests_updated_at
  BEFORE UPDATE ON storage_change_requests
  FOR EACH ROW EXECUTE FUNCTION touch_storage_change_requests();

-- RLS
ALTER TABLE storage_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_own_change_requests"
  ON storage_change_requests FOR ALL
  USING (user_id = auth.uid());

COMMENT ON TABLE  storage_change_requests              IS '스토리지 변경 요청 — 용량변경·단기→장기전환·슬롯추가';
COMMENT ON COLUMN storage_change_requests.request_type IS 'CAPACITY_CHANGE=용량변경 | CONVERT_TO_LONG_TERM=장기전환 | ADD_SLOT=슬롯추가';
COMMENT ON COLUMN storage_change_requests.status       IS 'PENDING=대기 | APPROVED=승인 | REJECTED=반려 | CANCELLED=취소';
