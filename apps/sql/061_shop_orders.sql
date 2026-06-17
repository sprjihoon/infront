-- ============================================================
-- 061_shop_orders.sql
-- 샵 주문 테이블 — 비회원 포장대행 결제 주문
-- 수취인 주소를 addr1/2/3으로 분리 저장하여 EMS 접수에 활용
-- ============================================================

CREATE TABLE IF NOT EXISTS shop_orders (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- KG이니시스 주문번호 (SHOP-{timestamp}-{hex})
  oid              TEXT        NOT NULL UNIQUE,

  -- 상품
  product_id       TEXT        NOT NULL,
  amount           INTEGER     NOT NULL,

  -- 주문 상태
  status           TEXT        NOT NULL DEFAULT 'PENDING_PAYMENT',
  -- PENDING_PAYMENT / PAID / CANCELLED

  -- ── 보내는 분 (발송인) ─────────────────────────────────────
  sender_name      TEXT        NOT NULL,
  sender_phone     TEXT        NOT NULL,
  sender_zipcode   TEXT,
  sender_address   TEXT,
  sender_detail    TEXT,
  sender_email     TEXT        NOT NULL,

  -- ── 받는 분 (수취인) ───────────────────────────────────────
  recipient_name   TEXT        NOT NULL,
  recipient_phone  TEXT,
  recipient_zipcode TEXT,
  recipient_address TEXT,
  recipient_detail  TEXT,
  recipient_addr1  TEXT,        -- 주/도 (sido)
  recipient_addr2  TEXT,        -- 시/군구 (sigungu)
  recipient_addr3  TEXT,        -- 도로명 + 상세주소
  recipient_email  TEXT,

  -- ── KG이니시스 결제 결과 ───────────────────────────────────
  inicis_tid       TEXT,
  paid_at          TIMESTAMPTZ,

  -- ── EMS 접수 결과 (관리자 처리 후 기록) ───────────────────
  ems_regino       TEXT,        -- 등기번호 (EG000001KR)
  ems_receive_seq  TEXT,        -- 접수번호
  ems_req_no       TEXT,        -- 예약번호
  ems_fee          INTEGER,     -- 우편요금 (KRW)
  ems_premium_cd   CHAR(2),     -- 31=EMS, 32=EMS프리미엄, 14=K-Packet
  ems_applied_at   TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_shop_orders_oid        ON shop_orders(oid);
CREATE INDEX IF NOT EXISTS idx_shop_orders_status     ON shop_orders(status);
CREATE INDEX IF NOT EXISTS idx_shop_orders_created_at ON shop_orders(created_at DESC);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_shop_orders_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shop_orders_updated_at ON shop_orders;
CREATE TRIGGER trg_shop_orders_updated_at
  BEFORE UPDATE ON shop_orders
  FOR EACH ROW EXECUTE FUNCTION update_shop_orders_updated_at();

-- 컬럼 설명
COMMENT ON TABLE  shop_orders                  IS '샵 포장대행 주문 (비회원 결제)';
COMMENT ON COLUMN shop_orders.oid              IS 'KG이니시스 주문번호';
COMMENT ON COLUMN shop_orders.recipient_addr1  IS 'EMS 수취인 주소 — 주/도 (sido)';
COMMENT ON COLUMN shop_orders.recipient_addr2  IS 'EMS 수취인 주소 — 시/군구 (sigungu)';
COMMENT ON COLUMN shop_orders.recipient_addr3  IS 'EMS 수취인 주소 — 도로명+상세';
COMMENT ON COLUMN shop_orders.ems_regino       IS 'EMS/K-Packet 등기번호';
COMMENT ON COLUMN shop_orders.ems_receive_seq  IS 'EMS 접수번호';
COMMENT ON COLUMN shop_orders.ems_req_no       IS 'EMS 예약번호';
COMMENT ON COLUMN shop_orders.ems_fee          IS 'EMS 우편요금(KRW)';
COMMENT ON COLUMN shop_orders.ems_premium_cd   IS 'EMS 구분코드 (31/32/14)';
COMMENT ON COLUMN shop_orders.ems_applied_at   IS 'EMS API 접수 완료 일시';
