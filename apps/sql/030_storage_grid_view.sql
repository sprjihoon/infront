-- =============================================
-- 030: 스토리지 그리드 뷰
-- =============================================
-- 관리자 그리드 UI 용 통합 뷰
-- Zone 탭 선택 → WHERE zone_code = 'A' 로 필터링
-- 필터 플래그 컬럼을 통해 다양한 조건 필터링 가능

CREATE OR REPLACE VIEW v_storage_grid AS
SELECT
  -- 로케이션 기본 정보
  sl.id,
  sl.code,
  sl.slot,
  sl.label,
  sl.status,
  sl.notes,
  sl.assigned_at,
  sl.pending_out_at,
  sl.pending_out_order_id,
  sl.last_billed_at,
  sl.last_paid_at,
  sl.created_at,
  sl.updated_at,

  -- Zone 정보
  sz.id         AS zone_id,
  sz.code       AS zone_code,
  sz.name       AS zone_name,
  sz.grid_cols,
  sz.grid_rows,
  sz.sort_order AS zone_sort_order,
  sz.is_active  AS zone_is_active,

  -- 타입 정보
  st.id             AS type_id,
  st.code           AS type_code,
  st.name           AS type_name,
  st.dim_l_mm,
  st.dim_w_mm,
  st.dim_h_mm,
  st.volume_liter,
  st.price_per_week,
  st.price_max,
  -- 이 로케이션의 실제 max_parcels (개별 override 없으면 타입 기본값 사용)
  COALESCE(sl.max_parcels, st.max_parcels) AS effective_max_parcels,

  -- 고객 정보
  c.id            AS customer_id,
  c.name          AS customer_name,
  c.customer_code,
  c.phone         AS customer_phone,

  -- 파슬 현황
  COUNT(p.id)                         AS parcel_count,
  COALESCE(SUM(p.weight_actual), 0)   AS total_weight_g,

  -- 경과일 (로케이션 배정 이후)
  CASE
    WHEN sl.assigned_at IS NOT NULL
    THEN EXTRACT(DAY FROM now() - sl.assigned_at)::INT
    ELSE NULL
  END AS days_stored,

  -- 누적 주 수 (올림)
  CASE
    WHEN sl.assigned_at IS NOT NULL
    THEN CEIL(
      EXTRACT(EPOCH FROM (now() - sl.assigned_at)) / (7.0 * 86400)
    )::INT
    ELSE NULL
  END AS weeks_stored,

  -- 누적 청구 금액 (기본 요금 기준)
  CASE
    WHEN sl.assigned_at IS NOT NULL AND st.price_per_week IS NOT NULL
    THEN CEIL(
      EXTRACT(EPOCH FROM (now() - sl.assigned_at)) / (7.0 * 86400)
    ) * st.price_per_week
    ELSE 0
  END AS accrued_fee,

  -- -----------------------------------------------
  -- 필터용 플래그
  -- -----------------------------------------------

  -- 🔴 장기 미출고: 배정 후 30일 이상
  CASE
    WHEN sl.assigned_at IS NOT NULL
      AND EXTRACT(DAY FROM now() - sl.assigned_at) >= 30
    THEN TRUE ELSE FALSE
  END AS is_long_stored,

  -- 🔴 초장기 미출고: 배정 후 60일 이상
  CASE
    WHEN sl.assigned_at IS NOT NULL
      AND EXTRACT(DAY FROM now() - sl.assigned_at) >= 60
    THEN TRUE ELSE FALSE
  END AS is_very_long_stored,

  -- 🟡 미결제 반출 대기: PENDING_OUT 상태인데 연결 주문 결제 미완료
  CASE
    WHEN sl.status = 'PENDING_OUT'
      AND sl.pending_out_order_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = sl.pending_out_order_id
          AND o.payment_status != 'PAID'
      )
    THEN TRUE ELSE FALSE
  END AS is_unpaid_pending_out,

  -- 🔵 빈 배정: RESERVED 상태인데 파슬이 없음 (배정 후 입고 대기)
  CASE
    WHEN sl.status = 'RESERVED'
      AND COUNT(p.id) = 0
    THEN TRUE ELSE FALSE
  END AS is_empty_reserved,

  -- 🟠 용량 초과: 파슬 수가 최대치를 넘음
  CASE
    WHEN COUNT(p.id) > COALESCE(sl.max_parcels, st.max_parcels, 999)
    THEN TRUE ELSE FALSE
  END AS is_over_capacity,

  -- 🟠 용량 임박: 파슬 수가 최대치의 90% 이상
  CASE
    WHEN COALESCE(sl.max_parcels, st.max_parcels) IS NOT NULL
      AND COUNT(p.id) >= COALESCE(sl.max_parcels, st.max_parcels) * 0.9
    THEN TRUE ELSE FALSE
  END AS is_near_capacity,

  -- ✅ 결제 지연: 마지막 결제일로부터 7일(1주) 이상 경과
  CASE
    WHEN sl.last_paid_at IS NOT NULL
      AND EXTRACT(DAY FROM now() - sl.last_paid_at) >= 7
    THEN TRUE ELSE FALSE
  END AS is_payment_overdue,

  -- 용량 점유율 (0~100, 소수점 1자리)
  CASE
    WHEN COALESCE(sl.max_parcels, st.max_parcels) > 0
    THEN ROUND(
      COUNT(p.id)::NUMERIC
      / COALESCE(sl.max_parcels, st.max_parcels)
      * 100, 1
    )
    ELSE 0
  END AS capacity_pct

FROM storage_locations sl
LEFT JOIN storage_zones sz  ON sz.id = sl.zone_id
LEFT JOIN storage_types st  ON st.id = sl.storage_type_id
LEFT JOIN customers c       ON c.id  = sl.customer_id
LEFT JOIN parcels p
  ON p.storage_location_id = sl.id
GROUP BY
  sl.id,
  sz.id,
  st.id,
  c.id
ORDER BY
  sz.sort_order,
  sl.slot;

COMMENT ON VIEW v_storage_grid IS
  '스토리지 그리드 UI 용 통합 뷰. 필터 플래그(is_long_stored, is_unpaid_pending_out 등) 포함.
   사용 예: SELECT * FROM v_storage_grid WHERE zone_code = ''A'' AND is_long_stored = TRUE';
