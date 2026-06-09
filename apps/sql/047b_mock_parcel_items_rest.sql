-- 나머지 MOCK 파셀 내품 데이터 추가
UPDATE parcels SET pre_invoice_items = '[
  {"name": "무선 이어폰", "qty": 1, "name_en": "Wireless Earphones", "quantity": 1, "unit_price_usd": 80, "origin_country": "JP"}
]' WHERE tracking_no = 'MOCK-JP-1780542487354-1';

UPDATE parcels SET pre_invoice_items = '[
  {"name": "스니커즈", "qty": 2, "name_en": "Sneakers", "quantity": 2, "unit_price_usd": 95, "origin_country": "JP"},
  {"name": "모자", "qty": 1, "name_en": "Cap", "quantity": 1, "unit_price_usd": 25, "origin_country": "JP"}
]' WHERE tracking_no = 'MOCK-JP-1780542487354-2';

UPDATE parcels SET pre_invoice_items = '[
  {"name": "캐리어 소형", "qty": 1, "name_en": "Small Suitcase", "quantity": 1, "unit_price_usd": 150, "origin_country": "JP"}
]' WHERE tracking_no = 'MOCK-JP-1780542676907-1';

UPDATE parcels SET pre_invoice_items = '[
  {"name": "화장품 세트", "qty": 1, "name_en": "Cosmetics Set", "quantity": 1, "unit_price_usd": 60, "origin_country": "JP"},
  {"name": "스킨케어 로션", "qty": 2, "name_en": "Skincare Lotion", "quantity": 2, "unit_price_usd": 30, "origin_country": "JP"}
]' WHERE tracking_no = 'MOCK-JP-1780542676907-2';

UPDATE parcels SET pre_invoice_items = '[
  {"name": "코트", "qty": 1, "name_en": "Coat", "quantity": 1, "unit_price_usd": 200, "origin_country": "KR"}
]' WHERE tracking_no = 'MOCK-KR-1780542676907-1';

UPDATE parcels SET pre_invoice_items = '[
  {"name": "노트북 거치대", "qty": 1, "name_en": "Laptop Stand", "quantity": 1, "unit_price_usd": 55, "origin_country": "US"},
  {"name": "키보드", "qty": 1, "name_en": "Keyboard", "quantity": 1, "unit_price_usd": 90, "origin_country": "US"}
]' WHERE tracking_no = 'MOCK-US-1780542487354-1';

UPDATE parcels SET pre_invoice_items = '[
  {"name": "블루투스 스피커", "qty": 1, "name_en": "Bluetooth Speaker", "quantity": 1, "unit_price_usd": 70, "origin_country": "US"}
]' WHERE tracking_no = 'MOCK-US-1780542487354-2';

UPDATE parcels SET pre_invoice_items = '[
  {"name": "운동화", "qty": 1, "name_en": "Running Shoes", "quantity": 1, "unit_price_usd": 130, "origin_country": "US"},
  {"name": "러닝 반바지", "qty": 2, "name_en": "Running Shorts", "quantity": 2, "unit_price_usd": 35, "origin_country": "US"}
]' WHERE tracking_no = 'MOCK-US-1780542676907-1';

UPDATE parcels SET pre_invoice_items = '[
  {"name": "향수", "qty": 1, "name_en": "Perfume", "quantity": 1, "unit_price_usd": 85, "origin_country": "US"}
]' WHERE tracking_no = 'MOCK-US-1780542676907-2';
