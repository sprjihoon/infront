-- 빈 박스로 판매하는 규격은 우체국 소포상자 1호~5호만.
-- 가격은 2025년 우체국 창구에서 안내되는 판매가.
-- 2-1호, EMS 상자는 판매하지 않는다.

CREATE TABLE IF NOT EXISTS empty_box_products (
  size_code  TEXT PRIMARY KEY,
  label_ko   TEXT NOT NULL,
  dims_ko    TEXT NOT NULL,
  price      INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO empty_box_products (size_code, label_ko, dims_ko, price, sort_order)
VALUES
  ('P1', '1호', '22 × 19 × 9 cm', 700, 1),
  ('P2', '2호', '27 × 18 × 15 cm', 800, 2),
  ('P3', '3호', '34 × 25 × 21 cm', 1100, 3),
  ('P4', '4호', '41 × 31 × 28 cm', 1700, 4),
  ('P5', '5호', '48 × 38 × 34 cm', 2300, 5)
ON CONFLICT (size_code) DO UPDATE SET
  label_ko = EXCLUDED.label_ko,
  dims_ko = EXCLUDED.dims_ko,
  price = EXCLUDED.price,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

ALTER TABLE empty_box_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS empty_box_products_read ON empty_box_products;
CREATE POLICY empty_box_products_read ON empty_box_products
  FOR SELECT USING (true);
