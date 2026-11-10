-- 배송전용 블록. 사이즈가 없는 블록 하나.
-- 장기보관 사이즈 선택에는 나오지 않는다.

INSERT INTO storage_types (
  code, name, description,
  dim_l_mm, dim_w_mm, dim_h_mm, volume_liter,
  max_parcels, price_per_week, price_per_month,
  sort_order, is_active
)
VALUES (
  'SHIPPING', '배송전용 블록',
  '사이즈 없는 배송 대기 블록. 고객당 하나.',
  1, 1, 1, NULL,
  9999, 0, NULL,
  99, FALSE
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  volume_liter = NULL,
  price_per_week = 0,
  price_per_month = NULL,
  is_active = FALSE;

UPDATE customer_storages AS cs
SET
  storage_type_id = t.id,
  storage_name = CASE WHEN cs.storage_name = '배송' THEN '배송전용 블록' ELSE cs.storage_name END
FROM storage_types AS t
WHERE t.code = 'SHIPPING'
  AND cs.storage_mode = 'shipping'
  AND (cs.storage_type_id IS DISTINCT FROM t.id OR cs.storage_name = '배송');
