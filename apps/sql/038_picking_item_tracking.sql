-- ============================================================
-- 038_picking_item_tracking.sql
-- 피킹 아이템 단위 상태 추적 + 스캔 이력
--
-- parcel_barcodes 에 피킹 상태 컬럼 추가:
--   WAITING → DONE | HOLD | NOT_FOUND
-- picking_scan_logs: 모든 스캔 시도 기록 (정상·오스캔·중복·미등록)
-- ============================================================

SET search_path = public;

-- ── parcel_barcodes: 피킹 상태 컬럼 추가 ────────────────────
ALTER TABLE parcel_barcodes
  ADD COLUMN IF NOT EXISTS picking_status TEXT NOT NULL DEFAULT 'WAITING'
    CHECK (picking_status IN ('WAITING', 'DONE', 'HOLD', 'NOT_FOUND')),
  ADD COLUMN IF NOT EXISTS picking_reason TEXT,
  ADD COLUMN IF NOT EXISTS picking_note   TEXT,
  ADD COLUMN IF NOT EXISTS picked_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_parcel_barcodes_picking_status
  ON parcel_barcodes (picking_status);

COMMENT ON COLUMN parcel_barcodes.picking_status
  IS 'WAITING: 대기, DONE: 피킹완료, HOLD: 보류, NOT_FOUND: 물품없음';
COMMENT ON COLUMN parcel_barcodes.picking_reason
  IS '수동 처리 사유 (보류·물품없음·수동완료 시 필수)';

-- ── picking_scan_logs: 스캔 이력 ────────────────────────────
CREATE TABLE IF NOT EXISTS picking_scan_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL,
  order_type  TEXT NOT NULL CHECK (order_type IN ('intl', 'domestic')),
  barcode_no  TEXT NOT NULL,
  scan_result TEXT NOT NULL
    CHECK (scan_result IN ('PICKED', 'WRONG_ORDER', 'DUPLICATE', 'NOT_FOUND')),
  scanned_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scanned_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_picking_scan_logs_order
  ON picking_scan_logs (order_id);
CREATE INDEX IF NOT EXISTS idx_picking_scan_logs_barcode
  ON picking_scan_logs (barcode_no);
CREATE INDEX IF NOT EXISTS idx_picking_scan_logs_worker
  ON picking_scan_logs (scanned_by);
CREATE INDEX IF NOT EXISTS idx_picking_scan_logs_at
  ON picking_scan_logs (scanned_at DESC);

ALTER TABLE picking_scan_logs ENABLE ROW LEVEL SECURITY;
-- service_role (adminDb) 은 RLS 우회하므로 별도 정책 불필요

COMMENT ON TABLE  picking_scan_logs            IS '피킹 스캔 이력 — 정상/오스캔/중복/미등록 전부 기록';
COMMENT ON COLUMN picking_scan_logs.scan_result IS 'PICKED: 정상, WRONG_ORDER: 오스캔, DUPLICATE: 중복, NOT_FOUND: 미등록';
