-- 049: 스토리지 카드 색상 고객 선택 기능
ALTER TABLE customer_storages
  ADD COLUMN IF NOT EXISTS card_color TEXT DEFAULT NULL;

COMMENT ON COLUMN customer_storages.card_color IS
  '카드 테마 색상 키 (green | purple | red | blue | pink | null=랜덤)';
