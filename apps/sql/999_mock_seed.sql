-- ============================================================
-- 999_mock_seed.sql
-- 피킹 / 출고처리 테스트용 목업 데이터
--
-- ▶ 실행 방법: Supabase 대시보드 > SQL Editor 에서 전체 실행
-- ▶ 재실행 가능 (ON CONFLICT DO NOTHING)
-- ▶ 삭제: 맨 아래 ROLLBACK 섹션 참고
-- ============================================================

DO $$
DECLARE
  -- 테스트 유저 UUID (고정)
  v_u1  UUID := '00000001-mock-0000-0000-000000000001';
  v_u2  UUID := '00000001-mock-0000-0000-000000000002';
  v_u3  UUID := '00000001-mock-0000-0000-000000000003';

  -- 소포 UUID
  v_p1  UUID := '00000002-mock-0000-0001-000000000001'; -- 고객1 / 해외
  v_p2  UUID := '00000002-mock-0000-0001-000000000002'; -- 고객1 / 해외
  v_p3  UUID := '00000002-mock-0000-0002-000000000001'; -- 고객2 / 해외
  v_p4  UUID := '00000002-mock-0000-0002-000000000002'; -- 고객2 / 해외
  v_p5  UUID := '00000002-mock-0000-0003-000000000001'; -- 고객3 / 국내

  -- 주문 UUID
  v_o1  UUID := '00000003-mock-0000-0001-000000000001'; -- PAID  (피킹 대기)
  v_o2  UUID := '00000003-mock-0000-0001-000000000002'; -- PICKING (피킹 중)
  v_o3  UUID := '00000003-mock-0000-0001-000000000003'; -- PICKING_DONE (출고 대기)
  v_d1  UUID := '00000003-mock-0000-0002-000000000001'; -- 국내 PENDING

