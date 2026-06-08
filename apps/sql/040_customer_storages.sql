-- =============================================
-- 040: 고객 스토리지 서비스 (보관 서비스)
-- PDF: 인프론트 결제·스토리지·검품·해외배송 정책
-- =============================================

-- ─────────────────────────────────────────────
-- 스토리지 플랜 설정 (참조 테이블)
-- ─────────────────────────────────────────────
CREATE TABLE storage_plan_config (
  plan_type        TEXT PRIMARY KEY,          -- 'S' | 'M' | 'L' | 'XL'
  label_ko         TEXT NOT NULL,             -- '소형 스토리지'
  label_en         TEXT NOT NULL,             -- 'Small Storage'
  description_ko   TEXT,                      -- '계절 의류, 신발, 잡화 소량'
  capacity_score   INTEGER,                   -- 최대 수용 점수 (XL은 별도 견적이므로 NULL 허용)
  monthly_amount   NUMERIC(10,0),             -- 장기보관 월 이용료 (NULL=별도견적)
  weekly_rate      NUMERIC(10,0),             -- 단기보관 주간 요금
  sort_order       INTEGER NOT NULL DEFAULT 0
);

INSERT INTO storage_plan_config (plan_type, label_ko, label_en, description_ko, capacity_score, monthly_amount, weekly_rate, sort_order) VALUES
  ('S',  '소형 스토리지', 'Small Storage',   '계절 의류, 신발, 잡화 소량',          200,  8000,  2000, 1),
  ('M',  '중형 스토리지', 'Medium Storage',  '의류 여러 벌, 신발/잡화 박스',        400, 12000,  3000, 2),
  ('L',  '대형 스토리지', 'Large Storage',   '이불, 겨울옷, 큰 박스',              800, 18000,  5000, 3),
  ('XL', '특수 스토리지', 'Special Storage', '대형/특수 물품 별도 견적',           NULL,  NULL,  NULL, 4);

-- ─────────────────────────────────────────────
-- 내품 용량 점수 기준표 (참조 테이블)
-- PDF 11항: 공간 사용량 계산
-- ─────────────────────────────────────────────
CREATE TABLE item_capacity_scores (
  category      TEXT PRIMARY KEY,
  score         INTEGER NOT NULL,
  example_ko    TEXT,
  example_en    TEXT
);

INSERT INTO item_capacity_scores (category, score, example_ko, example_en) VALUES
  ('shirt',       1,  '티셔츠',      'T-shirt'),
  ('pants',       2,  '바지',        'Pants'),
  ('coat',        5,  '코트',        'Coat'),
  ('padding',     8,  '패딩',        'Padded jacket'),
  ('shoes',      10,  '신발 박스',   'Shoe box'),
  ('box_small',  30,  '소형 박스',   'Small box'),
  ('box_medium', 60,  '중형 박스',   'Medium box'),
  ('box_large', 100,  '대형 박스',   'Large box');

