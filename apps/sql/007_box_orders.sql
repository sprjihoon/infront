-- ============================================================
-- 007_box_orders.sql
-- 빈 박스 배송 주문
-- ============================================================

CREATE TABLE IF NOT EXISTS box_orders (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id          UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_no             TEXT        NOT NULL UNIQUE,   -- BOX-20260520-0001
  box_code             TEXT        NOT NULL
    CHECK (box_code IN ('BOX_S', 'BOX_M', 'BOX_L')),
  quantity             INT         NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price           NUMERIC(10,0) NOT NULL,
  total_amount         NUMERIC(10,0) NOT NULL,
  -- 배송지 (국내)
  delivery_name        TEXT        NOT NULL,
  delivery_phone       TEXT        NOT NULL,
  delivery_zipcode     TEXT        NOT NULL,
  delivery_address     TEXT        NOT NULL,
  delivery_address_detail TEXT,
  -- 처리
  status               TEXT        DEFAULT 'PENDING_PAYMENT'
    CHECK (status IN ('PENDING_PAYMENT', 'PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED')),
  payment_status       TEXT        DEFAULT 'UNPAID'
    CHECK (payment_status IN ('UNPAID', 'PAID', 'CANCELLED')),
  payment_key          TEXT,
  tracking_no          TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_box_orders_customer ON box_orders(customer_id);

ALTER TABLE box_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "box_orders_self" ON box_orders
  FOR ALL USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());
