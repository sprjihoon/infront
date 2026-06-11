import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/storage/change-requests
 * 전체 변경 요청 목록 (status 필터 지원)
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
      requested_type_code, requested_plan_type,
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

  return NextResponse.json({ requests: data ?? [] });
}

/**
 * PATCH /api/admin/storage/change-requests
 * 요청 처리 (승인/반려)
 * body: { id, status: 'APPROVED'|'REJECTED', admin_note? }
 *
 * APPROVED + CONVERT_TO_LONG_TERM 시:
 *   customer_storages.storage_mode = 'long_term',
 *   plan_type = requested_plan_type 도 함께 업데이트
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

  // 요청 조회
  const { data: req_row, error: fetchErr } = await adminDb
    .from("storage_change_requests")
    .select("id, storage_id, request_type, requested_plan_type, requested_type_id, status")
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

  return NextResponse.json({ ok: true });
}
