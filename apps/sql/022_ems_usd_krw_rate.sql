-- EMS 보험 USD→KRW 환율 (admin_config, Cron 주 1회 갱신)
-- admin_config는 021에서 생성; 미적용 DB는 아래 IF NOT EXISTS로 보완
CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE admin_config IS '어드민 전역 설정 (서비스 롤 전용)';

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;

INSERT INTO admin_config (key, value) VALUES (
  'ems_usd_krw_rate',
  '{"rate": 1400, "source": "default", "as_of_date": "20260527", "label": "기본값 (관세청 주간 환율 Cron 적용 전)", "updated_at": "2026-05-27T00:00:00Z"}'::jsonb
) ON CONFLICT (key) DO NOTHING;
