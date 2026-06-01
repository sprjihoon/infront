-- =============================================
-- 027: 스토리지 Zone(구역) 관리
-- =============================================
-- Zone은 storage_locations 의 상위 그룹
-- 예: A 구역 100슬롯 10×10 그리드, B 구역 50슬롯 5×10 그리드

CREATE TABLE storage_zones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code        TEXT NOT NULL UNIQUE,        -- 구역 식별 코드: 'A', 'B', 'ZONE-1'
  name        TEXT NOT NULL,               -- 표시명: 'A 구역', '1층 창고'
  description TEXT,                        -- 구역 설명

  -- 그리드 레이아웃 설정 (프론트 렌더링용)
  grid_cols   INT  NOT NULL DEFAULT 10,    -- 가로 칸 수
  grid_rows   INT  NOT NULL DEFAULT 10,    -- 세로 칸 수 (참고용, slot_count와 별개)

  -- 슬롯 관리
  slot_count  INT  NOT NULL DEFAULT 100,   -- 이 Zone 의 총 슬롯 수
  slot_prefix TEXT,                        -- 슬롯 코드 접두사 (NULL이면 code 사용)
                                           -- 예: NULL → 'A-001', 'A-' → 'A-001'

  -- 운영 상태
  sort_order  INT  NOT NULL DEFAULT 0,     -- 탭/목록 표시 순서
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  -- TRUE: 정상 운영 / FALSE: 신규 배정 중단 (기존 고객 유지)

  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_storage_zones_code       ON storage_zones(code);
CREATE INDEX idx_storage_zones_sort       ON storage_zones(sort_order);
CREATE INDEX idx_storage_zones_is_active  ON storage_zones(is_active);

-- RLS: 어드민 전용 (고객 접근 불가)
ALTER TABLE storage_zones ENABLE ROW LEVEL SECURITY;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION touch_storage_zones()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_storage_zones_updated_at
  BEFORE UPDATE ON storage_zones
  FOR EACH ROW EXECUTE FUNCTION touch_storage_zones();

COMMENT ON TABLE  storage_zones            IS '스토리지 구역 — Zone 단위 그룹 (A구역, B구역 등)';
COMMENT ON COLUMN storage_zones.grid_cols  IS '관리자 그리드 UI 가로 칸 수';
COMMENT ON COLUMN storage_zones.grid_rows  IS '관리자 그리드 UI 세로 칸 수 (참고용)';
COMMENT ON COLUMN storage_zones.is_active  IS 'FALSE 시 신규 배정 중단, 기존 고객 데이터 유지';
