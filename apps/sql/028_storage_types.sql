-- =============================================
-- 028: 스토리지 타입 정의
-- =============================================
-- 스토리지 타입은 storage_locations 에 적용되는 물리 규격 + 요금 정의
-- is_active=FALSE 로 단종 처리 (기존 로케이션 데이터 보존)

CREATE TABLE storage_types (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 식별
  code            TEXT NOT NULL UNIQUE,  -- 'MINI' / 'STANDARD' / 'LONG' / 'XL' / 'OVERSIZE'
  name            TEXT NOT NULL,         -- 'Mini Storage'
  description     TEXT,                  -- '액세서리, 소형 잡화, 작은 의류'

  -- 물리 규격 (mm)
  dim_l_mm        INT  NOT NULL,         -- 가로
  dim_w_mm        INT  NOT NULL,         -- 세로
  dim_h_mm        INT  NOT NULL,         -- 높이
  volume_liter    NUMERIC(8,1),          -- 용적 (L) — 수동 입력 (소수점 반올림 대응)

  -- 최대 수용
  max_parcels     INT  NOT NULL DEFAULT 10, -- 타입별 기본 파슬 수 상한

  -- 요금 (주 단위)
  price_per_week  NUMERIC(10,0) NOT NULL,   -- 기본 1주 요금
  price_max       NUMERIC(10,0),            -- 상한 요금 (범위 요금일 때: Oversize 등)

  -- 운영
  sort_order      INT  NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- FALSE: 신규 배정 중단, 기존 로케이션 유지

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_storage_types_code      ON storage_types(code);
CREATE INDEX idx_storage_types_sort      ON storage_types(sort_order);
CREATE INDEX idx_storage_types_is_active ON storage_types(is_active);

-- RLS: 어드민 전용 (쓰기), 고객은 읽기만 가능 (요금 확인용)
ALTER TABLE storage_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "storage_types_read_all" ON storage_types
  FOR SELECT USING (TRUE);

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION touch_storage_types()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_storage_types_updated_at
  BEFORE UPDATE ON storage_types
  FOR EACH ROW EXECUTE FUNCTION touch_storage_types();

-- =============================================
-- 초기 타입 5종 시드 데이터
-- =============================================
INSERT INTO storage_types
  (code, name, description, dim_l_mm, dim_w_mm, dim_h_mm, volume_liter, max_parcels, price_per_week, price_max, sort_order)
VALUES
  (
    'MINI', 'Mini Storage',
    '액세서리, 소형 잡화, 작은 의류',
    400, 200, 200, 16.0,
    5, 3900, NULL, 1
  ),
  (
    'STANDARD', 'Standard Storage',
    '의류, 신발, 도서, 잡화',
    450, 300, 300, 40.5,
    10, 5900, NULL, 2
  ),
  (
    'LONG', 'Long Storage',
    '길쭉한 물품, 우산, 롤형 제품, 포스터, 긴 박스',
    800, 400, 300, 96.0,
    8, 8900, NULL, 3
  ),
  (
    'XL', 'XL Storage',
    '단프라 1개급, 계절옷, 이불, 큰 잡화',
    650, 450, 370, 108.2,
    15, 9900, NULL, 4
  ),
  (
    'OVERSIZE', 'Oversize Rack',
    '대형 가구, 자전거, 이삿짐급 대형 물품',
    2000, 600, 400, 480.0,
    30, 29900, 39900, 5
  );

COMMENT ON TABLE  storage_types                IS '스토리지 타입 — Mini/Standard/Long/XL/Oversize 규격 및 요금';
COMMENT ON COLUMN storage_types.price_max      IS 'NULL이면 단일 요금, 값이 있으면 price_per_week~price_max 범위 요금';
COMMENT ON COLUMN storage_types.max_parcels    IS '타입별 기본 파슬 수 상한 (로케이션에서 개별 override 가능)';
COMMENT ON COLUMN storage_types.is_active      IS 'FALSE 시 신규 배정 중단, 기존 로케이션 데이터 보존';
