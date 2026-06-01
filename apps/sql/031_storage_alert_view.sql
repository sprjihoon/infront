-- =============================================
-- 031: 스토리지 알림/모아보기 뷰
-- =============================================
-- 관리자 대시보드 "⚠ 즉시 처리 필요" / "📋 확인 필요" 목록
-- v_storage_grid 를 기반으로 문제 건만 추출

-- -----------------------------------------------
-- 1. 전체 알림 뷰 (모든 문제 건)
-- -----------------------------------------------
CREATE OR REPLACE VIEW v_storage_alerts AS
SELECT
  g.id,
  g.code,
  g.zone_code,
  g.zone_name,
  g.type_code,
  g.type_name,
  g.status,
  g.customer_id,
  g.customer_name,
  g.customer_code,
  g.parcel_count,
  g.days_stored,
  g.weeks_stored,
  g.accrued_fee,
  g.capacity_pct,
  g.assigned_at,
  g.pending_out_at,

  -- 알림 레벨
  CASE
    WHEN g.is_very_long_stored OR g.is_unpaid_pending_out OR g.is_over_capacity
      THEN 'CRITICAL'   -- 🔴 즉시 처리
    WHEN g.is_long_stored OR g.is_payment_overdue OR g.is_near_capacity
      THEN 'WARNING'    -- 🟡 경고
    WHEN g.is_empty_reserved
      THEN 'INFO'       -- 🔵 확인 필요
    ELSE 'NORMAL'
  END AS alert_level,

  -- 알림 유형 (복수 가능 → 배열)
  ARRAY_REMOVE(ARRAY[
    CASE WHEN g.is_very_long_stored   THEN 'VERY_LONG_STORED'   END,
    CASE WHEN g.is_long_stored
          AND NOT g.is_very_long_stored THEN 'LONG_STORED'       END,
    CASE WHEN g.is_unpaid_pending_out THEN 'UNPAID_PENDING_OUT'  END,
    CASE WHEN g.is_over_capacity      THEN 'OVER_CAPACITY'       END,
    CASE WHEN g.is_near_capacity
          AND NOT g.is_over_capacity  THEN 'NEAR_CAPACITY'       END,
    CASE WHEN g.is_payment_overdue    THEN 'PAYMENT_OVERDUE'     END,
    CASE WHEN g.is_empty_reserved     THEN 'EMPTY_RESERVED'      END
  ], NULL) AS alert_types,

  -- 사람이 읽기 쉬운 알림 메시지 (주요 1개)
  CASE
    WHEN g.is_very_long_stored   THEN '장기 미출고 ' || g.days_stored || '일 경과'
    WHEN g.is_unpaid_pending_out THEN '반출 요청 후 미결제 대기 중'
    WHEN g.is_over_capacity      THEN '용량 초과 (' || g.parcel_count || '개)'
    WHEN g.is_long_stored        THEN '미출고 ' || g.days_stored || '일 경과'
    WHEN g.is_payment_overdue    THEN '결제 지연 ' || EXTRACT(DAY FROM now() - g.last_paid_at)::INT || '일'
    WHEN g.is_near_capacity      THEN '용량 임박 ' || g.capacity_pct || '%'
    WHEN g.is_empty_reserved     THEN '배정 후 파슬 미입고'
    ELSE ''
  END AS alert_message,

  g.last_paid_at,
  g.is_long_stored,
  g.is_very_long_stored,
  g.is_unpaid_pending_out,
  g.is_over_capacity,
  g.is_near_capacity,
  g.is_payment_overdue,
  g.is_empty_reserved

FROM v_storage_grid g
WHERE
  g.is_very_long_stored
  OR g.is_long_stored
  OR g.is_unpaid_pending_out
  OR g.is_over_capacity
  OR g.is_near_capacity
  OR g.is_payment_overdue
  OR g.is_empty_reserved
ORDER BY
  CASE
    WHEN g.is_very_long_stored OR g.is_unpaid_pending_out OR g.is_over_capacity THEN 1
    WHEN g.is_long_stored OR g.is_payment_overdue OR g.is_near_capacity          THEN 2
    ELSE 3
  END,
  g.days_stored DESC NULLS LAST;

