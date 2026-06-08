-- =============================================
-- 042: 장기보관 정기결제 프로파일
-- PDF: 빌링 계약 후 자동결제 관리
-- =============================================

CREATE TABLE storage_recurring_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  storage_id          UUID NOT NULL REFERENCES customer_storages(id) ON DELETE CASCADE,

  -- KG Inicis 빌키 (AES256 암호화 보관)
  pg_bill_key         TEXT NOT NULL,
  -- KG Inicis 빌링 계약 후 발급된 BillKey
  -- 실제 운영 시 AES256 암호화 후 저장 권장

  pg_provider         TEXT NOT NULL DEFAULT 'kg_inicis',

  -- 결제 설정
  monthly_amount      NUMERIC(10,0) NOT NULL,
  -- 월 결제 금액 (plan_type 기준)

  plan_type           TEXT REFERENCES storage_plan_config(plan_type),
  -- 적용 중인 플랜

  -- 결제 일정
  billing_day         INTEGER NOT NULL DEFAULT 1,
  -- 매월 결제일 (1~28 사이)

  next_billing_date   DATE NOT NULL,
  -- 다음 결제 예정일

  last_billing_date   DATE,
  -- 마지막 성공 결제일

  -- 상태
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  -- 'ACTIVE'     : 정상 자동결제
  -- 'PAUSED'     : 일시정지 (고객 요청 또는 실패 후 대기)
  -- 'CANCELLED'  : 해지 (더 이상 자동결제 없음)

  -- 실패 추적
  fail_count          INTEGER NOT NULL DEFAULT 0,
  -- 연속 결제 실패 횟수

  last_fail_at        TIMESTAMPTZ,
  -- 마지막 실패 시각

  last_fail_reason    TEXT,
  -- 마지막 실패 사유

  -- PDF: 결제 실패 에스컬레이션
  -- D+0 실패: 즉시 재시도 → 실패 시 고객 알림
  -- D+3 재시도: 자동 재결제
  -- D+7 재시도: 자동 재결제
  -- D+14 서비스 제한: SUSPENDED
  -- D+30 해지 처리: OVERDUE → CANCELLED
  escalation_level    INTEGER NOT NULL DEFAULT 0,
  -- 0: 정상 | 1: 1차 실패 알림 | 2: D+3 재시도 | 3: D+7 재시도
  -- 4: D+14 서비스 제한 | 5: D+30 해지

  next_retry_at       TIMESTAMPTZ,
  -- 다음 재시도 예정 시각 (null = 재시도 없음)

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 스토리지당 활성 프로파일은 하나만
  CONSTRAINT unique_active_profile UNIQUE (storage_id, status)
  DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT valid_status CHECK (
    status IN ('ACTIVE', 'PAUSED', 'CANCELLED')
  ),
  CONSTRAINT valid_billing_day CHECK (billing_day BETWEEN 1 AND 28)
);

CREATE INDEX idx_recurring_user     ON storage_recurring_profiles(user_id);
CREATE INDEX idx_recurring_storage  ON storage_recurring_profiles(storage_id);
CREATE INDEX idx_recurring_next_bill ON storage_recurring_profiles(next_billing_date)
  WHERE status = 'ACTIVE';
CREATE INDEX idx_recurring_retry    ON storage_recurring_profiles(next_retry_at)
  WHERE next_retry_at IS NOT NULL AND status = 'PAUSED';

COMMENT ON TABLE storage_recurring_profiles IS '장기보관 자동결제 프로파일 — KG Inicis 빌키 기반 월정액 관리';
COMMENT ON COLUMN storage_recurring_profiles.pg_bill_key IS 'KG Inicis 빌링키 (운영 환경에서는 AES256 암호화 후 저장)';
COMMENT ON COLUMN storage_recurring_profiles.escalation_level IS '0=정상, 1=첫실패알림, 2=D+3재시도, 3=D+7재시도, 4=D+14서비스제한, 5=D+30해지처리';

-- ─────────────────────────────────────────────
-- 결제 실패 에스컬레이션 이력
-- 언제 어떤 에스컬레이션이 발생했는지 추적
-- ─────────────────────────────────────────────
CREATE TABLE storage_escalation_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  storage_id        UUID NOT NULL REFERENCES customer_storages(id) ON DELETE CASCADE,
  recurring_id      UUID REFERENCES storage_recurring_profiles(id) ON DELETE SET NULL,
  payment_id        UUID REFERENCES storage_payments(id) ON DELETE SET NULL,

  event_type        TEXT NOT NULL,
  -- 'PAYMENT_FAILED'  : 결제 실패 발생
  -- 'RETRY_SCHEDULED' : 재시도 예약
  -- 'RETRY_ATTEMPT'   : 재시도 실행
  -- 'SERVICE_LIMITED' : D+14 서비스 제한
  -- 'CANCELLED'       : D+30 자동 해지
  -- 'PAYMENT_RECOVERED': 결제 복구 성공
  -- 'CUSTOMER_NOTIFIED': 고객 알림 발송

  escalation_level  INTEGER,
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_escalation_storage ON storage_escalation_logs(storage_id);
CREATE INDEX idx_escalation_user    ON storage_escalation_logs(user_id);

COMMENT ON TABLE storage_escalation_logs IS '결제 실패 에스컬레이션 이력 — D+0/3/7/14/30 단계별 이벤트 추적';

-- ─────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────
ALTER TABLE storage_recurring_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_escalation_logs     ENABLE ROW LEVEL SECURITY;

-- 고객: 본인 프로파일 조회만 (수정은 서비스 롤만)
CREATE POLICY "customers_own_recurring"
  ON storage_recurring_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "customers_own_escalation"
  ON storage_escalation_logs FOR SELECT
  USING (user_id = auth.uid());
