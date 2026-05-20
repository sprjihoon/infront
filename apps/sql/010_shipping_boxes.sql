-- ============================================================
-- 010_shipping_boxes.sql
-- 반출(출고) 박스 관리 - 국제 배송 박스 단위 추적
-- 1개 주문 = N개 박스 (각 박스별 개별 운송장)
-- ============================================================

-- ─────────────────────────────────────────────
-- shipping_boxes: 국제배송 물리 박스
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipping_boxes (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  box_seq          INT         NOT NULL DEFAULT 1,  -- 같은 주문 내 박스 순번 (1, 2, ...)
  -- 물리 정보
  weight_kg        NUMERIC(6,2),                   -- 실측 무게 (kg)
  length_cm        NUMERIC(6,1),                   -- 가로
  width_cm         NUMERIC(6,1),                   -- 세로
  height_cm        NUMERIC(6,1),                   -- 높이
  -- 배송
  intl_tracking_no TEXT,                           -- 국제 운송장 번호 (EMS/DHL 등)
  carrier          TEXT,                           -- 운송사 (EMS, DHL, FEDEX …)
  shipped_at       TIMESTAMPTZ,                    -- 발송 일시
  -- 상태
  status           TEXT        NOT NULL DEFAULT 'PREPARING'
    CHECK (status IN ('PREPARING', 'PACKED', 'SHIPPED', 'DELIVERED')),
  -- 운임 (박스별 분담)
  shipping_fee     NUMERIC(10,0),                  -- 이 박스의 배송비 (원)
  -- 어드민 메모
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_boxes_order ON shipping_boxes(order_id);
CREATE INDEX IF NOT EXISTS idx_shipping_boxes_tracking ON shipping_boxes(intl_tracking_no)
  WHERE intl_tracking_no IS NOT NULL;

-- 고객은 자신 주문에 속한 박스만 읽기 가능 (쓰기는 어드민만)
ALTER TABLE shipping_boxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shipping_boxes_customer_read"
  ON shipping_boxes FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM orders WHERE customer_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- box_items: 박스 내 품목 배정 (Phase 2)
-- parcel.pre_invoice_items 배열의 개별 아이템을 박스에 연결
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS box_items (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  box_id           UUID        NOT NULL REFERENCES shipping_boxes(id) ON DELETE CASCADE,
  parcel_id        UUID        NOT NULL REFERENCES parcels(id),
  -- pre_invoice_items 배열에서의 인덱스 (0-based)
  item_index       INT         NOT NULL DEFAULT 0,
  -- 스냅샷 (인보이스용 - 원본 변경 대비)
  name_en          TEXT        NOT NULL,
  quantity         INT         NOT NULL DEFAULT 1,
  unit_price_usd   NUMERIC(10,2) NOT NULL DEFAULT 0,
  origin_country   TEXT        NOT NULL DEFAULT 'KR',
  hs_code          TEXT,
  item_condition   TEXT        DEFAULT 'NEW' CHECK (item_condition IN ('NEW', 'USED')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_box_items_box ON box_items(box_id);
CREATE INDEX IF NOT EXISTS idx_box_items_parcel ON box_items(parcel_id);

-- 고객은 자신 박스의 품목만 읽기 가능
ALTER TABLE box_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "box_items_customer_read"
  ON box_items FOR SELECT
  USING (
    box_id IN (
      SELECT sb.id FROM shipping_boxes sb
      JOIN orders o ON o.id = sb.order_id
      WHERE o.customer_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────
-- orders 테이블: intl_tracking_no 컬럼 deprecated 표시
-- (실제 운송장은 shipping_boxes에서 관리)
-- 하위 호환을 위해 컬럼은 유지하되 주석 추가
-- ─────────────────────────────────────────────
COMMENT ON COLUMN orders.intl_tracking_no IS
  '[DEPRECATED] 단일 박스용. 복수 박스는 shipping_boxes.intl_tracking_no 사용';

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shipping_boxes_updated_at ON shipping_boxes;
CREATE TRIGGER shipping_boxes_updated_at
  BEFORE UPDATE ON shipping_boxes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
