-- ============================================================
-- 013_return_requests_v2.sql
-- 반품 요청 테이블 개편
--
-- [고객 반품신청] CUSTOMER_REQUEST
--   · 고객이 직접 반품신청 → 반송택배사에 전달만 하면 끝
--   · 반품사유 / 상세사유 / 반품시점 불필요 (우리가 알 필요 없음)
--   · 수거전(PRE_PICKUP) 단계 등 request_stage 불필요
--   · 처리비 1,000원 무조건 부과 (service_fee = 1000)
--   · 반송택배비는 고객 부담 — 우리 DB 관리 불필요
--
-- [검수불량 반품] INSPECTION_DEFECT
--   · 우리가 검수 → 불량 판정(grade = RETURN_RECOMMENDED)
--   · inspection_results 와 연결
--   · 처리비 1,000원 + 검수비 결제요청(PAYMENT_REQUESTED) 발송
-- ============================================================

-- ── 불필요 컬럼 제거 ─────────────────────────────────────
ALTER TABLE return_requests
  DROP COLUMN IF EXISTS reason,
  DROP COLUMN IF EXISTS reason_note,
  DROP COLUMN IF EXISTS request_stage,
  DROP COLUMN IF EXISTS shipping_fee,   -- 반송택배비는 고객 부담, 우리 관리 불필요
  DROP COLUMN IF EXISTS total_fee;      -- service_fee 단일화로 중복

-- ── 처리비 기본값 1,000원 ────────────────────────────────
-- 반품 유형 무관하게 처리비 1,000원 고정
ALTER TABLE return_requests
  ALTER COLUMN service_fee SET DEFAULT 1000;

-- ── 반품 유형 추가 ───────────────────────────────────────
ALTER TABLE return_requests
  ADD COLUMN IF NOT EXISTS return_type TEXT NOT NULL DEFAULT 'CUSTOMER_REQUEST'
    CHECK (return_type IN ('CUSTOMER_REQUEST', 'INSPECTION_DEFECT')),
  ADD COLUMN IF NOT EXISTS inspection_result_id UUID REFERENCES inspection_results(id);

-- inspection_result_id 는 INSPECTION_DEFECT 일 때만 세팅
-- (앱 레이어에서 보장, DB constraint 는 nullable 유지)

-- ── seller 정보 nullable 허용 ─────────────────────────────
-- INSPECTION_DEFECT 시 판매자 정보가 없을 수 있으므로
ALTER TABLE return_requests
  ALTER COLUMN seller_name    DROP NOT NULL,
  ALTER COLUMN seller_address DROP NOT NULL;

-- ── status ENUM 재정의 ────────────────────────────────────
-- PAYMENT_REQUESTED: 처리비/검수비 결제요청 발송 상태
ALTER TABLE return_requests
  DROP CONSTRAINT IF EXISTS return_requests_status_check;

ALTER TABLE return_requests
  ADD CONSTRAINT return_requests_status_check CHECK (status IN (
    'REQUESTED',          -- 반품 신청됨
    'PAYMENT_REQUESTED',  -- 처리비 결제요청 발송 (INSPECTION_DEFECT 는 검수비 포함)
    'SHIPPED',            -- 반송 발송 완료
    'COMPLETED',          -- 처리 완료
    'CANCELLED'           -- 취소
  ));

-- ── RETURN_PROCESS 서비스 항목 추가 ─────────────────────
INSERT INTO services (code, category, name, description, price, price_type, sort_order)
VALUES ('RETURN_PROCESS', 'RETURN', '반품 처리비', '반품 접수 및 반송 처리', 1000, 'FIXED', 40)
ON CONFLICT (code) DO NOTHING;

-- ── 인덱스 ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rr_return_type       ON return_requests(return_type);
CREATE INDEX IF NOT EXISTS idx_rr_inspection_result ON return_requests(inspection_result_id);
CREATE INDEX IF NOT EXISTS idx_rr_payment_status    ON return_requests(payment_status);
