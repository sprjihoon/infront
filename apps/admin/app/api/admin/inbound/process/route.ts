import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { generateBarcodes } from "@/lib/parcels/barcode";
import { SIZE_VOLUME_L, PARCEL_SIZE_OPTIONS } from "@/lib/parcels/size";

/**
 * POST /api/admin/inbound/process
 *
 * 로케이션 배정 우선순위:
 *   1. location_id 명시 → 그대로 사용
 *   2. 해당 고객의 기존 OCCUPIED 로케이션 중 리터 여유 있는 곳 → 재사용
 *      (parcel_size_code 있으면 리터 기반, 없으면 건수 기반)
 *   3. 딱 맞는 타입 AVAILABLE → 한 단계 큰 타입 → ... (단계적 업사이징)
 *   4. 단일 로케이션 없으면 → 작은 로케이션 여러 개 묶어 분할 배정
 *      (합산 volume_liter ≥ newParcelVolume 이 될 때까지)
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
  if (!item_count || item_count < 1) return NextResponse.json({ error: "item_count 1 이상 필요" }, { status: 400 });

  const { data: parcel, error: fetchErr } = await adminDb
    .from("parcels")
    .select("id, tracking_no, status, customer_id, pre_invoice_items, storage_location_id, parcel_size_code")
    .eq("id", parcel_id)
    .single();

  if (fetchErr || !parcel) return NextResponse.json({ error: "parcel 없음" }, { status: 404 });

  // 요청값 우선, 없으면 수거신청 시점에 자동 저장된 parcel_size_code 사용
  const resolvedSizeCode = parcel_size_code ?? (parcel.parcel_size_code as string | null) ?? null;

  // 새 소포의 부피 (리터)
  const newParcelVolume = resolvedSizeCode ? (SIZE_VOLUME_L[resolvedSizeCode] ?? 0) : 0;

  let resolvedLocationId: string | null = location_id ?? null;
  let isNewLocation = false;
  // 분할 배정된 추가 로케이션 ID 목록 (소포는 resolvedLocationId에 배정, 나머지는 고객 소유로만 등록)
  const splitLocationIds: string[] = [];

  if (!resolvedLocationId) {
    // ── 1. 고객의 기존 OCCUPIED 로케이션 중 여유 있는 곳 재사용 ──────────
    const { data: customerLocs } = await adminDb
      .from("storage_locations")
      .select("id, max_parcels, volume_liter, storage_type_id")
      .eq("customer_id", parcel.customer_id)
      .eq("status", "OCCUPIED")
      .order("assigned_at");

    if (customerLocs && customerLocs.length > 0) {
      for (const loc of customerLocs) {
        if (newParcelVolume > 0 && loc.volume_liter != null) {
          const { data: existing } = await adminDb
            .from("parcels")
            .select("parcel_size_code")
            .eq("storage_location_id", loc.id)
            .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")');

          const usedVolume = (existing ?? []).reduce((sum, p) => {
            return sum + (p.parcel_size_code ? (SIZE_VOLUME_L[p.parcel_size_code] ?? 0) : 0);
          }, 0);

          if (usedVolume + newParcelVolume <= loc.volume_liter) {
            resolvedLocationId = loc.id;
            break;
          }
        } else {
          if (loc.max_parcels === null) { resolvedLocationId = loc.id; break; }
          const { count } = await adminDb
            .from("parcels")
            .select("id", { count: "exact", head: true })
            .eq("storage_location_id", loc.id)
            .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")');

          if ((count ?? 0) < loc.max_parcels) { resolvedLocationId = loc.id; break; }
        }
      }
    }

    // ── 2. 단계적 업사이징: 딱 맞는 타입 → 한 단계 큰 타입 순으로 탐색 ──
    if (!resolvedLocationId && newParcelVolume > 0) {
      const candidateVolumes = PARCEL_SIZE_OPTIONS
        .filter((o) => o.volume_l >= newParcelVolume)
        .map((o) => o.volume_l);

      for (const vol of candidateVolumes) {
        const { data: sizedLoc } = await adminDb
          .from("storage_locations")
          .select("id, storage_types!inner(volume_liter)")
          .eq("status", "AVAILABLE")
          .is("customer_id", null)
          .eq("storage_types.volume_liter", vol)
          .order("zone").order("slot")
          .limit(1).maybeSingle();

        if (sizedLoc) {
          resolvedLocationId = sizedLoc.id;
          isNewLocation = true;
          break;
        }
      }
    }

    // ── 3. 분할 배정: 작은 로케이션 여러 개 묶어 합산 용량 확보 ──────────
    //    합산 volume_liter ≥ newParcelVolume 이 될 때까지 로케이션 추가
    if (!resolvedLocationId && newParcelVolume > 0) {
      const { data: availLocs } = await adminDb
        .from("storage_locations")
        .select("id, volume_liter")
        .eq("status", "AVAILABLE")
        .is("customer_id", null)
        .not("volume_liter", "is", null)
        .order("volume_liter", { ascending: false }) // 큰 것부터 채워 로케이션 수 최소화
        .limit(20);

      if (availLocs && availLocs.length > 0) {
        let accumulated = 0;
        const toAssign: string[] = [];

        for (const loc of availLocs) {
          if (accumulated >= newParcelVolume) break;
          toAssign.push(loc.id);
          accumulated += loc.volume_liter ?? 0;
        }

        if (toAssign.length > 0) {
          resolvedLocationId = toAssign[0];       // 소포는 첫 번째에 배정
          splitLocationIds.push(...toAssign.slice(1)); // 나머지는 분할 추가 로케이션
          isNewLocation = true;
        }
      }
    }

    // ── 4. 최후 fallback: 타입·용량 무관 아무 빈 자리 ────────────────────
    if (!resolvedLocationId) {
      const { data: autoLoc } = await adminDb
        .from("storage_locations")
        .select("id")
        .eq("status", "AVAILABLE")
        .is("customer_id", null)
        .order("zone").order("slot")
        .limit(1).maybeSingle();
      resolvedLocationId = autoLoc?.id ?? null;
      isNewLocation = true;
    }
  } else {
    isNewLocation = true;
  }

  const today = new Date().toISOString().slice(0, 10);
  const assignedAt = new Date().toISOString();

  const { error: updateErr } = await adminDb.from("parcels").update({
    status: "SHIPPABLE",
    is_shippable: true,
    inbound_at: today,
    item_count,
    ...(resolvedSizeCode ? { parcel_size_code: resolvedSizeCode } : {}),
    ...(resolvedLocationId ? { storage_location_id: resolvedLocationId } : {}),
  }).eq("id", parcel_id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // 새 로케이션 OCCUPIED + customer_id 업데이트
  if (resolvedLocationId && isNewLocation) {
    await adminDb.from("storage_locations").update({
      status: "OCCUPIED",
      customer_id: parcel.customer_id,
      assigned_at: assignedAt,
    }).eq("id", resolvedLocationId);
  }

  // 분할 추가 로케이션들도 고객 소유로 등록 (소포 배정은 없음, 추후 여유 공간)
  if (splitLocationIds.length > 0) {
    await adminDb.from("storage_locations").update({
      status: "OCCUPIED",
      customer_id: parcel.customer_id,
      assigned_at: assignedAt,
    }).in("id", splitLocationIds);
  }

  const invoiceItems = Array.isArray(parcel.pre_invoice_items) ? parcel.pre_invoice_items : [];
  const { rows: barcodes, error: barcodeErr } = await generateBarcodes(adminDb, {
    parcelId: parcel_id,
    trackingNo: parcel.tracking_no,
    itemCount: item_count,
    invoiceItems,
    locationId: resolvedLocationId,
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

  // 로케이션 용량 현황 조회 (응답용)
  let locationCode: string | null = null;
  let locationVolumeLiter: number | null = null;
  let locationUsedLiter: number | null = null;
  let locationMaxParcels: number | null = null;
  let locationCurrentCount: number | null = null;
  let splitLocationCodes: string[] = [];

  if (resolvedLocationId) {
    const [{ data: locData }, { data: locParcels }, { count }] = await Promise.all([
      adminDb
        .from("storage_locations")
        .select("code, volume_liter, max_parcels")
        .eq("id", resolvedLocationId)
        .single(),
      adminDb
        .from("parcels")
        .select("parcel_size_code")
        .eq("storage_location_id", resolvedLocationId)
        .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")'),
      adminDb
        .from("parcels")
        .select("id", { count: "exact", head: true })
        .eq("storage_location_id", resolvedLocationId)
        .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")'),
    ]);

    locationCode = locData?.code ?? null;
    locationVolumeLiter = locData?.volume_liter ?? null;
    locationMaxParcels = locData?.max_parcels ?? null;
    locationCurrentCount = count ?? 0;

    if (locParcels) {
      locationUsedLiter = locParcels.reduce((sum, p) => {
        return sum + (p.parcel_size_code ? (SIZE_VOLUME_L[p.parcel_size_code] ?? 0) : 0);
      }, 0);
    }
  }

  // 분할 배정된 추가 로케이션 코드 조회
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
    location_id: resolvedLocationId,
    location_code: locationCode,
    location_volume_liter: locationVolumeLiter,
    location_used_liter: locationUsedLiter,
    location_max_parcels: locationMaxParcels,
    location_current_count: locationCurrentCount,
    // 분할 배정 정보 (비어있으면 단일 배정)
    split_location_ids: splitLocationIds,
    split_location_codes: splitLocationCodes,
    is_split: splitLocationIds.length > 0,
    barcodes,
    barcode_count: barcodes.length,
  });
}
