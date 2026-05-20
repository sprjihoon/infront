-- ============================================================
-- 008_parcel_registration.sql
-- 고객 직접 물품 사전 등록 기능
-- ============================================================

-- parcels 테이블에 사전 등록 컬럼 추가
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS courier              TEXT,           -- 택배사 (CJ, 한진, 로젠, ...)
  ADD COLUMN IF NOT EXISTS item_condition       TEXT DEFAULT 'NEW', -- 물품 상태: NEW / USED
  ADD COLUMN IF NOT EXISTS pre_invoice_items    JSONB DEFAULT '[]', -- 사전 인보이스 품목
  ADD COLUMN IF NOT EXISTS sender_address       TEXT,           -- 발송인 주소 / 쇼핑몰명
  ADD COLUMN IF NOT EXISTS registered_by        TEXT DEFAULT 'STAFF'; -- CUSTOMER / STAFF

-- PRE_REGISTERED: 고객이 직접 등록한 물품 (택배 발송 후 등록)
-- 기존 status 컬럼에는 CHECK 제약이 없으므로 바로 사용 가능

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_parcels_tracking_no ON parcels(tracking_no);
