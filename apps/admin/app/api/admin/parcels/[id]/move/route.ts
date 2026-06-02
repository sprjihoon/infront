import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

const VALID_REASONS = ["TRANSFER", "TEMP_OUT", "RETURN", "MANUAL"] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: parcelId } = await params;
  const body = await req.json();
  const { to_location_id, reason = "MANUAL", notes } = body;

  if (!to_location_id) {
    return NextResponse.json({ error: "to_location_id 필수" }, { status: 400 });
  }
  if (!VALID_REASONS.includes(reason)) {
    return NextResponse.json({ error: `reason은 ${VALID_REASONS.join(", ")} 중 하나` }, { status: 400 });
  }

  // 현재 소포 정보 조회
  const { data: parcel, error: parcelErr } = await adminDb
    .from("parcels")
    .select("id, storage_location_id, customers(id)")
    .eq("id", parcelId)
    .single();

  if (parcelErr || !parcel) {
    return NextResponse.json({ error: "소포를 찾을 수 없습니다" }, { status: 404 });
  }

  const fromLocationId = parcel.storage_location_id as string | null;

  // 이동할 로케이션 확인
  const { data: toLoc, error: toLocErr } = await adminDb
    .from("storage_locations")
    .select("id, status, customer_id, is_temp")
    .eq("id", to_location_id)
    .single();

  if (toLocErr || !toLoc) {
    return NextResponse.json({ error: "대상 로케이션을 찾을 수 없습니다" }, { status: 404 });
  }

  if (fromLocationId === to_location_id) {
    return NextResponse.json({ error: "현재 위치와 동일한 로케이션입니다" }, { status: 400 });
  }

  // 소포 이동
  const { error: updateErr } = await adminDb
    .from("parcels")
    .update({ storage_location_id: to_location_id })
    .eq("id", parcelId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 이동 이력 기록
  await adminDb.from("parcel_location_events").insert({
    parcel_id: parcelId,
    from_location_id: fromLocationId,
    to_location_id,
    reason,
    notes: notes || null,
    created_by: admin.email,
  });

  // 이전 로케이션: 소포가 더 없으면 AVAILABLE로 해제
  if (fromLocationId) {
    const { count } = await adminDb
      .from("parcels")
      .select("id", { count: "exact", head: true })
      .eq("storage_location_id", fromLocationId)
      .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")');

    if ((count ?? 0) === 0) {
      await adminDb
        .from("storage_locations")
        .update({ status: "AVAILABLE", customer_id: null, assigned_at: null })
        .eq("id", fromLocationId);
    }
  }

  // 새 로케이션: 비어 있으면 OCCUPIED로 변경 + 고객 연결
  const customerId = (parcel.customers as { id: string } | null)?.id ?? null;
  if (toLoc.status === "AVAILABLE" || toLoc.status === "RESERVED") {
    await adminDb
      .from("storage_locations")
      .update({
        status: "OCCUPIED",
        ...(customerId && !toLoc.customer_id ? { customer_id: customerId, assigned_at: new Date().toISOString() } : {}),
      })
      .eq("id", to_location_id);
  }

  return NextResponse.json({ ok: true });
}
