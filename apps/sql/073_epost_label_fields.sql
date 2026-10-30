-- 우체국 접수 응답 중 송장에 찍는 값.
-- 해외: 접수우체국 영문명, 국기호
-- 국내: 접수일시(resDate), 안심번호(vTelNo)

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS ems_post_office      TEXT,
  ADD COLUMN IF NOT EXISTS ems_post_office_code TEXT;

COMMENT ON COLUMN orders.ems_post_office      IS 'EMS 접수 응답 treatporegipoengnm';
COMMENT ON COLUMN orders.ems_post_office_code IS 'EMS 접수 응답 treatporegipocd';

ALTER TABLE domestic_orders
  ADD COLUMN IF NOT EXISTS epost_res_date TEXT,
  ADD COLUMN IF NOT EXISTS epost_v_tel_no TEXT;

COMMENT ON COLUMN domestic_orders.epost_res_date IS 'InsertOrder 응답 resDate';
COMMENT ON COLUMN domestic_orders.epost_v_tel_no IS 'InsertOrder 응답 vTelNo';
