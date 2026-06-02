import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { generateBarcodes } from "@/lib/parcels/barcode";

/**
 * POST /api/admin/inbound/process
 *
 * 로케이션 배정 우선순위:
 *   1. location_id 명시 → 그대로 사용
 *   2. 해당 고객의 기존 OCCUPIED 로케이션 중 여유 있는 곳 → 재사용
 *   3. 빈(AVAILABLE) 로케이션 자동 배정
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

  const { data: parcel, error: fetchErr } = await adminDb
    .from("parcels")
    .select("id, tracking_no, status, customer_id, pre_invoice_items, storage_location_id")
    .eq("id", parcel_id)
    .single();

  if (fetchErr || !parcel) return NextResponse.json({ error: "parcel 없음" }, { status: 404 });

  let resolvedLocationId: string | null = location_id ?? null;
  let isNewLocation = false;

  if (!resolvedLocationId) {
    // 1. 해당 고객의 기존 OCCUPIED 로케이션 탐색
    const { data: customerLocs } = await adminDb
      .from("storage_locations")
      .select("id, max_parcels")
      .eq("customer_id", parcel.customer_id)
      .eq("status", "OCCUPIED")
      .order("assigned_at");

    if (customerLocs && customerLocs.length > 0) {
      for (const loc of customerLocs) {
        if (loc.max_parcels === null) {
          // 무제한 → 바로 재사용
          resolvedLocationId = loc.id;
          break;
        }
        // 현재 보관 중인 소포 수 확인
        const { count } = await adminDb
          .from("parcels")
          .select("id", { count: "exact", head: true })
          .eq("storage_location_id", loc.id)
          .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")');

        if ((count ?? 0) < loc.max_parcels) {
          resolvedLocationId = loc.id;
          break;
        }
      }
    }

    // 2. 기존 로케이션 없거나 모두 꽉 찼으면 → 새 빈 로케이션 배정
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
      isNewLocation = true;
    }
  } else {
    isNewLocation = true;
  }

  const today = new Date().toISOString().slice(0, 10);

  const { error: updateErr } = await adminDb.from("parcels").update({
    status: "INBOUND",
    is_shippable: false,
    inbound_at: today,
    item_count,
    ...(resolvedLocationId ? { storage_location_id: resolvedLocationId } : {}),
  }).eq("id", parcel_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // 새로 배정하는 로케이션만 OCCUPIED + customer_id 업데이트
  if (resolvedLocationId && isNewLocation) {
    await adminDb.from("storage_locations").update({
      status: "OCCUPIED",
      customer_id: parcel.customer_id,
      assigned_at: new Date().toISOString(),
    }).eq("id", resolvedLocationId);
  }

  const invoiceItems = Array.isArray(parcel.pre_invoice_items) ? parcel.pre_invoice_items : [];
  const { rows: barcodes, error: barcodeErr } = await generateBarcodes(adminDb, {
    parcelId: parcel_id,
    trackingNo: parcel.tracking_no,
    itemCount: item_count,
    invoiceItems,
  });

  if (barcodeErr) {
    console.error("[inbound/process] barcode error:", barcodeErr);
  }

  await adminDb.from("notifications").insert({
    customer_id: parcel.customer_id,
    parcel_id,
    type: "PARCEL_INBOUND",
    title: "센터에 입고되었습니다",
    body: "검수 후 출고 신청이 가능해집니다.",
  });

  let locationCode: string | null = null;
  let locationMaxParcels: number | null = null;
  let locationCurrentCount: number | null = null;

  if (resolvedLocationId) {
    const [{ data: locData }, { count }] = await Promise.all([
      adminDb
        .from("storage_locations")
        .select("code, max_parcels")
        .eq("id", resolvedLocationId)
        .single(),
      adminDb
        .from("parcels")
        .select("id", { count: "exact", head: true })
        .eq("storage_location_id", resolvedLocationId)
        .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")'),
    ]);
    locationCode = locData?.code ?? null;
    locationMaxParcels = locData?.max_parcels ?? null;
    locationCurrentCount = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    parcel_id,
    location_id: resolvedLocationId,
    location_code: locationCode,
    location_max_parcels: locationMaxParcels,
    location_current_count: locationCurrentCount,
    barcodes,
    barcode_count: barcodes.length,
  });
}
