-- 입고 API 자동 동기화 스케줄 (admin_config)
CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_config IS '어드민 전역 설정 (서비스 롤 전용)';

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

INSERT INTO admin_config (key, value) VALUES (
  'inbound_sync_schedule',
  '{"enabled": true, "times_kst": ["10:00", "13:00", "15:00"]}'::jsonb
) ON CONFLICT (key) DO NOTHING;
