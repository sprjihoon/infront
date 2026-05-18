-- =============================================
-- 스프링박스 (SpringBox) 초기 스키마
-- =============================================

-- 고객 테이블
CREATE TABLE customers (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  phone TEXT,
  customer_code TEXT NOT NULL UNIQUE, -- SPB-20260518-0001
  personal_address TEXT,              -- 개인 입고주소
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 개별 입고 물품 (국내로 오는 parcel)
CREATE TABLE parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tracking_no TEXT,                   -- 국내 송장번호
  sender_name TEXT,
  sender_phone TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_PICKUP',
  -- PENDING_PICKUP / PICKED_UP / INBOUND / INSPECTION / HOLD / DONE
  inbound_at TIMESTAMPTZ,
  weight_actual NUMERIC(8,1),         -- 실측 무게 (g)
  volume_l NUMERIC(6,1),              -- 가로 (cm)
  volume_w NUMERIC(6,1),              -- 세로 (cm)
  volume_h NUMERIC(6,1),              -- 높이 (cm)
  is_shippable BOOLEAN,               -- 발송 가능 여부
  hold_reason TEXT,                   -- 보류 사유
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 해외배송 주문 (parcels 묶음)
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_no TEXT NOT NULL UNIQUE,      -- SPB-ORD-20260518-0001
  status TEXT NOT NULL DEFAULT 'DRAFT',
  -- DRAFT / PENDING_PICKUP / PICKED_UP / INBOUND / INSPECTION /
  -- HOLD / PACKAGING_REQUESTED / PACKAGING_DONE / QUOTE_SENT /
  -- PENDING_PAYMENT / PAID / CUSTOMS_FILING / IN_TRANSIT / DELIVERED / CANCELLED
  packaging_type TEXT DEFAULT 'NONE', -- NONE / REPACK / COMBINED / SPECIAL
  packaging_fee NUMERIC(10,0) DEFAULT 0,
  actual_weight NUMERIC(8,1),
  volume_weight NUMERIC(8,1),         -- 부피중량
  chargeable_weight NUMERIC(8,1),     -- 적용 무게 (실측 vs 부피 중 큰 것)
  shipping_method TEXT,               -- EMS / EMS_PREMIUM / KPACKET
  shipping_fee NUMERIC(10,0) DEFAULT 0,
  extra_fee NUMERIC(10,0) DEFAULT 0,
  total_amount NUMERIC(10,0) DEFAULT 0,
  payment_status TEXT DEFAULT 'UNPAID', -- UNPAID / PAID / CANCELLED
  payment_key TEXT,                   -- Toss 결제키
  -- 수취인 정보
  recipient_name TEXT,
  recipient_phone TEXT,
  recipient_address TEXT,
  recipient_country TEXT,             -- ISO 2자리 국가코드 (KR, US, JP ...)
  customs_value NUMERIC(10,2),        -- 세관신고 금액 (USD)
  -- 물품 리스트 (JSON)
  item_list JSONB DEFAULT '[]',
  -- 국제 운송장
  intl_tracking_no TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 주문-물품 연결 (합포장)
CREATE TABLE order_parcels (
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  PRIMARY KEY (order_id, parcel_id)
);

-- 단계별 미디어 (사진/영상)
CREATE TABLE parcel_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  -- INBOUND_VIDEO / INSPECTION_PHOTO / PACKAGING_PHOTO / OUTBOUND_VIDEO / RECEIPT_PHOTO
  type TEXT NOT NULL DEFAULT 'PHOTO',  -- PHOTO / VIDEO
  -- 사진 전용
  storage_url TEXT,
  -- 영상 전용 (Cloudflare Stream)
  cf_stream_uid TEXT,
  cf_thumbnail_url TEXT,
  cf_hls_url TEXT,
  duration_sec INTEGER,
  caption TEXT,
  is_visible BOOLEAN DEFAULT TRUE,     -- 고객 공개 여부
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 포장 요청/작업
CREATE TABLE packaging_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                  -- COMBINED / REPACK / SPECIAL
  instruction TEXT,
  status TEXT DEFAULT 'PENDING',       -- PENDING / IN_PROGRESS / DONE
  worker_id UUID REFERENCES auth.users(id),
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 결제
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC(10,0) NOT NULL,
  method TEXT,
  toss_payment_key TEXT UNIQUE,
  toss_order_id TEXT,
  status TEXT DEFAULT 'PENDING',       -- PENDING / DONE / CANCELLED / PARTIAL_CANCELLED
  approved_at TIMESTAMPTZ,
  raw JSONB,                           -- Toss 응답 원본
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 알림
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  parcel_id UUID REFERENCES parcels(id),
  type TEXT NOT NULL,                  -- INBOUND / INSPECTION / QUOTE / PAYMENT / SHIPPED / DELIVERED / HOLD
  title TEXT NOT NULL,
  body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- RLS 활성화
-- =============================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE parcel_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE packaging_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS 정책 (고객: 본인 데이터만)
-- =============================================

CREATE POLICY "customers_self" ON customers FOR ALL USING (id = auth.uid());

CREATE POLICY "parcels_self" ON parcels FOR ALL USING (customer_id = auth.uid());

CREATE POLICY "orders_self" ON orders FOR ALL USING (customer_id = auth.uid());

CREATE POLICY "order_parcels_self" ON order_parcels FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));

CREATE POLICY "parcel_media_visible" ON parcel_media FOR SELECT
  USING (
    is_visible = TRUE AND (
      parcel_id IN (SELECT id FROM parcels WHERE customer_id = auth.uid())
      OR order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
    )
  );

CREATE POLICY "payments_self" ON payments FOR SELECT
  USING (order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid()));

CREATE POLICY "notifications_self" ON notifications FOR ALL
  USING (customer_id = auth.uid());

-- =============================================
-- 고객번호 자동 생성 함수
-- =============================================

CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TEXT AS $$
DECLARE
  seq INT;
  code TEXT;
BEGIN
  SELECT COUNT(*) + 1 INTO seq FROM customers;
  code := 'SPB-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 4, '0');
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- 신규 회원 자동 고객 등록 트리거
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO customers (id, email, customer_code, personal_address)
  VALUES (
    NEW.id,
    NEW.email,
    generate_customer_code(),
    '경기도 OO시 OO동 스프링박스 물류센터 (' || generate_customer_code() || ')'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- 인덱스
-- =============================================

CREATE INDEX idx_parcels_customer ON parcels(customer_id);
CREATE INDEX idx_parcels_tracking ON parcels(tracking_no);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_parcel_media_parcel ON parcel_media(parcel_id);
CREATE INDEX idx_parcel_media_order ON parcel_media(order_id);
CREATE INDEX idx_notifications_customer ON notifications(customer_id, is_read);
