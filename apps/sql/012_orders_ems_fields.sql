-- ============================================================
-- 012_orders_ems_fields.sql
-- orders 테이블: 수취인 주소 분리 컬럼 + EMS 접수 결과 컬럼 추가
-- ============================================================

-- ── 수취인 주소 분리 저장 ──────────────────────────────────
-- EMS API는 addr1(주/도) / addr2(시/군) / addr3(상세) 를 분리 요구
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS recipient_addr1    TEXT,        -- 주/도 (State/Province)
  ADD COLUMN IF NOT EXISTS recipient_addr2    TEXT,        -- 시/군 (City)
  ADD COLUMN IF NOT EXISTS recipient_addr3    TEXT,        -- 상세주소 (Street)
  ADD COLUMN IF NOT EXISTS recipient_zip      TEXT,        -- 우편번호
  ADD COLUMN IF NOT EXISTS recipient_email    TEXT;        -- 수취인 이메일

-- ── EMS / K-Packet 접수 결과 ──────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ems_regino         TEXT,        -- 등기번호 (EG000001KR)
  ADD COLUMN IF NOT EXISTS ems_receive_seq    TEXT,        -- 접수번호
  ADD COLUMN IF NOT EXISTS ems_req_no         TEXT,        -- 예약번호
  ADD COLUMN IF NOT EXISTS ems_fee            INTEGER,     -- 우편요금 (KRW)
  ADD COLUMN IF NOT EXISTS ems_premium_cd     CHAR(2),     -- 31=EMS, 32=EMS프리미엄, 14=K-Packet
  ADD COLUMN IF NOT EXISTS ems_applied_at     TIMESTAMPTZ; -- EMS 접수 일시

-- ── 인덱스 ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_ems_regino ON orders(ems_regino);

COMMENT ON COLUMN orders.recipient_addr1   IS 'EMS 수취인 주소 — 주/도 (State/Province)';
COMMENT ON COLUMN orders.recipient_addr2   IS 'EMS 수취인 주소 — 시/군 (City)';
COMMENT ON COLUMN orders.recipient_addr3   IS 'EMS 수취인 주소 — 상세주소 (Street / Detail)';
COMMENT ON COLUMN orders.recipient_zip     IS '수취인 우편번호';
COMMENT ON COLUMN orders.recipient_email   IS '수취인 이메일 (EMS 전자통보용)';
COMMENT ON COLUMN orders.ems_regino        IS 'EMS/K-Packet 등기번호';
COMMENT ON COLUMN orders.ems_receive_seq   IS 'EMS 접수번호';
COMMENT ON COLUMN orders.ems_req_no        IS 'EMS 예약번호';
COMMENT ON COLUMN orders.ems_fee           IS 'EMS 우편요금(KRW)';
COMMENT ON COLUMN orders.ems_premium_cd    IS 'EMS 구분코드 (31/32/14)';
COMMENT ON COLUMN orders.ems_applied_at    IS 'EMS API 접수 완료 일시';
