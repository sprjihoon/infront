-- EMS 보험 USD→KRW 환율 (admin_config, Cron 일 1회 갱신)
INSERT INTO admin_config (key, value) VALUES (
  'ems_usd_krw_rate',
  '{"rate": 1400, "source": "default", "as_of_date": "20260527", "label": "기본값 (관세청 주간 환율 Cron 적용 전)", "updated_at": "2026-05-27T00:00:00Z"}'::jsonb
) ON CONFLICT (key) DO NOTHING;
