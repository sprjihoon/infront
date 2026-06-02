import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: locationId } = await params;
  const body = await req.json().catch(() => ({}));
  const { notes, target_location_id } = body as { notes?: string; target_location_id?: string };

  // 해당 로케이션 확인
  const { data: location } = await adminDb
    .from("storage_locations")
    .select("id, code, status")
    .eq("id", locationId)
    .single();

  if (!location) {
    return NextResponse.json({ error: "로케이션을 찾을 수 없습니다" }, { status: 404 });
  }

  // 임시보관 대상 로케이션 결정
  let tempLocId: string;

  if (target_location_id) {
    const { data: tl } = await adminDb
      .from("storage_locations")
      .select("id, is_temp")
      .eq("id", target_location_id)
      .single();
    if (!tl) return NextResponse.json({ error: "대상 로케이션을 찾을 수 없습니다" }, { status: 404 });
    tempLocId = tl.id;
  } else {
    // is_temp = true 인 로케이션 중 첫 번째 사용 (AVAILABLE 우선, OCCUPIED도 허용)
    const { data: tempLocs } = await adminDb
      .from("storage_locations")
      .select("id")
      .eq("is_temp", true)
      .not("status", "eq", "DISABLED")
      .order("code")
      .limit(1);

    if (!tempLocs || tempLocs.length === 0) {
      return NextResponse.json(
        { error: "임시보관 로케이션이 없습니다. TEMP-001 슬롯을 먼저 생성하거나 SQL 마이그레이션 035를 실행하세요." },
        { status: 409 }
      );
    }
    tempLocId = tempLocs[0].id;
  }

  if (tempLocId === locationId) {
    return NextResponse.json({ error: "임시보관 공간과 같은 로케이션입니다" }, { status: 400 });
  }

  // 해당 로케이션의 활성 소포 전체 조회
  const { data: parcels, error: parcelErr } = await adminDb
    .from("parcels")
    .select("id, storage_location_id")
    .eq("storage_location_id", locationId)
    .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")');

  if (parcelErr) {
    return NextResponse.json({ error: parcelErr.message }, { status: 500 });
  }

  if (!parcels || parcels.length === 0) {
    // 이미 비어 있음 — 그냥 AVAILABLE로 변경만
    await adminDb
      .from("storage_locations")
      .update({ status: "AVAILABLE", customer_id: null, assigned_at: null })
      .eq("id", locationId);
    return NextResponse.json({ ok: true, moved: 0 });
  }

  // 각 소포를 임시보관으로 이동 + 이력 기록
  const parcelIds = parcels.map((p) => p.id);

  const { error: moveErr } = await adminDb
    .from("parcels")
    .update({ storage_location_id: tempLocId })
    .in("id", parcelIds);

  if (moveErr) {
    return NextResponse.json({ error: moveErr.message }, { status: 500 });
  }

  // 이력 일괄 삽입
  const events = parcelIds.map((pid) => ({
    parcel_id: pid,
    from_location_id: locationId,
    to_location_id: tempLocId,
    reason: "FORCE_CLEAR",
    notes: notes || `${location.code} 강제 비우기`,
    created_by: admin.email,
  }));

  await adminDb.from("parcel_location_events").insert(events);

  // 원래 로케이션 → AVAILABLE
  await adminDb
    .from("storage_locations")
    .update({ status: "AVAILABLE", customer_id: null, assigned_at: null })
    .eq("id", locationId);

  // 임시보관 로케이션 → OCCUPIED (이미 OCCUPIED라도 유지)
  await adminDb
    .from("storage_locations")
    .update({ status: "OCCUPIED" })
    .eq("id", tempLocId)
    .neq("status", "OCCUPIED");

  return NextResponse.json({ ok: true, moved: parcelIds.length, temp_location_id: tempLocId });
}