-- -----------------------------------------------
-- 2. 레벨별 요약 뷰 (대시보드 상단 카운트 카드용)
-- -----------------------------------------------
CREATE OR REPLACE VIEW v_storage_summary AS
SELECT
  -- 전체 현황
  COUNT(*)                                      AS total_locations,
  COUNT(*) FILTER (WHERE status = 'AVAILABLE')  AS available_count,
  COUNT(*) FILTER (WHERE status = 'RESERVED')   AS reserved_count,
  COUNT(*) FILTER (WHERE status = 'OCCUPIED')   AS occupied_count,
  COUNT(*) FILTER (WHERE status = 'PENDING_OUT')AS pending_out_count,
  COUNT(*) FILTER (WHERE status = 'DISABLED')   AS disabled_count,

  -- 점유율
  ROUND(
    COUNT(*) FILTER (WHERE status IN ('RESERVED','OCCUPIED','PENDING_OUT'))::NUMERIC
    / NULLIF(COUNT(*) FILTER (WHERE status != 'DISABLED'), 0) * 100, 1
  ) AS occupancy_pct,

  -- 알림 건수
  COUNT(*) FILTER (WHERE is_very_long_stored)    AS very_long_stored_count,
  COUNT(*) FILTER (WHERE is_long_stored
                     AND NOT is_very_long_stored) AS long_stored_count,
  COUNT(*) FILTER (WHERE is_unpaid_pending_out)  AS unpaid_pending_out_count,
  COUNT(*) FILTER (WHERE is_over_capacity)       AS over_capacity_count,
  COUNT(*) FILTER (WHERE is_near_capacity
                     AND NOT is_over_capacity)   AS near_capacity_count,
  COUNT(*) FILTER (WHERE is_payment_overdue)     AS payment_overdue_count,
  COUNT(*) FILTER (WHERE is_empty_reserved)      AS empty_reserved_count,

  -- 전체 알림 건수 (중복 제거: 한 슬롯이 여러 알림이어도 1건)
  COUNT(*) FILTER (WHERE
    is_very_long_stored OR is_long_stored OR is_unpaid_pending_out
    OR is_over_capacity OR is_near_capacity OR is_payment_overdue
    OR is_empty_reserved
  ) AS total_alert_count,

  -- 타입별 현황
  COUNT(*) FILTER (WHERE type_code = 'MINI')      AS mini_count,
  COUNT(*) FILTER (WHERE type_code = 'STANDARD')  AS standard_count,
  COUNT(*) FILTER (WHERE type_code = 'LONG')      AS long_count,
  COUNT(*) FILTER (WHERE type_code = 'XL')        AS xl_count,
  COUNT(*) FILTER (WHERE type_code = 'OVERSIZE')  AS oversize_count

FROM v_storage_grid;

-- -----------------------------------------------
-- 3. Zone별 요약 뷰 (Zone 탭 헤더 카운트용)
-- -----------------------------------------------
CREATE OR REPLACE VIEW v_storage_zone_summary AS
SELECT
  zone_id,
  zone_code,
  zone_name,
  grid_cols,
  grid_rows,
  zone_sort_order,
  zone_is_active,

  COUNT(*)                                       AS total_slots,
  COUNT(*) FILTER (WHERE status = 'AVAILABLE')   AS available_count,
  COUNT(*) FILTER (WHERE status IN ('RESERVED','OCCUPIED','PENDING_OUT')) AS in_use_count,
  COUNT(*) FILTER (WHERE status = 'DISABLED')    AS disabled_count,

  ROUND(
    COUNT(*) FILTER (WHERE status IN ('RESERVED','OCCUPIED','PENDING_OUT'))::NUMERIC
    / NULLIF(COUNT(*) FILTER (WHERE status != 'DISABLED'), 0) * 100, 1
  ) AS occupancy_pct,

  COUNT(*) FILTER (WHERE
    is_very_long_stored OR is_long_stored OR is_unpaid_pending_out
    OR is_over_capacity OR is_payment_overdue
  ) AS critical_warning_count

FROM v_storage_grid
GROUP BY zone_id, zone_code, zone_name, grid_cols, grid_rows, zone_sort_order, zone_is_active
ORDER BY zone_sort_order;

-- -----------------------------------------------
-- 코멘트
-- -----------------------------------------------
COMMENT ON VIEW v_storage_alerts IS
  '문제 건 모아보기 뷰. alert_level: CRITICAL(즉시처리) / WARNING(경고) / INFO(확인필요)';

COMMENT ON VIEW v_storage_summary IS
  '전체 스토리지 현황 요약 — 대시보드 상단 카운트 카드용';

COMMENT ON VIEW v_storage_zone_summary IS
  'Zone 탭별 현황 요약 — 탭 헤더의 점유율·알림 건수 표시용';
