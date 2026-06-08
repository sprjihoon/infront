-- =============================================
-- 043: customer_storages 에 PENDING_PAYMENT 상태 추가
-- 스토리지 신청 후 수거비 결제 전 임시 상태
-- =============================================

ALTER TABLE customer_storages
  DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE customer_storages
  ADD CONSTRAINT valid_status CHECK (
    status IN (
      'PENDING_PAYMENT',  -- 결제 대기 (수거비 미결제)
      'ACTIVE',           -- 정상 이용 중
      'EMPTY',            -- 전량 출고 상태
      'SUSPENDED',        -- 결제 실패로 서비스 제한
      'OVERDUE',          -- 장기 미납 (30일+)
      'CANCELLED'         -- 해지 완료
    )
  );

COMMENT ON COLUMN customer_storages.status IS
  'PENDING_PAYMENT=수거비 결제 전 | ACTIVE=이용중 | EMPTY=비어있음 | SUSPENDED=제한 | OVERDUE=미납 | CANCELLED=해지';
