-- =============================================
-- 032: 내부 바코드 시스템
-- =============================================

-- parcels 테이블에 내품수량 컬럼 추가
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS item_count INTEGER NOT NULL DEFAULT 1;

-- 내부 바코드 테이블
-- 바코드 번호 형식: {tracking_no}-{seq:02d}  예: 573842910234-01
CREATE TABLE parcel_barcodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id     UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  barcode_no    TEXT NOT NULL UNIQUE,   -- 예: 573842910234-01
  seq           INTEGER NOT NULL,       -- 1, 2, 3 ...
  item_name     TEXT,                   -- pre_invoice_items 에서 매핑된 품목명 (앞 30자)
  printed_at    TIMESTAMPTZ,            -- null: 미출력
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_parcel_barcodes_parcel   ON parcel_barcodes(parcel_id);
CREATE INDEX idx_parcel_barcodes_no       ON parcel_barcodes(barcode_no);
CREATE INDEX idx_parcel_barcodes_printed  ON parcel_barcodes(printed_at) WHERE printed_at IS NULL;

-- RLS: 어드민 전용
ALTER TABLE parcel_barcodes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  parcel_barcodes            IS '내부 작업용 바코드 — 송장번호+시퀀스 형식';
COMMENT ON COLUMN parcel_barcodes.barcode_no IS '형식: {tracking_no}-{seq 2자리}  예: 573842910234-01';
COMMENT ON COLUMN parcel_barcodes.item_name  IS 'pre_invoice_items 품목명 (앞 30자), 미등록 시 NULL';
COMMENT ON COLUMN parcel_barcodes.printed_at IS 'NULL=미출력, 출력 시각 기록';
