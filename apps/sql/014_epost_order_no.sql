-- =============================================
-- 014_epost_order_no.sql
-- 우체국 InsertOrder 시 사용한 주문번호 저장
-- GetResInfo(수거 상태 조회) API 호출에 필요
-- =============================================

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS epost_order_no TEXT;  -- InsertOrder에 전달한 주문번호

CREATE INDEX IF NOT EXISTS idx_parcels_epost_order_no ON parcels(epost_order_no);
