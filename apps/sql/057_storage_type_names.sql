-- =============================================
-- 057: storage_types 명칭 변경
-- 미니→파인트블록 / 스탠다드→싱글블록 / 롱→더블블록 / XL→패밀리블록 / 오버사이즈→하프블록
-- =============================================
UPDATE storage_types SET name = '파인트블록' WHERE code = 'MINI';
UPDATE storage_types SET name = '싱글블록'   WHERE code = 'STANDARD';
UPDATE storage_types SET name = '더블블록'   WHERE code = 'LONG';
UPDATE storage_types SET name = '패밀리블록' WHERE code = 'XL';
UPDATE storage_types SET name = '하프블록'   WHERE code = 'OVERSIZE';
