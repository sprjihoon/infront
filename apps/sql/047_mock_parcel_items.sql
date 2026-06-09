-- MOCK 파셀에 테스트용 내품 데이터 입력
UPDATE parcels
SET pre_invoice_items = '[
  {"name": "나이키 운동화", "qty": 1, "name_en": "Nike Sneakers", "quantity": 1, "unit_price_usd": 120, "origin_country": "KR"},
  {"name": "양말 세트", "qty": 3, "name_en": "Socks Set", "quantity": 3, "unit_price_usd": 5, "origin_country": "KR"}
]'
WHERE tracking_no = 'MOCK-KR-1780542462393-1';

UPDATE parcels
SET pre_invoice_items = '[
  {"name": "겨울 패딩 점퍼", "qty": 1, "name_en": "Winter Padded Jacket", "quantity": 1, "unit_price_usd": 180, "origin_country": "JP"}
]'
WHERE tracking_no = 'MOCK-JP-1780542462393-1';

UPDATE parcels
SET pre_invoice_items = '[
  {"name": "맥북 파우치", "qty": 1, "name_en": "MacBook Pouch", "quantity": 1, "unit_price_usd": 45, "origin_country": "US"},
  {"name": "USB 허브", "qty": 2, "name_en": "USB Hub", "quantity": 2, "unit_price_usd": 25, "origin_country": "US"}
]'
WHERE tracking_no = 'MOCK-US-1780542462393-1';

UPDATE parcels
SET pre_invoice_items = '[
  {"name": "청바지", "qty": 2, "name_en": "Jeans", "quantity": 2, "unit_price_usd": 60, "origin_country": "JP"},
  {"name": "티셔츠", "qty": 3, "name_en": "T-Shirt", "quantity": 3, "unit_price_usd": 30, "origin_country": "JP"}
]'
WHERE tracking_no = 'MOCK-JP-1780542462393-2';

UPDATE parcels
SET pre_invoice_items = '[
  {"name": "에어팟 케이스", "qty": 1, "name_en": "AirPods Case", "quantity": 1, "unit_price_usd": 35, "origin_country": "US"}
]'
WHERE tracking_no = 'MOCK-US-1780542462393-2';

UPDATE parcels
SET pre_invoice_items = '[
  {"name": "책 묶음", "qty": 5, "name_en": "Books Bundle", "quantity": 5, "unit_price_usd": 15, "origin_country": "KR"}
]'
WHERE tracking_no = 'MOCK-KR-1780542487354-1';
