-- =============================================
-- 041: 스토리지 결제 이력
-- PDF: 결제 유형 — 수거비, 단기보관, 장기월정, 출고비 등
-- =============================================

CREATE TABLE storage_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  storage_id        UUID REFERENCES customer_storages(id) ON DELETE SET NULL,

  -- 결제 유형
  payment_type      TEXT NOT NULL,
  -- ── 수거/입고 관련 ──────────────────────────────
  -- 'PICKUP_FEE'          : 수거비 (기본 3,000원)
  -- 'LISTING_FEE'         : 리스트 확인비 (500원/개)
  -- 'PHOTO_INSPECTION_FEE': 사진+검품 등록비 (1,000원/개)
  -- ── 보관 요금 ────────────────────────────────────
  -- 'SHORT_TERM_STORAGE'  : 단기보관 정산 (출고 시 주단위)
  -- 'LONG_TERM_MONTHLY'   : 장기보관 월정액 자동결제
  -- 'UPGRADE_FEE'         : 플랜 업그레이드 차액
  -- ── 출고/배송 관련 ──────────────────────────────
  -- 'RELEASE_FEE'         : 출고 처리비 (기본 1,000원)
  -- 'SHIPPING_FEE'        : 국내/국제 배송비
  -- 'OPEN_CHECK_FEE'      : 해외배송 전 개봉 확인비 (5,000원)
  -- ── 기타 ────────────────────────────────────────
  -- 'PENALTY_FEE'         : 연체 또는 위반 페널티

  amount            NUMERIC(10,0) NOT NULL,

  -- 항목 상세 (단기보관 정산, 리스트/사진 개수 등)
  item_count        INTEGER,
  -- 리스트확인비/사진확인비 시 물품 개수

  billing_weeks     INTEGER,
  -- 단기보관 정산 시 과금 주수

  billing_plan_type TEXT REFERENCES storage_plan_config(plan_type),
  -- 단기보관 정산 시 적용된 max_plan_type

  billing_memo      TEXT,
  -- 자유 메모 (예: '2주 × S플랜 주간요금 2,000원')

  -- PG 연동 정보 (KG Inicis)
  pg_provider       TEXT NOT NULL DEFAULT 'kg_inicis',
  pg_oid            TEXT,            -- KG Inicis OID (주문번호)
  pg_tid            TEXT,            -- KG Inicis TID (거래번호)
  pg_bill_key       TEXT,            -- 정기결제 빌키 (장기보관 자동결제)

  -- 상태
  status            TEXT NOT NULL DEFAULT 'PENDING',
  -- 'PENDING'    : 결제 요청 생성 (결제 전)
  -- 'PAID'       : 결제 완료
  -- 'FAILED'     : 결제 실패
  -- 'CANCELLED'  : 결제 취소/환불
  -- 'REFUNDED'   : 전액 환불

  approved_at       TIMESTAMPTZ,    -- 결제 승인 시각
  cancelled_at      TIMESTAMPTZ,    -- 취소/환불 시각
  fail_reason       TEXT,           -- 실패 사유

  raw               JSONB,          -- PG 응답 원본

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_payment_type CHECK (payment_type IN (
    'PICKUP_FEE', 'LISTING_FEE', 'PHOTO_INSPECTION_FEE',
    'SHORT_TERM_STORAGE', 'LONG_TERM_MONTHLY', 'UPGRADE_FEE',
    'RELEASE_FEE', 'SHIPPING_FEE', 'OPEN_CHECK_FEE', 'PENALTY_FEE'
  )),
  CONSTRAINT valid_status CHECK (
    status IN ('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED')
  )
);

CREATE INDEX idx_storage_payments_user     ON storage_payments(user_id);
CREATE INDEX idx_storage_payments_storage  ON storage_payments(storage_id);
CREATE INDEX idx_storage_payments_status   ON storage_payments(status);
CREATE INDEX idx_storage_payments_pg_oid   ON storage_payments(pg_oid) WHERE pg_oid IS NOT NULL;
CREATE INDEX idx_storage_payments_type_date ON storage_payments(payment_type, created_at DESC);

COMMENT ON TABLE storage_payments IS '스토리지 서비스 결제 이력 — 수거비, 보관료, 출고비 등 모든 요금';
COMMENT ON COLUMN storage_payments.billing_plan_type IS '단기보관 출고 시 과금 기준이 된 max_plan_type';
COMMENT ON COLUMN storage_payments.pg_bill_key IS 'KG Inicis 정기결제 빌키 (장기보관 자동결제 전용)';

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE storage_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_own_payments"
  ON storage_payments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "customers_insert_own_payment"
  ON storage_payments FOR INSERT
  WITH CHECK (user_id = auth.uid());
