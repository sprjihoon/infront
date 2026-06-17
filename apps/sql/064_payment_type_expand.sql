-- ============================================================
-- 064_payment_type_expand.sql
-- storage_payments.payment_type 제약 확장
-- 기존: PICKUP_FEE, LISTING_FEE, PHOTO_INSPECTION_FEE,
--       SHORT_TERM_STORAGE, LONG_TERM_MONTHLY, UPGRADE_FEE,
--       RELEASE_FEE, SHIPPING_FEE, OPEN_CHECK_FEE, PENALTY_FEE
-- 추가: LONG_TERM_FIRST (장기보관 첫 결제: 수거비+첫달 통합)
-- ============================================================

ALTER TABLE storage_payments
  DROP CONSTRAINT IF EXISTS valid_payment_type;

ALTER TABLE storage_payments
  ADD CONSTRAINT valid_payment_type CHECK (payment_type IN (
    'PICKUP_FEE',             -- 수거비
    'LISTING_FEE',            -- 리스트 확인비
    'PHOTO_INSPECTION_FEE',   -- 사진+검품 등록비
    'SHORT_TERM_STORAGE',     -- 단기보관 정산 (출고 시 주단위)
    'LONG_TERM_MONTHLY',      -- 장기보관 월정액 (자동결제 빌링)
    'LONG_TERM_FIRST',        -- 장기보관 첫 결제 (수거비+첫달 통합 일반결제)
    'UPGRADE_FEE',            -- 플랜 업그레이드 차액
    'RELEASE_FEE',            -- 출고 처리비
    'SHIPPING_FEE',           -- 국내/국제 배송비
    'OPEN_CHECK_FEE',         -- 해외배송 전 개봉 확인비
    'PENALTY_FEE'             -- 연체/위반 페널티
  ));

-- vbank (가상계좌) 입금 대기 상태 추가
ALTER TABLE storage_payments
  DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE storage_payments
  ADD CONSTRAINT valid_status CHECK (
    status IN ('PENDING', 'WAITING_VBANK', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')
  );

-- vbank 관련 컬럼 추가
ALTER TABLE storage_payments
  ADD COLUMN IF NOT EXISTS pg_vbank_num    TEXT,       -- 가상계좌 번호
  ADD COLUMN IF NOT EXISTS pg_vbank_name   TEXT,       -- 은행명
  ADD COLUMN IF NOT EXISTS pg_vbank_expiry TIMESTAMPTZ; -- 입금 기한

COMMENT ON COLUMN storage_payments.pg_vbank_num    IS '가상계좌 번호';
COMMENT ON COLUMN storage_payments.pg_vbank_name   IS '가상계좌 은행명';
COMMENT ON COLUMN storage_payments.pg_vbank_expiry IS '가상계좌 입금 기한';
