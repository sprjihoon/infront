import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { resolveLocationForType, claimLocationForType } from "@/lib/storage/location-assignment";

/**
 * GET /api/admin/storage/change-requests
 * 전체 변경 요청 목록 (status 필터 지원)
 * 각 요청에 suggested_location 포함 (CAPACITY_CHANGE, ADD_SLOT 대상)
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "PENDING";

  const query = adminDb
    .from("storage_change_requests")
    .select(`
      id, request_type, status, customer_note, admin_note,
      requested_type_code, requested_type_id, requested_plan_type, source_storage_ids,
      target_storage_id,
      created_at, processed_at,
      customers!storage_change_requests_user_id_fkey (
        id, name, customer_code, email
      ),
      customer_storages!storage_change_requests_storage_id_fkey (
        id, storage_name, storage_mode, plan_type
      ),
      storage_types!storage_change_requests_requested_type_id_fkey (
        code, name, price_per_week, price_per_month, max_parcels, volume_liter
      )
    `)
    .order("created_at", { ascending: false });

  const { data, error } = status === "ALL"
    ? await query
    : await query.eq("status", status);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const requests = data ?? [];

  /* ── 타입별 추천 로케이션 일괄 조회 ────────────────────────────
     CAPACITY_CHANGE / ADD_SLOT 요청에 대해 requested_type_id 기준으로
     AVAILABLE 로케이션을 1개씩 조회해 suggested_location으로 첨부 */
  const typedRequests = requests.filter(
    (r) => ["CAPACITY_CHANGE", "ADD_SLOT"].includes(r.request_type) && r.requested_type_id
  );

  const uniqueTypeIds = [...new Set(typedRequests.map((r) => r.requested_type_id as string))];

  // typeId → first AVAILABLE location
  const locationByTypeId: Record<string, { id: string; code: string; zone: string; slot: string }> = {};

  if (uniqueTypeIds.length > 0) {
    const { data: availLocs } = await adminDb
      .from("storage_locations")
      .select("id, code, zone, slot, storage_type_id")
      .eq("status", "AVAILABLE")
      .is("customer_id", null)
      .in("storage_type_id", uniqueTypeIds)
      .order("zone")
      .order("slot");

    for (const loc of availLocs ?? []) {
      if (loc.storage_type_id && !locationByTypeId[loc.storage_type_id]) {
        locationByTypeId[loc.storage_type_id] = {
          id: loc.id,
          code: loc.code,
          zone: loc.zone,
          slot: loc.slot,
        };
      }
    }
  }

  const enriched = requests.map((r) => ({
    ...r,
    suggested_location:
      r.requested_type_id && locationByTypeId[r.requested_type_id]
        ? locationByTypeId[r.requested_type_id]
        : null,
  }));

  return NextResponse.json({ requests: enriched });
}

/**
 * PATCH /api/admin/storage/change-requests
 * 요청 처리 (승인/반려)
 * body: { id, status: 'APPROVED'|'REJECTED', admin_note? }
 *
 * APPROVED 처리 시 자동 로케이션 배정:
 *   - CAPACITY_CHANGE / ADD_SLOT → requested_type_id 와 맞는 AVAILABLE 로케이션 배정
 *   - CONVERT_TO_LONG_TERM → customer_storages 업데이트 + 로케이션 배정
 */
export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    id: string;
    status: "APPROVED" | "REJECTED";
    admin_note?: string;
  };

  if (!body.id || !["APPROVED", "REJECTED"].includes(body.status)) {
    return NextResponse.json({ error: "id, status(APPROVED|REJECTED) 필수" }, { status: 400 });
  }

  // 요청 조회 (user_id 포함)
  const { data: req_row, error: fetchErr } = await adminDb
    .from("storage_change_requests")
    .select("id, storage_id, user_id, request_type, requested_plan_type, requested_type_id, requested_type_code, status")
    .eq("id", body.id)
    .single();

  if (fetchErr || !req_row) {
    return NextResponse.json({ error: "요청을 찾을 수 없습니다." }, { status: 404 });
  }
  if (req_row.status !== "PENDING") {
    return NextResponse.json({ error: "이미 처리된 요청입니다." }, { status: 409 });
  }

  // 요청 상태 업데이트
  const { error: updErr } = await adminDb
    .from("storage_change_requests")
    .update({
      status:       body.status,
      admin_note:   body.admin_note ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("id", body.id);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // 승인 + 장기 전환 → customer_storages 업데이트
  if (body.status === "APPROVED" && req_row.request_type === "CONVERT_TO_LONG_TERM" && req_row.requested_plan_type) {
    const { data: planData } = await adminDb
      .from("storage_plan_config")
      .select("capacity_score, monthly_amount")
      .eq("plan_type", req_row.requested_plan_type)
      .single();

    await adminDb
      .from("customer_storages")
      .update({
        storage_mode:    "long_term",
        plan_type:       req_row.requested_plan_type,
        capacity_score:  planData?.capacity_score ?? null,
        monthly_amount:  planData?.monthly_amount ?? null,
        updated_at:      new Date().toISOString(),
      })
      .eq("id", req_row.storage_id);
  }

  /* ── 승인 시 로케이션 자동 배정 ─────────────────────────────────
     CAPACITY_CHANGE, ADD_SLOT, CONVERT_TO_LONG_TERM:
       requested_type_id 에 맞는 AVAILABLE 로케이션을 찾아 고객에게 RESERVED 배정
  ──────────────────────────────────────────────────────────────── */
  let assignedLocation: { id: string; code: string; zone: string; slot: string } | null = null;

  const AUTO_ASSIGN_TYPES = ["CAPACITY_CHANGE", "ADD_SLOT", "CONVERT_TO_LONG_TERM"];

  if (body.status === "APPROVED" && AUTO_ASSIGN_TYPES.includes(req_row.request_type) && req_row.user_id) {
    /* FOR UPDATE SKIP LOCKED 기반 원자적 선점 — 동시 배정 충돌 방지 */
    const { locationId, locationCode, zone, slot } = await claimLocationForType(adminDb, {
      typeId:     req_row.requested_type_id,
      typeCode:   req_row.requested_type_code,
      customerId: req_row.user_id,
    });

    if (locationId && locationCode) {
      assignedLocation = { id: locationId, code: locationCode, zone: zone ?? "", slot: slot ?? "" };
    }
  }

  return NextResponse.json({ ok: true, assignedLocation });
}
