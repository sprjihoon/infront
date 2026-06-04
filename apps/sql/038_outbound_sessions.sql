-- ============================================================
-- 038_outbound_sessions.sql
-- 출고 작업 세션 추적 테이블
-- ============================================================

SET search_path = public;

CREATE TABLE IF NOT EXISTS outbound_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 주문 연결
  order_id          UUID REFERENCES orders(id) ON DELETE SET NULL,
  domestic_order_id UUID REFERENCES domestic_orders(id) ON DELETE SET NULL,
  order_type        TEXT NOT NULL CHECK (order_type IN ('intl', 'domestic')),

  -- 작업 상태
  status TEXT NOT NULL DEFAULT 'STARTED'
    CHECK (status IN (
      'STARTED', 'SCANNING', 'SCAN_DONE',
      'MEASURING', 'PRINTING', 'PAYMENT_SENT', 'DONE', 'CANCELLED'
    )),

  -- 영상
  video_url         TEXT,
  video_stream_uid  TEXT,
  video_media_id    TEXT,

  -- 작업자
  worker_email TEXT,

  -- 스캔 이력: [{barcode_no, item_name, seq, scanned_at}]
  scan_log JSONB DEFAULT '[]',

  -- 박스 정보: [{seq, weight_kg, length_cm, width_cm, height_cm}]
  boxes JSONB DEFAULT '[]',

  -- 시간
  work_started_at  TIMESTAMPTZ DEFAULT NOW(),
  scan_done_at     TIMESTAMPTZ,
  shipping_done_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_sessions_order_id
  ON outbound_sessions (order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outbound_sessions_dom_id
  ON outbound_sessions (domestic_order_id) WHERE domestic_order_id IS NOT NULL;

-- parcel_media에 OUTBOUND_VIDEO stage를 허용
-- (stage는 TEXT 자유형이므로 별도 제약 없음 — 코드 레벨 문서화 목적)
COMMENT ON TABLE outbound_sessions IS
  'parcel_media.stage = ''OUTBOUND_VIDEO'' 로 출고 영상을 연결합니다.';
