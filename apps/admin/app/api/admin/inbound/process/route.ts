import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { generateBarcodes } from "@/lib/parcels/barcode";

/**
 * POST /api/admin/inbound/process
 * 입고처리: 상태 변경 + 로케이션 배정 + 바코드 생성 + 알림
 *
 * Body: {
 *   parcel_id: string
 *   item_count: number
 *   location_id?: string   // null 이면 자동배정
 * }
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { parcel_id, item_count, location_id } = body as {
    parcel_id: string;
    item_count: number;
    location_id?: string | null;
  };

  if (!parcel_id) return NextResponse.json({ error: "parcel_id 필요" }, { status: 400 });
  if (!item_count || item_count < 1) return NextResponse.json({ error: "item_count 1 이상 필요" }, { status: 400 });

  // 현재 parcel 조회
  const { data: parcel, error: fetchErr } = await adminDb
    .from("parcels")
    .select("id, tracking_no, status, customer_id, pre_invoice_items, storage_location_id")
    .eq("id", parcel_id)
    .single();

  if (fetchErr || !parcel) return NextResponse.json({ error: "parcel 없음" }, { status: 404 });

  // 로케이션 결정 (지정이 없으면 빈 슬롯 자동배정)
  let resolvedLocationId: string | null = location_id ?? null;
  if (!resolvedLocationId) {
    const { data: autoLoc } = await adminDb
      .from("storage_locations")
      .select("id")
      .eq("status", "AVAILABLE")
      .is("customer_id", null)
      .order("zone")
      .order("slot")
      .limit(1)
      .maybeSingle();
    resolvedLocationId = autoLoc?.id ?? null;
  }

  const today = new Date().toISOString().slice(0, 10);

  // parcels 업데이트: 상태 + 내품수량 + 로케이션
  const { error: updateErr } = await adminDb.from("parcels").update({
    status: "INBOUND",
    is_shippable: false,
    inbound_at: today,
    item_count,
    ...(resolvedLocationId ? { storage_location_id: resolvedLocationId } : {}),
  }).eq("id", parcel_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // 로케이션 OCCUPIED 처리
  if (resolvedLocationId) {
    await adminDb.from("storage_locations").update({
      status: "OCCUPIED",
      customer_id: parcel.customer_id,
      assigned_at: new Date().toISOString(),
    }).eq("id", resolvedLocationId);
  }

  // 바코드 생성
  const invoiceItems = Array.isArray(parcel.pre_invoice_items) ? parcel.pre_invoice_items : [];
  const { rows: barcodes, error: barcodeErr } = await generateBarcodes(adminDb, {
    parcelId: parcel_id,
    trackingNo: parcel.tracking_no,
    itemCount: item_count,
    invoiceItems,
  });

  if (barcodeErr) {
    // 바코드 생성 실패는 경고만 (입고처리는 완료)
    console.error("[inbound/process] barcode error:", barcodeErr);
  }

  // 고객 알림
  await adminDb.from("notifications").insert({
    customer_id: parcel.customer_id,
    parcel_id,
    type: "PARCEL_INBOUND",
    title: "센터에 입고되었습니다",
    body: "검수 후 출고 신청이 가능해집니다.",
  });

  // 로케이션 정보 조회 (라벨 출력용)
  let locationCode: string | null = null;
  if (resolvedLocationId) {
    const { data: locData } = await adminDb
      .from("storage_locations")
      .select("code")
      .eq("id", resolvedLocationId)
      .single();
    locationCode = locData?.code ?? null;
  }

  return NextResponse.json({
    ok: true,
    parcel_id,
    location_id: resolvedLocationId,
    location_code: locationCode,
    barcodes,
    barcode_count: barcodes.length,
  });
}
