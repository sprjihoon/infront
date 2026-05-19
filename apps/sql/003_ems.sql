-- 003_ems.sql
-- parcels 테이블에 EMS/K-Packet 국제발송 관련 컬럼 추가

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS ems_regino        TEXT,        -- 등기번호 (EG000001KR)
  ADD COLUMN IF NOT EXISTS ems_receive_seq   TEXT,        -- 접수번호
  ADD COLUMN IF NOT EXISTS ems_req_no        TEXT,        -- 예약번호
  ADD COLUMN IF NOT EXISTS ems_fee           INTEGER,     -- 우편요금(KRW)
  ADD COLUMN IF NOT EXISTS ems_country       CHAR(2),     -- 목적국 코드
  ADD COLUMN IF NOT EXISTS ems_premium_cd    CHAR(2),     -- 31=EMS, 32=EMS프리미엄, 14=K-Packet
  ADD COLUMN IF NOT EXISTS ems_applied_at    TIMESTAMPTZ; -- EMS 신청일시

CREATE INDEX IF NOT EXISTS idx_parcels_ems_regino ON parcels(ems_regino);

COMMENT ON COLUMN parcels.ems_regino      IS 'EMS/K-Packet 등기번호';
COMMENT ON COLUMN parcels.ems_receive_seq IS 'EMS 접수번호';
COMMENT ON COLUMN parcels.ems_req_no      IS 'EMS 예약번호';
COMMENT ON COLUMN parcels.ems_fee         IS 'EMS 우편요금(KRW)';
COMMENT ON COLUMN parcels.ems_country     IS 'EMS 목적국 코드';
COMMENT ON COLUMN parcels.ems_premium_cd  IS 'EMS 우편물 구분코드 (31/32/14)';