-- ─────────────────────────────────────────────
-- 고객 스토리지 (보관 공간)
-- PDF 1항: 스토리지 = 고객이 빌린 보관공간
-- ─────────────────────────────────────────────
CREATE TABLE customer_storages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  storage_name        TEXT NOT NULL DEFAULT '내 스토리지',  -- 고객 지정명

  -- 보관 모드
  storage_mode        TEXT NOT NULL DEFAULT 'short_term',
  -- 'short_term'  : 단기보관 (출고 시 주단위 정산)
  -- 'long_term'   : 장기보관 (월 단위 자동결제)

  -- 플랜 정보
  plan_type           TEXT REFERENCES storage_plan_config(plan_type),
  -- 현재 선택된 플랜 (장기보관 기준)

  current_plan_type   TEXT REFERENCES storage_plan_config(plan_type),
  -- 현재 used_score 기준 사이즈 (단기보관 실시간 추적)

  max_plan_type       TEXT REFERENCES storage_plan_config(plan_type),
  -- 보관 기간 중 최대 사용 사이즈 (단기보관 출고 시 과금 기준)

  -- 요금 정보
  monthly_amount      NUMERIC(10,0),
  -- 장기보관 월 이용료 (plan_type 기준, XL은 별도 견적)

  -- 공간 사용량
  capacity_score      INTEGER,
  -- plan_type 기준 최대 수용 점수 (storage_plan_config.capacity_score)

  used_score          INTEGER NOT NULL DEFAULT 0,
  -- 현재 보관 중인 내품 총 점수

  usage_percent       NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN capacity_score > 0
         THEN ROUND((used_score::NUMERIC / capacity_score::NUMERIC) * 100, 2)
         ELSE 0
    END
  ) STORED,

  -- 상태
  status              TEXT NOT NULL DEFAULT 'ACTIVE',
  -- 'ACTIVE'       : 정상 이용 중
  -- 'EMPTY'        : 전량 출고 상태 (유지/해지 선택 대기)
  -- 'SUSPENDED'    : 결제 실패로 서비스 제한
  -- 'OVERDUE'      : 장기 미납 (30일+)
  -- 'CANCELLED'    : 해지 완료

  -- 단기보관 타임트래킹
  short_term_started_at TIMESTAMPTZ,
  -- 단기보관 시작 시각 (수거 완료 시점)

  -- 장기보관 결제 관리
  paid_until_date     DATE,
  -- 장기보관 결제 만료일 (이 날짜까지 선불 결제됨)

  next_billing_date   DATE,
  -- 다음 자동결제 예정일

  -- 장기전환 추적 (단기 → 장기)
  long_term_notified_at TIMESTAMPTZ,
  -- 25일차 전환 안내 발송 시각

  long_term_requested_at TIMESTAMPTZ,
  -- 30일차 요금제 선택 요청 시각

  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_storage_mode CHECK (storage_mode IN ('short_term', 'long_term')),
  CONSTRAINT valid_status CHECK (
    status IN ('ACTIVE', 'EMPTY', 'SUSPENDED', 'OVERDUE', 'CANCELLED')
  )
);

CREATE INDEX idx_customer_storages_user     ON customer_storages(user_id);
CREATE INDEX idx_customer_storages_status   ON customer_storages(status);
CREATE INDEX idx_customer_storages_billing  ON customer_storages(next_billing_date)
  WHERE status = 'ACTIVE' AND storage_mode = 'long_term';

COMMENT ON TABLE customer_storages IS '고객 스토리지 — 단기/장기 보관 공간 관리';
COMMENT ON COLUMN customer_storages.max_plan_type IS '단기보관 출고 시 과금 기준: 보관 기간 중 사용한 최대 사이즈';
COMMENT ON COLUMN customer_storages.usage_percent IS '(used_score / capacity_score) × 100, 자동 계산됨';

-- ─────────────────────────────────────────────
-- 고객 스토리지 내품 (보관 물품)
-- PDF 2항: 내품 = 스토리지 안에 보관되는 개별 물품
-- ─────────────────────────────────────────────
CREATE TABLE customer_storage_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  storage_id          UUID NOT NULL REFERENCES customer_storages(id) ON DELETE CASCADE,

  -- 물품 정보
  product_name        TEXT NOT NULL,
  category            TEXT REFERENCES item_capacity_scores(category),
  -- 카테고리 매핑 시 자동으로 capacity_score 참조 가능

  image_url           TEXT,
  -- 센터 사진촬영 시 저장되는 이미지 URL

  capacity_score      INTEGER NOT NULL DEFAULT 1,
  -- 이 아이템이 차지하는 공간 점수

  -- 창고 위치
  location_code       TEXT,
  -- 물리적 창고 로케이션 코드 (storage_locations.code 참조)

  -- 상태
  status              TEXT NOT NULL DEFAULT 'IN_STORAGE',
  -- 'PENDING_INBOUND' : 수거 완료, 입고 대기
  -- 'IN_STORAGE'      : 보관 중
  -- 'PENDING_RELEASE' : 출고 요청됨
  -- 'RELEASED'        : 출고 완료

  -- 정보 출처 및 검증 상태
  source              TEXT NOT NULL DEFAULT 'customer',
  -- 'customer'      : 고객이 수거 신청 시 직접 입력 (신고 정보)
  -- 'center_list'   : 센터 리스트 확인 (500원/개)
  -- 'center_photo'  : 센터 사진+검품+전산등록 (1,000원/개)

  verification_status TEXT NOT NULL DEFAULT 'unverified',
  -- 'unverified'    : 미확인 (고객 신고만)
  -- 'list_only'     : 수량/품목 확인 완료 (사진 없음)
  -- 'photo_verified': 사진+검품 완료

  -- 타임스탬프
  received_at         TIMESTAMPTZ,   -- 센터 입고 시각
  released_at         TIMESTAMPTZ,   -- 출고 완료 시각
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT valid_item_status CHECK (
    status IN ('PENDING_INBOUND', 'IN_STORAGE', 'PENDING_RELEASE', 'RELEASED')
  ),
  CONSTRAINT valid_source CHECK (
    source IN ('customer', 'center_list', 'center_photo')
  ),
  CONSTRAINT valid_verification CHECK (
    verification_status IN ('unverified', 'list_only', 'photo_verified')
  )
);

