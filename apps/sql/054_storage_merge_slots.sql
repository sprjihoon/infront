-- =============================================
-- 054: 슬롯 합치기 요청 지원
-- storage_change_requests에 MERGE_SLOTS 타입 추가
-- + source_storage_ids 컬럼 추가 (합칠 소스 슬롯 목록)
-- =============================================

-- 1) 소스 슬롯 목록 컬럼 (UUID 배열)
ALTER TABLE storage_change_requests
  ADD COLUMN IF NOT EXISTS source_storage_ids UUID[] DEFAULT NULL;

-- 2) CHECK 제약 확장 (MERGE_SLOTS 추가)
ALTER TABLE storage_change_requests
  DROP CONSTRAINT IF EXISTS valid_request_type;

ALTER TABLE storage_change_requests
  ADD CONSTRAINT valid_request_type CHECK (
    request_type IN (
      'CAPACITY_CHANGE',
      'CONVERT_TO_LONG_TERM',
      'ADD_SLOT',
      'TRANSFER_ITEMS',
      'MERGE_SLOTS'
    )
  );

COMMENT ON COLUMN storage_change_requests.source_storage_ids IS
  'MERGE_SLOTS 요청 시 합칠 소스 스토리지 ID 목록 (target은 storage_id)';
