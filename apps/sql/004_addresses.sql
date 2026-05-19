-- ============================================================
-- 004_addresses.sql
-- 고객 주소록 — 수거배송지(pickup) / 해외배송지(overseas)
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_addresses (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id     UUID        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type            TEXT        NOT NULL CHECK (type IN ('pickup', 'overseas')),

  -- 공통
  label           TEXT        NOT NULL,          -- 표시명 (예: 집, 회사, 부모님댁)
  name            TEXT        NOT NULL,          -- 수거인 / 수취인 성명
  phone           TEXT,                          -- 연락처

  -- 국내 수거지 (type = 'pickup')
  zipcode         TEXT,
  address         TEXT,
  address_detail  TEXT,

  -- 해외 배송지 (type = 'overseas')
  country_code    CHAR(2),                       -- ISO 2자리 (JP, US, …)
  overseas_addr1  TEXT,                          -- 주/도 (State/Province)
  overseas_addr2  TEXT,                          -- 시/군 (City)
  overseas_addr3  TEXT,                          -- 상세주소 (Street)
  overseas_zip    TEXT,                          -- 우편번호
  email           TEXT,                          -- 이메일 (선택)

  is_default      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_type
  ON customer_addresses (customer_id, type);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION update_customer_addresses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON customer_addresses;
CREATE TRIGGER trg_customer_addresses_updated_at
  BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION update_customer_addresses_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;

-- 본인 주소만 읽기/쓰기
CREATE POLICY "addresses_self" ON customer_addresses
  FOR ALL TO authenticated
  USING  (customer_id = (SELECT id FROM customers WHERE auth_user_id = auth.uid()))
  WITH CHECK (customer_id = (SELECT id FROM customers WHERE auth_user_id = auth.uid()));
