-- =============================================
-- 053: 스토리지 슬롯 간 이동 요청 지원
-- storage_change_requests에 TRANSFER_ITEMS 타입 추가
-- + target_storage_id 컬럼 추가
-- =============================================

-- 1) 이동 대상 스토리지 컬럼 추가
ALTER TABLE storage_change_requests
  ADD COLUMN IF NOT EXISTS target_storage_id UUID REFERENCES customer_storages(id) ON DELETE SET NULL;

-- 2) CHECK 제약 확장 (TRANSFER_ITEMS 추가)
ALTER TABLE storage_change_requests
  DROP CONSTRAINT IF EXISTS valid_request_type;

ALTER TABLE storage_change_requests
  ADD CONSTRAINT valid_request_type CHECK (
    request_type IN ('CAPACITY_CHANGE', 'CONVERT_TO_LONG_TERM', 'ADD_SLOT', 'TRANSFER_ITEMS')
  );

-- 3) 인덱스
CREATE INDEX IF NOT EXISTS idx_change_requests_target
  ON storage_change_requests(target_storage_id)
  WHERE target_storage_id IS NOT NULL;

COMMENT ON COLUMN storage_change_requests.target_storage_id IS 'TRANSFER_ITEMS 요청 시 이동 목적지 스토리지 ID';
