-- ============================================================
-- 062_backfill_recipient_addr.sql
-- recipient_addr1/2/3 이 NULL인 기존 EMS 대상 주문 백필
-- recipient_address 값을 기준으로 addr1/2/3 를 추정하여 채움
-- ============================================================

-- ── 실 주문: SPB-ORD-20260604-0011 (US · "street, city, state") ──
UPDATE orders
SET
  recipient_addr3 = trim(split_part(recipient_address, ',', 1)),  -- 1234 Wilshire Blvd Apt 501
  recipient_addr2 = trim(split_part(recipient_address, ',', 2)),  -- Los Angeles
  recipient_addr1 = trim(split_part(recipient_address, ',', 3))   -- California
WHERE
  id = '0aef418d-e6bb-4d84-8d4d-6e36a0a3085f'
  AND recipient_addr1 IS NULL;

-- ── Mock 주문: US "street, city, state" 형식 ──────────────────
UPDATE orders
SET
  recipient_addr3 = trim(split_part(recipient_address, ',', 1)),
  recipient_addr2 = trim(split_part(recipient_address, ',', 2)),
  recipient_addr1 = trim(split_part(recipient_address, ',', 3))
WHERE
  recipient_country IN ('US', 'CA', 'AU', 'GB')
  AND recipient_addr1 IS NULL
  AND recipient_address LIKE '%,%,%';

-- ── Mock 주문: JP "都道府県+市区+番地" 형식 (콤마 없음) ─────────
-- 한자 주소는 EMS API 가 영문을 요구하므로 관리자가 수동 수정 필요.
-- 우선 전체를 addr3 에 넣어 API 오류 대신 유효성 검사를 통과하도록 처리.
UPDATE orders
SET
  recipient_addr1 = CASE recipient_country
                      WHEN 'JP' THEN 'Japan'
                      ELSE recipient_country
                    END,
  recipient_addr2 = '',
  recipient_addr3 = recipient_address
WHERE
  recipient_addr1 IS NULL
  AND recipient_address IS NOT NULL
  AND recipient_address NOT LIKE '%,%';

-- 검증
SELECT id, order_no, shipping_method, recipient_country,
       recipient_addr1, recipient_addr2, recipient_addr3
FROM   orders
WHERE  shipping_method IN ('EMS','EMS_PREMIUM','KPACKET')
AND    status NOT IN ('CANCELLED','DRAFT')
ORDER  BY created_at DESC;
