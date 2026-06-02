-- =============================================
-- 033: 로케이션 용량 제한
-- =============================================

-- 로케이션당 최대 소포 수 제한 (NULL = 무제한)
ALTER TABLE storage_locations
  ADD COLUMN IF NOT EXISTS max_parcels INTEGER DEFAULT NULL;

COMMENT ON COLUMN storage_locations.max_parcels IS 'NULL=무제한, 로케이션당 보관 가능 최대 소포 건수';
