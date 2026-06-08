-- ============================================================
-- 044_pickup_box_fees.sql
-- 수거 박스 크기별 요금 — 관리자 설정
-- ============================================================

CREATE TABLE IF NOT EXISTS pickup_box_fees (
  size_code    TEXT PRIMARY KEY,               -- DEFAULT | SMALL | MEDIUM | LARGE | XL
  label_ko     TEXT NOT NULL,
  desc_ko      TEXT,
  weight_kg    INTEGER NOT NULL,
  volume_cm    INTEGER NOT NULL,
  pickup_fee   INTEGER NOT NULL DEFAULT 0,     -- 수거비 (원)
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기본 데이터
INSERT INTO pickup_box_fees
  (size_code, label_ko, desc_ko, weight_kg, volume_cm, pickup_fee, sort_order)
VALUES
  ('DEFAULT', '극소형', '2kg · 세변의 합 60cm 이하',  2,  60,  3000, 1),
  ('SMALL',   '소형',   '5kg · 세변의 합 80cm 이하',  5,  80,  5000, 2),
  ('MEDIUM',  '중형',   '10kg · 세변의 합 100cm 이하', 10, 100,  8000, 3),
  ('LARGE',   '대형',   '20kg · 세변의 합 120cm 이하', 20, 120, 12000, 4),
  ('XL',      '특대형', '30kg · 세변의 합 160cm 이하', 30, 160, 18000, 5)
ON CONFLICT (size_code) DO NOTHING;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION touch_pickup_box_fees()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_pickup_box_fees ON pickup_box_fees;
CREATE TRIGGER trg_touch_pickup_box_fees
  BEFORE UPDATE ON pickup_box_fees
  FOR EACH ROW EXECUTE FUNCTION touch_pickup_box_fees();

-- RLS: 공개 읽기, 서비스 롤(관리자 API)만 쓰기
ALTER TABLE pickup_box_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_pickup_box_fees"
  ON pickup_box_fees FOR SELECT USING (true);
