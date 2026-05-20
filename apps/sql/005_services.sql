-- ============================================================
-- 005_services.sql
-- 서비스 카탈로그, 주문 서비스, 반품, 검수 결과
-- ============================================================

-- ── customers 테이블 auth_user_id 컬럼 추가 ─────────────────
-- (004_addresses.sql RLS 호환성: auth_user_id = id 미러)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id);
UPDATE customers SET auth_user_id = id WHERE auth_user_id IS NULL;

-- 신규 고객 생성 시 auth_user_id 자동 세팅
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customers (id, email, customer_code, personal_address, auth_user_id)
  VALUES (
    NEW.id,
    NEW.email,
    generate_customer_code(),
    '대구광역시 동구 동촌로 1 인프론트 (' || generate_customer_code() || ')',
    NEW.id
  )
  ON CONFLICT (id) DO UPDATE SET auth_user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── order_parcels INSERT 정책 추가 ──────────────────────────
DROP POLICY IF EXISTS "order_parcels_insert_self" ON order_parcels;
CREATE POLICY "order_parcels_insert_self" ON order_parcels FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));

-- ── 서비스 카탈로그 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        UNIQUE NOT NULL,
  category    TEXT        NOT NULL
    CHECK (category IN ('SHIPPING', 'PACKAGING', 'INSPECTION', 'BOX_DELIVERY', 'RETURN')),
  name        TEXT        NOT NULL,
  description TEXT,
  price       NUMERIC(10,0) NOT NULL DEFAULT 0,
  price_type  TEXT        NOT NULL DEFAULT 'FIXED'
    CHECK (price_type IN ('FIXED', 'BY_WEIGHT', 'BY_SIZE', 'FREE')),
  is_active   BOOLEAN     DEFAULT TRUE,
  sort_order  INT         DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 주문별 서비스 항목 ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_services (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id    UUID        NOT NULL REFERENCES services(id),
  quantity      INT         DEFAULT 1,
  unit_price    NUMERIC(10,0) NOT NULL DEFAULT 0,
  total_price   NUMERIC(10,0) NOT NULL DEFAULT 0,
  status        TEXT        DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'CONFIRMED', 'DONE', 'CANCELLED')),
  requested_by  TEXT        DEFAULT 'CUSTOMER'
    CHECK (requested_by IN ('CUSTOMER', 'STAFF')),
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 반품 요청 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS return_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id           UUID        NOT NULL REFERENCES parcels(id),
  customer_id         UUID        NOT NULL REFERENCES customers(id),
  request_stage       TEXT        NOT NULL
    CHECK (request_stage IN (
      'PRE_PICKUP', 'IN_TRANSIT', 'POST_INBOUND', 'POST_INSPECTION', 'FROM_OVERSEAS'
    )),
  reason              TEXT        NOT NULL
    CHECK (reason IN ('SIZE_MISMATCH', 'DEFECT', 'WRONG_ITEM', 'CHANGE_MIND', 'OTHER')),
  reason_note         TEXT,
  seller_name         TEXT        NOT NULL,
  seller_address      TEXT        NOT NULL,
  seller_phone        TEXT,
  prepaid_label_url   TEXT,
  inbound_tracking_no TEXT,
  return_tracking_no  TEXT,
  status              TEXT        DEFAULT 'REQUESTED'
    CHECK (status IN (
      'REQUESTED', 'WAITING_INBOUND', 'INSPECTING',
      'PACKED', 'SHIPPED', 'COMPLETED', 'CANCELLED'
    )),
  service_fee         NUMERIC(10,0) DEFAULT 0,
  shipping_fee        NUMERIC(10,0) DEFAULT 0,
  total_fee           NUMERIC(10,0) DEFAULT 0,
  payment_status      TEXT        DEFAULT 'UNPAID'
    CHECK (payment_status IN ('UNPAID', 'PAID', 'CANCELLED')),
  worker_id           UUID        REFERENCES auth.users(id),
  completed_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 검수 결과 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inspection_results (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id    UUID        NOT NULL REFERENCES parcels(id),
  inspector_id UUID        REFERENCES auth.users(id),
  -- { condition_ok, size_match, color_match, defect, defect_note, authenticity_ok }
  checklist    JSONB       DEFAULT '{}',
  grade        TEXT        DEFAULT 'OK'
    CHECK (grade IN ('OK', 'HOLD', 'RETURN_RECOMMENDED')),
  notes        TEXT,
  inspected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 기본 서비스 데이터 ───────────────────────────────────────
INSERT INTO services (code, category, name, description, price, price_type, sort_order) VALUES
  ('EMS',              'SHIPPING',      'EMS',            'EMS 국제우편 (3-7일)',         0, 'BY_WEIGHT', 1),
  ('EMS_PREMIUM',      'SHIPPING',      'EMS 프리미엄',   'EMS 프리미엄 (2-4일)',         0, 'BY_WEIGHT', 2),
  ('KPACKET',          'SHIPPING',      'K-Packet',       'K-Packet 소형 (7-15일)',        0, 'BY_WEIGHT', 3),
  ('BASIC_INSPECT',    'INSPECTION',    '기본 검수',      '외관 사진 촬영 (기본 포함)',    0, 'FREE',      10),
  ('DETAIL_INSPECT',   'INSPECTION',    '상세 검수',      '전체 사진 + 체크리스트',        3000, 'FIXED',  11),
  ('CLOTHING_INSPECT', 'INSPECTION',    '의류 검수',      '펼침/라벨/전후면 촬영',         2000, 'FIXED',  12),
  ('SAFE_PACK',        'PACKAGING',     '안전포장',       '에어캡, 완충재 추가',           3000, 'FIXED',  20),
  ('REPACK',           'PACKAGING',     '재포장',         '새 박스로 교체',                2000, 'FIXED',  21),
  ('CONSOLIDATE',      'PACKAGING',     '합포장',         '여러 물품을 하나로 합치기',     2000, 'FIXED',  22),
  ('BOX_S',            'BOX_DELIVERY',  '소형 박스 배송', '소형 박스 (20×20×20cm 이하)',   3000, 'FIXED',  30),
  ('BOX_M',            'BOX_DELIVERY',  '중형 박스 배송', '중형 박스 (40×30×30cm 이하)',   4000, 'FIXED',  31),
  ('BOX_L',            'BOX_DELIVERY',  '대형 박스 배송', '대형 박스 (60×50×50cm 이하)',   5000, 'FIXED',  32)
ON CONFLICT (code) DO NOTHING;

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE services          ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_services    ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_public_read" ON services
  FOR SELECT TO authenticated USING (is_active = TRUE);

CREATE POLICY "order_services_self" ON order_services
  FOR ALL USING (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()))
  WITH CHECK (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));

CREATE POLICY "return_requests_self" ON return_requests
  FOR ALL USING (customer_id = auth.uid())
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "inspection_results_visible" ON inspection_results
  FOR SELECT USING (
    parcel_id IN (SELECT id FROM parcels WHERE customer_id = auth.uid())
  );

-- ── 인덱스 ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_order_services_order   ON order_services(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_cust   ON return_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_inspection_parcel      ON inspection_results(parcel_id);
CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id ON customers(auth_user_id);
