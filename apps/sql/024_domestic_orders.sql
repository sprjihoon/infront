-- ============================================================
-- 024_domestic_orders.sql
-- 국내 배송 신청 테이블
-- 고객이 창고에 보관된 물품을 국내 주소로 출고 요청
-- ============================================================

SET search_path = public;

CREATE TABLE IF NOT EXISTS domestic_orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FK는 customers 테이블이 확인된 후 별도 ALTER로 추가 가능
  -- ALTER TABLE domestic_orders ADD CONSTRAINT fk_domestic_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE;
  customer_id     UUID NOT NULL,

  -- 수령인 정보 (국내 주소)
  recipient_name  TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  recipient_zip   TEXT NOT NULL,
  recipient_addr1 TEXT NOT NULL,
  recipient_addr2 TEXT NOT NULL DEFAULT '',

  -- 연결된 소포 (창고 보관 물품)
  parcel_ids      UUID[] NOT NULL DEFAULT '{}',

  -- 내용품 정보
  items_desc      TEXT NOT NULL DEFAULT '의류',   -- 내용품 설명
  weight_g        INTEGER,                         -- 실측 무게 (g), 관리자 입력
  vol_length      NUMERIC(6,1),
  vol_width       NUMERIC(6,1),
  vol_height      NUMERIC(6,1),

  -- 우체국 소포 접수 결과
  epost_order_no  TEXT,          -- InsertOrder 요청 시 사용한 주문번호
  epost_regi_no   TEXT,          -- 운송장번호 (regiNo)
  epost_req_no    TEXT,          -- 접수번호 (reqNo)
  epost_res_no    TEXT,          -- 배달증번호 (resNo)
  epost_regi_po   TEXT,          -- 접수우체국
  epost_price     INTEGER,       -- 요금 (원)
  epost_applied_at TIMESTAMPTZ,

  -- 고객 요청 메시지
  delivery_msg    TEXT,

  -- 상태
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','BOOKED','IN_TRANSIT','DELIVERED','CANCELLED')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_domestic_orders_customer_id ON domestic_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_domestic_orders_status      ON domestic_orders(status);
CREATE INDEX IF NOT EXISTS idx_domestic_orders_epost_regi  ON domestic_orders(epost_regi_no);

-- RLS
ALTER TABLE domestic_orders ENABLE ROW LEVEL SECURITY;

-- 고객: 본인 주문만 조회
-- customers.id = auth.users.id (001_init.sql 구조)
CREATE POLICY "customer_select_own_domestic"
  ON domestic_orders FOR SELECT
  USING (customer_id = auth.uid());

-- 고객: 본인 주문 생성 (PENDING 상태만)
CREATE POLICY "customer_insert_domestic"
  ON domestic_orders FOR INSERT
  WITH CHECK (
    status = 'PENDING'
    AND customer_id = auth.uid()
  );

-- 고객: PENDING 상태인 본인 주문만 취소 가능
CREATE POLICY "customer_cancel_domestic"
  ON domestic_orders FOR UPDATE
  USING (
    status = 'PENDING'
    AND customer_id = auth.uid()
  )
  WITH CHECK (status = 'CANCELLED');

-- 관리자: service_role (admin client) 은 RLS 무시
