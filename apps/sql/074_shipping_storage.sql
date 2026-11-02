-- 배송전용 스토리지. 장기보관이 없는 고객의 배송 물건을 담는 자리.
-- 고객당 해지되지 않은 배송전용 스토리지는 하나.

ALTER TABLE customer_storages DROP CONSTRAINT IF EXISTS valid_storage_mode;

ALTER TABLE customer_storages
  ADD CONSTRAINT valid_storage_mode
  CHECK (storage_mode IN ('short_term', 'long_term', 'shipping'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_shipping_storage
  ON customer_storages (user_id)
  WHERE storage_mode = 'shipping' AND status <> 'CANCELLED';

COMMENT ON COLUMN customer_storages.storage_mode IS
  'short_term=이전 단기 | long_term=보관 | shipping=배송전용(대기 중 자동빌링 없음)';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS storage_fee NUMERIC(10,0) NOT NULL DEFAULT 0;

ALTER TABLE domestic_orders
  ADD COLUMN IF NOT EXISTS storage_fee NUMERIC(10,0) NOT NULL DEFAULT 0;

COMMENT ON COLUMN orders.storage_fee IS
  '출고 한 장에 포함한 보관료. 배송전용은 기다린 달, 장기보관은 전량 출고 시 잔여만.';

CREATE TABLE IF NOT EXISTS box_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  purpose       TEXT NOT NULL,
  size_code     TEXT NOT NULL,
  qty           INTEGER NOT NULL DEFAULT 1,
  address       TEXT NOT NULL,
  address_detail TEXT,
  zipcode       TEXT,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'REQUESTED',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT box_requests_purpose CHECK (purpose IN ('storage', 'shipping')),
  CONSTRAINT box_requests_qty CHECK (qty >= 1 AND qty <= 20),
  CONSTRAINT box_requests_status CHECK (status IN ('REQUESTED', 'SENT', 'CANCELLED'))
);

ALTER TABLE box_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "box_requests_own" ON box_requests
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