BEGIN

  -- ── 1. 테스트 유저 → auth.users ──────────────────────────
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) VALUES
  (
    v_u1, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'mock.tanaka@infront-test.dev', '',
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"田中 太郎"}'
  ),
  (
    v_u2, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'mock.smith@infront-test.dev', '',
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"John Smith"}'
  ),
  (
    v_u3, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'mock.kim@infront-test.dev', '',
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"name":"김민준"}'
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── 2. 고객 (트리거가 자동생성하지만 혹시를 대비해 보완) ─
  INSERT INTO customers (id, email, name, customer_code)
  VALUES
    (v_u1, 'mock.tanaka@infront-test.dev', '田中 太郎',  'MOCK-20260604-0001'),
    (v_u2, 'mock.smith@infront-test.dev',  'John Smith', 'MOCK-20260604-0002'),
    (v_u3, 'mock.kim@infront-test.dev',    '김민준',     'MOCK-20260604-0003')
  ON CONFLICT (id) DO NOTHING;

  -- ── 3. 소포 ──────────────────────────────────────────────
  INSERT INTO parcels
    (id, customer_id, tracking_no, status, item_count, weight_actual, inbound_at)
  VALUES
    -- 고객1 (해외 주문에 묶임)
    (v_p1, v_u1, 'MOCK-JP-TRACK-0011', 'INBOUND', 2, 850.0,  NOW() - INTERVAL '2 days'),
    (v_p2, v_u1, 'MOCK-JP-TRACK-0012', 'INBOUND', 1, 420.0,  NOW() - INTERVAL '2 days'),
    -- 고객2 (해외 주문에 묶임)
    (v_p3, v_u2, 'MOCK-US-TRACK-0021', 'INBOUND', 2, 1200.0, NOW() - INTERVAL '3 days'),
    (v_p4, v_u2, 'MOCK-US-TRACK-0022', 'INBOUND', 2, 680.0,  NOW() - INTERVAL '3 days'),
    -- 고객3 (국내 주문)
    (v_p5, v_u3, 'MOCK-KR-TRACK-0031', 'INBOUND', 2, 540.0,  NOW() - INTERVAL '1 day')
  ON CONFLICT (id) DO NOTHING;

  -- ── 4. 내부 바코드 ────────────────────────────────────────
  INSERT INTO parcel_barcodes (parcel_id, barcode_no, seq, item_name, picking_status)
  VALUES
    -- parcel1
    (v_p1, 'MOCK-JP-TRACK-0011-01', 1, 'Nintendo Switch 게임팩', 'WAITING'),
    (v_p1, 'MOCK-JP-TRACK-0011-02', 2, '피규어 세트',             'WAITING'),
    -- parcel2
    (v_p2, 'MOCK-JP-TRACK-0012-01', 1, '코스메틱 세트',           'WAITING'),
    -- parcel3
    (v_p3, 'MOCK-US-TRACK-0021-01', 1, '운동화 (Nike Air)',        'WAITING'),
    (v_p3, 'MOCK-US-TRACK-0021-02', 2, '반팔 티셔츠',             'WAITING'),
    -- parcel4
    (v_p4, 'MOCK-US-TRACK-0022-01', 1, '백팩',                    'WAITING'),
    (v_p4, 'MOCK-US-TRACK-0022-02', 2, '지갑',                    'WAITING'),
    -- parcel5
    (v_p5, 'MOCK-KR-TRACK-0031-01', 1, '스킨케어 세트',           'WAITING'),
    (v_p5, 'MOCK-KR-TRACK-0031-02', 2, '마스크팩 10매',           'WAITING')
  ON CONFLICT (barcode_no) DO NOTHING;

  -- ── 5. 해외 주문 ──────────────────────────────────────────

  -- 주문 A: PAID → 피킹 지시서에 표시 (피킹 시작 전)
  INSERT INTO orders
    (id, customer_id, order_no, status, shipping_method,
     recipient_name, recipient_phone, recipient_country, recipient_address,
     item_list, created_at, updated_at)
  VALUES (
    v_o1, v_u1,
    'SPB-ORD-MOCK-0001', 'PAID', 'EMS',
    '田中 太郎', '090-1234-5678', 'JP', '東京都渋谷区 1-2-3',
    '[{"name":"Nintendo Switch 게임팩","qty":1},{"name":"피규어 세트","qty":1},{"name":"코스메틱 세트","qty":1}]',
    NOW() - INTERVAL '2 days', NOW()
  ) ON CONFLICT (order_no) DO NOTHING;

  -- 주문 B: PICKING → 피킹 진행 중
  INSERT INTO orders
    (id, customer_id, order_no, status, shipping_method,
     recipient_name, recipient_phone, recipient_country, recipient_address,
     item_list, picking_started_at, created_at, updated_at)
  VALUES (
    v_o2, v_u2,
    'SPB-ORD-MOCK-0002', 'PICKING', 'EMS_PREMIUM',
    'John Smith', '+1-555-0100', 'US', '123 Main St, New York, NY 10001',
    '[{"name":"운동화 (Nike Air)","qty":1},{"name":"반팔 티셔츠","qty":1},{"name":"백팩","qty":1},{"name":"지갑","qty":1}]',
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '3 days', NOW()
  ) ON CONFLICT (order_no) DO NOTHING;

  -- 주문 C: PICKING_DONE → 출고처리 페이지에 표시
  INSERT INTO orders
    (id, customer_id, order_no, status, shipping_method,
     recipient_name, recipient_phone, recipient_country, recipient_address,
     item_list, picking_started_at, picking_done_at, created_at, updated_at)
  VALUES (
    v_o3, v_u1,
    'SPB-ORD-MOCK-0003', 'PICKING_DONE', 'KPACKET',
    '田中 次郎', '090-9999-1111', 'JP', '大阪府大阪市中央区 5-10',
    '[{"name":"코스메틱 세트","qty":2}]',
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '4 days', NOW()
  ) ON CONFLICT (order_no) DO NOTHING;

  -- ── 6. 주문-소포 연결 ─────────────────────────────────────
  INSERT INTO order_parcels (order_id, parcel_id) VALUES
    (v_o1, v_p1),
    (v_o1, v_p2),
    (v_o2, v_p3),
    (v_o2, v_p4)
  ON CONFLICT DO NOTHING;

  -- ── 7. 국내 주문: PENDING → 피킹 지시서에 표시 ───────────
  INSERT INTO domestic_orders
    (id, customer_id,
     recipient_name, recipient_phone, recipient_zip, recipient_addr1,
     parcel_ids, status, items_desc, delivery_msg, created_at, updated_at)
  VALUES (
    v_d1, v_u3,
    '김민준', '010-9999-1234', '06292', '서울시 강남구 테헤란로 521',
    ARRAY[v_p5],
    'PENDING', '스킨케어 세트, 마스크팩',
    '부재 시 경비실에 맡겨주세요',
    NOW() - INTERVAL '1 day', NOW()
  ) ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE '';
  RAISE NOTICE '✅ 목업 데이터 생성 완료!';
  RAISE NOTICE '─────────────────────────────────────────────';
  RAISE NOTICE '📋 피킹 지시서에 표시될 주문:';
  RAISE NOTICE '  • SPB-ORD-MOCK-0001  [PAID]  해외(JP)  田中 太郎  3개';
  RAISE NOTICE '  • SPB-ORD-MOCK-0002  [PICKING]  해외(US)  John Smith  4개';
  RAISE NOTICE '  • 국내주문  [PENDING]  국내  김민준  2개';
  RAISE NOTICE '─────────────────────────────────────────────';
  RAISE NOTICE '📦 출고처리 페이지에 표시될 주문:';
  RAISE NOTICE '  • SPB-ORD-MOCK-0003  [PICKING_DONE]  해외(JP)  田中 次郎';
  RAISE NOTICE '─────────────────────────────────────────────';
  RAISE NOTICE '🔖 스캔 테스트용 바코드:';
  RAISE NOTICE '  MOCK-JP-TRACK-0011-01  (Nintendo Switch 게임팩)';
  RAISE NOTICE '  MOCK-JP-TRACK-0011-02  (피규어 세트)';
  RAISE NOTICE '  MOCK-JP-TRACK-0012-01  (코스메틱 세트)';
  RAISE NOTICE '  MOCK-US-TRACK-0021-01  (운동화)';
  RAISE NOTICE '  MOCK-US-TRACK-0021-02  (반팔 티셔츠)';
  RAISE NOTICE '  MOCK-US-TRACK-0022-01  (백팩)';
  RAISE NOTICE '  MOCK-US-TRACK-0022-02  (지갑)';
  RAISE NOTICE '  MOCK-KR-TRACK-0031-01  (스킨케어 세트)';
  RAISE NOTICE '  MOCK-KR-TRACK-0031-02  (마스크팩)';

END;
$$;

-- ============================================================
-- 목업 데이터 삭제 (초기화할 때)
-- ============================================================
-- DO $$
-- BEGIN
--   DELETE FROM order_parcels WHERE order_id IN (
--     '00000003-mock-0000-0001-000000000001',
--     '00000003-mock-0000-0001-000000000002',
--     '00000003-mock-0000-0001-000000000003'
--   );
--   DELETE FROM domestic_orders WHERE id = '00000003-mock-0000-0002-000000000001';
--   DELETE FROM orders WHERE order_no LIKE 'SPB-ORD-MOCK-%';
--   DELETE FROM parcel_barcodes WHERE barcode_no LIKE 'MOCK-%';
--   DELETE FROM parcels WHERE tracking_no LIKE 'MOCK-%';
--   DELETE FROM customers WHERE customer_code LIKE 'MOCK-%';
--   DELETE FROM auth.users WHERE email LIKE '%@infront-test.dev';
--   RAISE NOTICE '🗑️ 목업 데이터 삭제 완료';
-- END;
-- $$;
