-- ============================================================
-- 037_outbound_picking.sql
-- 피킹 / 출고처리 워크플로우 지원
--
-- 상태 흐름:
--   orders:          PAID → PICKING → PICKING_DONE → OUTBOUND_WAIT → IN_TRANSIT
--   domestic_orders: PENDING → PICKING → PICKING_DONE → BOOKED → IN_TRANSIT
-- ============================================================

SET search_path = public;

-- ── orders 테이블 피킹·출고 컬럼 추가 ─────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS picking_started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picking_done_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outbound_weight_g        NUMERIC(8,1),
  ADD COLUMN IF NOT EXISTS outbound_length_cm       NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS outbound_width_cm        NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS outbound_height_cm       NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS outbound_label_printed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at               TIMESTAMPTZ;

-- ── domestic_orders: CHECK 제약 수정 + 피킹·출고 컬럼 추가 ────
-- PICKING / PICKING_DONE 상태 추가
ALTER TABLE domestic_orders
  DROP CONSTRAINT IF EXISTS domestic_orders_status_check;

ALTER TABLE domestic_orders
  ADD CONSTRAINT domestic_orders_status_check
    CHECK (status IN (
      'PENDING', 'PICKING', 'PICKING_DONE',
      'BOOKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'
    ));

ALTER TABLE domestic_orders
  ADD COLUMN IF NOT EXISTS picking_started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picking_done_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS outbound_weight_g        NUMERIC(8,1),
  ADD COLUMN IF NOT EXISTS outbound_length_cm       NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS outbound_width_cm        NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS outbound_height_cm       NUMERIC(6,1),
  ADD COLUMN IF NOT EXISTS outbound_label_printed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shipped_at               TIMESTAMPTZ;

-- ── 인덱스 ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_picking_status
  ON orders (status)
  WHERE status IN ('PAID', 'PICKING', 'PICKING_DONE', 'OUTBOUND_WAIT');

CREATE INDEX IF NOT EXISTS idx_domestic_orders_picking_status
  ON domestic_orders (status)
  WHERE status IN ('PENDING', 'PICKING', 'PICKING_DONE');
