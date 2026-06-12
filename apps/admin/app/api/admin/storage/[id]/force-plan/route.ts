import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/storage/[id]/force-plan
 * 관리자 강제 용량 변경 (고객 요청 없이 즉시 적용)
 *
 * body: { plan_type_id: string, admin_note?: string }
 * - plan_type_id: storage_types.id
 * - 다운그레이드 포함 모든 변경 허용 (관리자 권한)
 * - customer_storages 즉시 업데이트 + 작업지시서 생성
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: storage_id } = await params;
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as {
    plan_type_id: string;
    admin_note?: string;
  };

  if (!body.plan_type_id) {
    return NextResponse.json({ error: "plan_type_id 필수" }, { status: 400 });
  }

  // 새 타입 조회
  const { data: newType } = await adminDb
    .from("storage_types")
    .select("id, code, volume_liter, max_parcels")
    .eq("id", body.plan_type_id)
    .single();

  if (!newType) {
    return NextResponse.json({ error: "해당 타입을 찾을 수 없습니다." }, { status: 404 });
  }

  // 대상 스토리지 조회 (소유자 확인용)
  const { data: storage } = await adminDb
    .from("customer_storages")
    .select("id, user_id, plan_type, storage_type_id, capacity_score")
    .eq("id", storage_id)
    .neq("status", "CANCELLED")
    .single();

  if (!storage) {
    return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
  }

  // 즉시 적용
  const { error: upErr } = await adminDb
    .from("customer_storages")
    .update({
      storage_type_id: newType.id,
      capacity_score:  newType.volume_liter,
      updated_at:      new Date().toISOString(),
    })
    .eq("id", storage_id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // 작업지시서 생성 (관리자 발행)
  await adminDb
    .from("storage_change_requests")
    .insert({
      user_id:             storage.user_id,
      storage_id,
      request_type:        "CAPACITY_CHANGE",
      requested_type_id:   body.plan_type_id,
      requested_type_code: newType.code,
      admin_note:          body.admin_note ?? "관리자 강제 변경",
      // 관리자 발행이므로 바로 APPROVED (물리 작업 필요)
      status:              "PENDING",
    });

  return NextResponse.json({
    ok: true,
    applied_type: newType.code,
    volume_liter: newType.volume_liter,
    message: `${newType.code}(${newType.volume_liter}L)로 강제 변경되었습니다.`,
  });
}
