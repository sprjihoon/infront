import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { generateBarcodes } from "@/lib/parcels/barcode";
import { SIZE_VOLUME_L } from "@/lib/parcels/size";
import {
  resolvePlannedLocation,
  reservePlannedLocations,
} from "@/lib/storage/location-assignment";
import { getTempLocationId } from "@/lib/storage/temp-location";

/**
 * POST /api/admin/inbound/process
 *
 * 입고: 검수·바코드 생성 + 배정 예정 로케이션 결정
 * 물리 위치: TEMP(임시보관) → /transfer 에서 적치 확정
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { parcel_id, item_count, location_id, parcel_size_code } = body as {
    parcel_id: string;
    item_count: number;
    location_id?: string | null;
    parcel_size_code?: string | null;
  };

  if (!parcel_id) return NextResponse.json({ error: "parcel_id 필요" }, { status: 400 });
  if (!item_count || item_count < 1) {
    return NextResponse.json({ error: "item_count 1 이상 필요" }, { status: 400 });
  }

  const { data: parcel, error: fetchErr } = await adminDb
    .from("parcels")
    .select("id, tracking_no, status, customer_id, pre_invoice_items, storage_location_id, parcel_size_code")
    .eq("id", parcel_id)
    .single();

  if (fetchErr || !parcel) return NextResponse.json({ error: "parcel 없음" }, { status: 404 });

  const tempLocationId = await getTempLocationId(adminDb);
  if (!tempLocationId) {
    return NextResponse.json(
      { error: "임시보관 로케이션이 없습니다. SQL 035 마이그레이션(TEMP-001)을 실행하세요." },
      { status: 500 },
    );
  }

  const resolvedSizeCode = parcel_size_code ?? (parcel.parcel_size_code as string | null) ?? null;
  const newParcelVolume = resolvedSizeCode ? (SIZE_VOLUME_L[resolvedSizeCode] ?? 0) : 0;

  const { plannedLocationId, reserveNewLocation, splitLocationIds } = await resolvePlannedLocation(
    adminDb,
    {
      customerId: parcel.customer_id,
      locationId: location_id ?? null,
      newParcelVolume,
    },
  );

  const today = new Date().toISOString().slice(0, 10);
  const assignedAt = new Date().toISOString();

  const reserveIds: string[] = [];
  if (plannedLocationId && reserveNewLocation) reserveIds.push(plannedLocationId);
  reserveIds.push(...splitLocationIds);
  await reservePlannedLocations(adminDb, parcel.customer_id, reserveIds, assignedAt);

  await adminDb.from("storage_locations").update({ status: "OCCUPIED" }).eq("id", tempLocationId);

  const { error: updateErr } = await adminDb.from("parcels").update({
    status: "SHIPPABLE",
    is_shippable: true,
    inbound_at: today,
    item_count,
    storage_location_id: tempLocationId,
    planned_storage_location_id: plannedLocationId,
    putaway_at: null,
    ...(resolvedSizeCode ? { parcel_size_code: resolvedSizeCode } : {}),
  }).eq("id", parcel_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  const invoiceItems = Array.isArray(parcel.pre_invoice_items) ? parcel.pre_invoice_items : [];
  const { rows: barcodes, error: barcodeErr } = await generateBarcodes(adminDb, {
    parcelId: parcel_id,
    trackingNo: parcel.tracking_no,
    itemCount: item_count,
    invoiceItems,
    locationId: tempLocationId,
  });

  if (barcodeErr) {
    console.error("[inbound/process] barcode error:", barcodeErr);
  }

  await adminDb.from("notifications").insert({
    customer_id: parcel.customer_id,
    parcel_id,
    type: "PARCEL_SHIPPABLE",
    title: "센터에 입고 · 보관되었습니다",
    body: "출고 신청이 가능합니다.",
  });

  let plannedLocationCode: string | null = null;
  let tempLocationCode: string | null = null;
  let locationVolumeLiter: number | null = null;
  let locationUsedLiter: number | null = null;
  let locationMaxParcels: number | null = null;
  let locationCurrentCount: number | null = null;
  let splitLocationCodes: string[] = [];

  const [{ data: tempLoc }, plannedStats] = await Promise.all([
    adminDb.from("storage_locations").select("code").eq("id", tempLocationId).single(),
    plannedLocationId
      ? Promise.all([
          adminDb
            .from("storage_locations")
            .select("code, volume_liter, max_parcels")
            .eq("id", plannedLocationId)
            .single(),
          adminDb
            .from("parcels")
            .select("parcel_size_code")
            .eq("storage_location_id", plannedLocationId)
            .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")'),
          adminDb
            .from("parcels")
            .select("id", { count: "exact", head: true })
            .eq("storage_location_id", plannedLocationId)
            .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")'),
        ])
      : Promise.resolve(null),
  ]);

  tempLocationCode = tempLoc?.code ?? null;

  if (plannedStats) {
    const [locData, locParcels, countResult] = plannedStats;
    plannedLocationCode = locData.data?.code ?? null;
    locationVolumeLiter = locData.data?.volume_liter ?? null;
    locationMaxParcels = locData.data?.max_parcels ?? null;
    locationCurrentCount = countResult.count ?? 0;

    if (locParcels.data) {
      locationUsedLiter = locParcels.data.reduce((sum, p) => {
        return sum + (p.parcel_size_code ? (SIZE_VOLUME_L[p.parcel_size_code] ?? 0) : 0);
      }, 0);
      if (newParcelVolume > 0) locationUsedLiter += newParcelVolume;
    }
  }

  if (splitLocationIds.length > 0) {
    const { data: splitLocs } = await adminDb
      .from("storage_locations")
      .select("code")
      .in("id", splitLocationIds);
    splitLocationCodes = (splitLocs ?? []).map((l) => l.code);
  }

  return NextResponse.json({
    ok: true,
    parcel_id,
    temp_location_id: tempLocationId,
    temp_location_code: tempLocationCode,
    planned_location_id: plannedLocationId,
    location_id: plannedLocationId,
    location_code: plannedLocationCode,
    location_volume_liter: locationVolumeLiter,
    location_used_liter: locationUsedLiter,
    location_max_parcels: locationMaxParcels,
    location_current_count: locationCurrentCount,
    split_location_ids: splitLocationIds,
    split_location_codes: splitLocationCodes,
    is_split: splitLocationIds.length > 0,
    needs_putaway: true,
    barcodes,
    barcode_count: barcodes.length,
  });
}
