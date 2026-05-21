-- ============================================================
-- 011_parcel_services.sql
-- 소포 단위 부가서비스 요청 (검품·폐기·포장 등)
-- ============================================================

-- ── BOX_DELIVERY 서비스 항목 비활성화 ───────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
    UPDATE services SET is_active = FALSE WHERE category = 'BOX_DELIVERY';
  END IF;
END $$;

-- ── 신규 서비스 항목 추가 ────────────────────────────────────
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'services') THEN
    INSERT INTO services (code, category, name, description, price, price_type, sort_order) VALUES
      ('RECEIPT_DISPOSE',  'INSPECTION', '영수증/인보이스 폐기', '세관 신고 가격 노출 방지용 영수증·인보이스 폐기',  0, 'FREE',  13),
      ('PRICE_TAG_REMOVE', 'INSPECTION', '가격표 제거',          '태그·스티커 등 가격 표시 제거',                    0, 'FREE',  14),
      ('OVERPACK_REMOVE',  'PACKAGING',  '과포장 제거',          '불필요한 박스·완충재 제거로 부피·무게 절감',        0, 'FREE',  23)
    ON CONFLICT (code) DO NOTHING;
  END IF;
END $$;

-- ── parcel_service_requests 테이블 ───────────────────────────
-- 소포 단위로 고객이 신청하는 부가서비스 요청
CREATE TABLE IF NOT EXISTS parcel_service_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id    UUID        NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
  customer_id  UUID        NOT NULL REFERENCES customers(id),
  service_code TEXT        NOT NULL,
  service_name TEXT        NOT NULL,
  price        NUMERIC(10,0) NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'REQUESTED'
    CHECK (status IN ('REQUESTED', 'IN_PROGRESS', 'DONE', 'CANCELLED')),
  note         TEXT,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS ─────────────────────────────────────────────────────
ALTER TABLE parcel_service_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "psr_customer_read"   ON parcel_service_requests;
DROP POLICY IF EXISTS "psr_customer_insert" ON parcel_service_requests;

CREATE POLICY "psr_customer_read" ON parcel_service_requests
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "psr_customer_insert" ON parcel_service_requests
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- ── 인덱스 ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_psr_parcel   ON parcel_service_requests(parcel_id);
CREATE INDEX IF NOT EXISTS idx_psr_customer ON parcel_service_requests(customer_id);
