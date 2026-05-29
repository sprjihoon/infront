-- ============================================================
-- 025_domestic_orders_v2.sql
-- domestic_orders 에 포장옵션·부가서비스·메모 컬럼 추가
-- ============================================================

SET search_path = public;

ALTER TABLE domestic_orders
  ADD COLUMN IF NOT EXISTS packaging_type   TEXT DEFAULT 'NONE'
    CHECK (packaging_type IN ('NONE','SAFE_PACK','REPACK','CONSOLIDATE')),
  ADD COLUMN IF NOT EXISTS packaging_fee    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS add_services     JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS notes            TEXT;
