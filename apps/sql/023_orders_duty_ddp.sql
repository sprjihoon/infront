-- DDP(관세 선납) — 우체국 DDP 가능 국가만 적용
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS duty_prepaid       BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duty_estimate_usd  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS duty_deposit_krw   NUMERIC(10,0) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duty_paid_krw      NUMERIC(10,0);

COMMENT ON COLUMN orders.duty_prepaid      IS '고객 관세 선납(DDP) 신청 여부';
COMMENT ON COLUMN orders.duty_estimate_usd   IS '관세 예상액 USD (보수적 산출)';
COMMENT ON COLUMN orders.duty_deposit_krw    IS '고객 청구 관세 선납액 KRW (견적·결제 포함)';
COMMENT ON COLUMN orders.duty_paid_krw       IS '우체국 등 실제 관세 납부액 KRW (admin 기록)';
