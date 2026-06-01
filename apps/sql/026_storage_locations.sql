-- =============================================
-- 026: 스토리지(창고 로케이션) 관리
-- =============================================

-- 창고 로케이션 테이블
-- 예: A-01, B-03, C-02 형태의 고정 구역
CREATE TABLE storage_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,        -- 예: A-01, B-03
  zone         TEXT NOT NULL,               -- 구역 코드: A, B, C ...
  slot         TEXT NOT NULL,               -- 구역 내 번호: 01, 02 ...
  label        TEXT,                        -- 표시용 이름 (선택)
  status       TEXT NOT NULL DEFAULT 'AVAILABLE',
  -- AVAILABLE: 비어있음 / OCCUPIED: 사용중 / DISABLED: 사용불가
  customer_id  UUID REFERENCES customers(id) ON DELETE SET NULL,
  assigned_at  TIMESTAMPTZ,                 -- 고객 할당 시각
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 정렬용 인덱스
CREATE INDEX idx_storage_locations_zone ON storage_locations(zone, slot);
CREATE INDEX idx_storage_locations_customer ON storage_locations(customer_id);
CREATE INDEX idx_storage_locations_status ON storage_locations(status);

-- parcels 에 location 연결
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS storage_location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL;

CREATE INDEX idx_parcels_storage_location ON parcels(storage_location_id);

-- RLS: 서비스 롤(어드민)만 접근
ALTER TABLE storage_locations ENABLE ROW LEVEL SECURITY;
-- 고객은 접근 불가 (어드민 전용)

COMMENT ON TABLE storage_locations IS '창고 로케이션 — 구역·슬롯 단위 고객 전용 보관 공간';
