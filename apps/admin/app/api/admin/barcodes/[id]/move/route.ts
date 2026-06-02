import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * POST /api/admin/barcodes/[id]/move
 *
 * 내품(parcel_barcodes) 단위 위치 이동.
 * 소포 전체가 아닌 특정 내품 1개만 다른 로케이션으로 이동.
 *
 * body: { to_location_id: string, reason?: string, notes?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: barcodeId } = await params;
  const body = await req.json();
  const { to_location_id, reason = "TRANSFER", notes } = body as {
    to_location_id: string;
    reason?: string;
    notes?: string;
  };

  if (!to_location_id) {
    return NextResponse.json({ error: "to_location_id 필수" }, { status: 400 });
  }

  // 내품 바코드 현재 상태 조회
  const { data: barcode, error: barcodeErr } = await adminDb
    .from("parcel_barcodes")
    .select("id, barcode_no, seq, item_name, storage_location_id, parcel_id")
    .eq("id", barcodeId)
    .single();

  if (barcodeErr || !barcode) {
    return NextResponse.json({ error: "바코드를 찾을 수 없습니다" }, { status: 404 });
  }

  if (barcode.storage_location_id === to_location_id) {
    return NextResponse.json({ error: "현재 위치와 동일한 로케이션입니다" }, { status: 400 });
  }

  // 대상 로케이션 확인
  const { data: toLoc, error: toLocErr } = await adminDb
    .from("storage_locations")
    .select("id, code, status, customer_id")
    .eq("id", to_location_id)
    .single();

  if (toLocErr || !toLoc) {
    return NextResponse.json({ error: "대상 로케이션을 찾을 수 없습니다" }, { status: 404 });
  }

  // 소포 고객 정보 조회 (로케이션 customer_id 업데이트용)
  const { data: parcel } = await adminDb
    .from("parcels")
    .select("id, customer_id")
    .eq("id", barcode.parcel_id)
    .single();

  // 내품 위치 업데이트
  const { error: updateErr } = await adminDb
    .from("parcel_barcodes")
    .update({ storage_location_id: to_location_id })
    .eq("id", barcodeId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 이동 이력 기록 (parcel_location_events — parcel 단위이므로 notes에 내품 정보 기록)
  await adminDb.from("parcel_location_events").insert({
    parcel_id: barcode.parcel_id,
    from_location_id: barcode.storage_location_id,
    to_location_id,
    reason,
    notes: `내품 이동: ${barcode.barcode_no} (${barcode.item_name ?? "품목명 없음"})${notes ? ` — ${notes}` : ""}`,
    created_by: admin.email,
  });

  // 대상 로케이션 상태 업데이트 (AVAILABLE이면 OCCUPIED로 전환)
  if (toLoc.status === "AVAILABLE" || toLoc.status === "RESERVED") {
    await adminDb
      .from("storage_locations")
      .update({
        status: "OCCUPIED",
        ...(parcel?.customer_id && !toLoc.customer_id
          ? { customer_id: parcel.customer_id, assigned_at: new Date().toISOString() }
          : {}),
      })
      .eq("id", to_location_id);
  }

  // 이전 로케이션: 이 소포의 모든 내품이 빠져나갔는지 확인 → 빈 로케이션 해제
  if (barcode.storage_location_id) {
    const { count } = await adminDb
      .from("parcel_barcodes")
      .select("id", { count: "exact", head: true })
      .eq("storage_location_id", barcode.storage_location_id);

    if ((count ?? 0) === 0) {
      await adminDb
        .from("storage_locations")
        .update({ status: "AVAILABLE", customer_id: null, assigned_at: null })
        .eq("id", barcode.storage_location_id);
    }
  }

  return NextResponse.json({
    ok: true,
    barcode_no: barcode.barcode_no,
    item_name: barcode.item_name,
    from_location_id: barcode.storage_location_id,
    to_location_id,
    to_location_code: toLoc.code,
  });
}
