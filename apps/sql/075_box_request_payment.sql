-- 빈 박스 신청은 결제 전에 PENDING_PAYMENT, 결제 후 REQUESTED.

ALTER TABLE box_requests DROP CONSTRAINT IF EXISTS box_requests_status;

ALTER TABLE box_requests
  ADD CONSTRAINT box_requests_status
  CHECK (status IN ('PENDING_PAYMENT', 'REQUESTED', 'SENT', 'CANCELLED'));

ALTER TABLE box_requests ADD COLUMN IF NOT EXISTS pg_oid TEXT;
ALTER TABLE box_requests ADD COLUMN IF NOT EXISTS amount INTEGER;
