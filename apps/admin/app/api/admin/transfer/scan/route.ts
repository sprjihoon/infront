import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/transfer/scan?q={input}
 *
 * 스캔 입력을 자동 판별:
 *   - 내부 바코드  (573842910234-01)  → item(내품) 단위 응답  ← 해당 내품만 이동
 *   - 송장번호     (숫자 10자리~)      → parcel(소포) 전체 응답  ← 소포 전체 이동
 *   - 로케이션 코드 (A-001, B-012 등)  → location + 보관 내품 목록
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q 파라미터 필요" }, { status: 400 });

  // ── 1. 내부 바코드로 내품(item) 조회 ─────────────────────────────────
  //    barcode_no = 운송장번호-seq 형식 (예: 573842910234-01)
  //    → type: "item" 으로 응답 (해당 내품 1개 + 소속 소포 정보)
  const { data: byBarcode } = await adminDb
    .from("parcel_barcodes")
    .select(`
      id, barcode_no, seq, item_name, storage_location_id,
      storage_locations(id, code, zone, slot),
      parcels!inner(
        id, tracking_no, status, parcel_size_code,
        item_count,
        pre_invoice_items,
        storage_location_id,
        planned_storage_location_id,
        putaway_at,
        storage_locations(id, code, zone, slot, is_temp),
        customers(id, name, customer_code),
        planned_location:planned_storage_location_id(id, code, zone, slot)
      )
    `)
    .eq("barcode_no", q)
    .maybeSingle();

  if (byBarcode) {
    const parcel = byBarcode.parcels as unknown as RawParcel;
    // 이 소포의 모든 내품 바코드 (다른 위치 확인용)
    const { data: siblings } = await adminDb
      .from("parcel_barcodes")
      .select("id, barcode_no, seq, item_name, storage_location_id, storage_locations(id, code)")
      .eq("parcel_id", parcel.id)
      .order("seq");

    return NextResponse.json({
      type: "item",
      item: {
        barcode_id: byBarcode.id,
        barcode_no: byBarcode.barcode_no,
        seq: byBarcode.seq,
        item_name: byBarcode.item_name,
        location: byBarcode.storage_locations ?? null,
      },
      parcel: normalizeParcel(parcel),
      siblings: (siblings ?? []).map((s) => ({
        barcode_id: s.id,
        barcode_no: s.barcode_no,
        seq: s.seq,
        item_name: s.item_name,
        location: (s.storage_locations as unknown as { id: string; code: string } | null) ?? null,
      })),
    });
  }

  // ── 2. 송장번호로 소포 전체 조회 ────────────────────────────────────
  //    → type: "parcel" 으로 응답 (소포 전체 이동용)
  const { data: byTracking } = await adminDb
    .from("parcels")
    .select(`
      id, tracking_no, status, parcel_size_code,
      item_count, pre_invoice_items,
      storage_location_id,
      planned_storage_location_id,
      putaway_at,
      storage_locations(id, code, zone, slot, is_temp),
      customers(id, name, customer_code),
      planned_location:planned_storage_location_id(id, code, zone, slot)
    `)
    .eq("tracking_no", q)
    .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byTracking) {
    const { data: items } = await adminDb
      .from("parcel_barcodes")
      .select("id, barcode_no, seq, item_name, storage_location_id, storage_locations(id, code)")
      .eq("parcel_id", byTracking.id)
      .order("seq");

    return NextResponse.json({
      type: "parcel",
      parcel: normalizeParcel(byTracking as unknown as RawParcel),
      items: (items ?? []).map((s) => ({
        barcode_id: s.id,
        barcode_no: s.barcode_no,
        seq: s.seq,
        item_name: s.item_name,
        location: (s.storage_locations as unknown as { id: string; code: string } | null) ?? null,
      })),
    });
  }

  // ── 3. 로케이션 코드로 로케이션 + 보관 내품 목록 조회 ───────────────
  const { data: loc } = await adminDb
    .from("storage_locations")
    .select(`
      id, code, zone, slot, status, volume_liter, max_parcels,
      storage_types(code, name, volume_liter),
      customers(id, name, customer_code)
    `)
    .ilike("code", q)
    .maybeSingle();

  if (loc) {
    // 로케이션에 있는 내품 (parcel_barcodes 기준)
    const { data: barcodes } = await adminDb
      .from("parcel_barcodes")
      .select(`
        id, barcode_no, seq, item_name,
        parcels!inner(
          id, tracking_no, status, parcel_size_code,
          customers(id, name, customer_code)
        )
      `)
      .eq("storage_location_id", loc.id)
      .order("parcels(tracking_no)");

    return NextResponse.json({
      type: "location",
      location: {
        id: loc.id,
        code: loc.code,
        zone: loc.zone,
        slot: loc.slot,
        status: loc.status,
        volume_liter: loc.volume_liter,
        max_parcels: loc.max_parcels,
        storage_type: loc.storage_types,
        customer: loc.customers,
      },
      items: (barcodes ?? []).map((b) => {
        const p = b.parcels as unknown as {
          id: string; tracking_no: string | null; status: string;
          parcel_size_code: string | null;
          customers: { id: string; name: string | null; customer_code: string } | null;
        };
        return {
          barcode_id: b.id,
          barcode_no: b.barcode_no,
          seq: b.seq,
          item_name: b.item_name,
          parcel_id: p.id,
          tracking_no: p.tracking_no,
          parcel_size_code: p.parcel_size_code,
          customer: p.customers ?? null,
        };
      }),
    });
  }

  return NextResponse.json({ type: "not_found" }, { status: 404 });
}

interface RawParcel {
  id: string;
  tracking_no: string | null;
  status: string;
  parcel_size_code: string | null;
  item_count?: number;
  pre_invoice_items: unknown;
  storage_location_id: string | null;
  planned_storage_location_id: string | null;
  putaway_at: string | null;
  storage_locations?: { id: string; code: string; zone: string; slot: string; is_temp?: boolean } | null;
  planned_location?: { id: string; code: string; zone: string; slot: string } | null;
  customers: { id: string; name: string | null; customer_code: string } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeParcel(p: RawParcel) {
  const items: { product_name?: string; name_en?: string }[] = (p.pre_invoice_items as typeof items) ?? [];
  const firstName = items[0]?.product_name || items[0]?.name_en || null;
  return {
    id: p.id,
    tracking_no: p.tracking_no,
    status: p.status,
    parcel_size_code: p.parcel_size_code,
    item_count: p.item_count ?? items.length,
    display_name: firstName ?? p.tracking_no ?? "물품 미등록",
    storage_location_id: p.storage_location_id ?? null,
    location: p.storage_locations ?? null,
    planned_location: p.planned_location ?? null,
    putaway_at: p.putaway_at ?? null,
    customer: p.customers ?? null,
  };
}