CREATE INDEX idx_storage_items_storage    ON customer_storage_items(storage_id);
CREATE INDEX idx_storage_items_user       ON customer_storage_items(user_id);
CREATE INDEX idx_storage_items_status     ON customer_storage_items(status);

COMMENT ON TABLE customer_storage_items IS '고객 스토리지 내품 — 스토리지 안에 보관되는 개별 물품';
COMMENT ON COLUMN customer_storage_items.source IS 'customer=고객 신고, center_list=센터 리스트 확인(500원), center_photo=사진+검품(1,000원)';

-- ─────────────────────────────────────────────
-- used_score 자동 갱신 트리거
-- 아이템 변경 시 customer_storages.used_score 업데이트
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_storage_used_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE customer_storages
  SET
    used_score = (
      SELECT COALESCE(SUM(capacity_score), 0)
      FROM customer_storage_items
      WHERE storage_id = COALESCE(NEW.storage_id, OLD.storage_id)
        AND status IN ('IN_STORAGE', 'PENDING_RELEASE')
    ),
    updated_at = now()
  WHERE id = COALESCE(NEW.storage_id, OLD.storage_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_storage_score
AFTER INSERT OR UPDATE OR DELETE ON customer_storage_items
FOR EACH ROW EXECUTE FUNCTION update_storage_used_score();

-- max_plan_type 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_storage_max_plan()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_used    INTEGER;
  v_current TEXT;
  v_max     TEXT;
BEGIN
  SELECT used_score, current_plan_type, max_plan_type
    INTO v_used, v_current, v_max
    FROM customer_storages
   WHERE id = NEW.id;

  -- used_score 기준 current_plan_type 계산
  v_current := CASE
    WHEN v_used <= 200 THEN 'S'
    WHEN v_used <= 400 THEN 'M'
    WHEN v_used <= 800 THEN 'L'
    ELSE 'XL'
  END;

  -- max_plan_type: 기존 값보다 크면 갱신 (단기보관 전용)
  IF v_max IS NULL OR (
    ARRAY_POSITION(ARRAY['S','M','L','XL'], v_current) >
    ARRAY_POSITION(ARRAY['S','M','L','XL'], v_max)
  ) THEN
    v_max := v_current;
  END IF;

  UPDATE customer_storages
  SET current_plan_type = v_current,
      max_plan_type      = v_max,
      updated_at         = now()
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_storage_max_plan
AFTER UPDATE OF used_score ON customer_storages
FOR EACH ROW EXECUTE FUNCTION update_storage_max_plan();

-- ─────────────────────────────────────────────
-- RLS 정책
-- ─────────────────────────────────────────────
ALTER TABLE storage_plan_config     ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_capacity_scores    ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_storages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_storage_items  ENABLE ROW LEVEL SECURITY;

-- 플랜 설정 및 점수표: 전체 읽기 허용
CREATE POLICY "public_read_plan_config"
  ON storage_plan_config FOR SELECT USING (true);

CREATE POLICY "public_read_capacity_scores"
  ON item_capacity_scores FOR SELECT USING (true);

-- 고객 스토리지: 본인 것만 조회/수정
CREATE POLICY "customers_own_storages"
  ON customer_storages FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "customers_own_storage_items"
  ON customer_storage_items FOR ALL
  USING (user_id = auth.uid());
