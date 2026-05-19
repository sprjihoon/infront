-- =============================================
-- 우체국 수거 기능 추가 마이그레이션
-- =============================================

-- parcels 테이블에 수거 관련 컬럼 추가
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS pickup_tracking_no  TEXT,          -- 우체국 수거 운송장번호 (regiNo)
  ADD COLUMN IF NOT EXISTS pickup_address       TEXT,          -- 수거지 주소
  ADD COLUMN IF NOT EXISTS pickup_address_detail TEXT,         -- 수거지 상세주소
  ADD COLUMN IF NOT EXISTS pickup_zipcode       TEXT,          -- 수거지 우편번호
  ADD COLUMN IF NOT EXISTS pickup_phone         TEXT,          -- 수거지 연락처
  ADD COLUMN IF NOT EXISTS pickup_date          DATE,          -- 수거 희망일
  ADD COLUMN IF NOT EXISTS pickup_requested_at  TIMESTAMPTZ,  -- 수거 신청 일시
  ADD COLUMN IF NOT EXISTS epost_req_no         TEXT,          -- 우체국 소포주문번호
  ADD COLUMN IF NOT EXISTS epost_res_no         TEXT,          -- 우체국 예약번호
  ADD COLUMN IF NOT EXISTS epost_pickup_date    TEXT,          -- 우체국 응답 예약일시 (YYYYMMDDHHMMSS)
  ADD COLUMN IF NOT EXISTS epost_price          TEXT,          -- 수거 요금
  ADD COLUMN IF NOT EXISTS pickup_notes         TEXT;          -- 수거 요청사항

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_parcels_pickup_tracking ON parcels(pickup_tracking_no);

-- shipments 테이블 (국제배송 트래킹)
-- orders 테이블에 수거 신청 상태 추가
-- status: PENDING_PICKUP → PICKUP_BOOKED → INBOUND → ...

-- 수거 예약 상태 코드
-- PENDING_PICKUP: 수거 신청 전
-- PICKUP_BOOKED: 수거 예약 완료 (우체국 접수)
-- PICKED_UP: 수거 완료 (우체국 집하)
-- INBOUND: 입고 확인됨
