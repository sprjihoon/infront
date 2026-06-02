-- 035: 소포 위치 이동 이력 + 임시보관 공간

-- 임시보관 플래그 (storage_locations)
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS is_temp BOOLEAN NOT NULL DEFAULT false;

-- 소포 위치 이동 이력 테이블
CREATE TABLE IF NOT EXISTS parcel_location_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id        UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  from_location_id UUID REFERENCES storage_locations(id) ON DELETE SET NULL,
  to_location_id   UUID REFERENCES storage_locations(id) ON DELETE SET NULL,
  -- INBOUND    : 최초 입고 배정
  -- TRANSFER   : 다른 로케이션으로 이동
  -- TEMP_OUT   : 임시 반출 (→ 임시보관 공간으로)
  -- RETURN     : 임시보관 → 정상 로케이션 복귀
  -- FORCE_CLEAR: 관리자 강제 비우기
  -- MANUAL     : 관리자 수동 이동 (기타)
  reason           TEXT NOT NULL CHECK (reason IN ('INBOUND','TRANSFER','TEMP_OUT','RETURN','FORCE_CLEAR','MANUAL')),
  notes            TEXT,
  created_by       TEXT,  -- 처리한 관리자 email
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 소포별 최근 이력 조회 최적화
CREATE INDEX IF NOT EXISTS idx_ple_parcel_created
  ON parcel_location_events(parcel_id, created_at DESC);

-- from/to 로케이션별 집계용
CREATE INDEX IF NOT EXISTS idx_ple_from_loc
  ON parcel_location_events(from_location_id);
CREATE INDEX IF NOT EXISTS idx_ple_to_loc
  ON parcel_location_events(to_location_id);

-- 기본 임시보관 슬롯 생성
-- zone_id 없이 TEXT zone='TEMP' 사용 (레거시 컬럼)
INSERT INTO storage_locations (code, zone, slot, label, status, is_temp)
VALUES ('TEMP-001', 'TEMP', '001', '임시보관공간', 'AVAILABLE', true)
ON CONFLICT (code) DO UPDATE
  SET is_temp = true,
      label   = EXCLUDED.label;
