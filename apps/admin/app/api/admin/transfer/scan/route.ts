import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/transfer/scan?q={input}
 *
 * 스캔 입력을 자동 판별해 소포 또는 로케이션 정보 반환
 *   - 내부 바코드  (573842910234-01)  → 소포
 *   - 송장번호     (숫자 10자리~)      → 소포
 *   - 로케이션 코드 (A-001, B-012 등)  → 로케이션 + 보관 소포 목록
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q 파라미터 필요" }, { status: 400 });

  // ── 1. 내부 바코드로 소포 조회 ──────────────────────────────────────
  const { data: byBarcode } = await adminDb
    .from("parcel_barcodes")
    .select(`
      barcode_no, seq, item_name,
      parcels!inner(
        id, tracking_no, status, parcel_size_code,
        pre_invoice_items,
        storage_location_id,
        storage_locations(id, code, zone, slot),
        customers(id, name, customer_code)
      )
    `)
    .eq("barcode_no", q)
    .maybeSingle();

  if (byBarcode) {
    const p = byBarcode.parcels as Record<string, unknown>;
    return NextResponse.json({ type: "parcel", parcel: normalizeParcel(p), barcode: byBarcode.barcode_no });
  }

  // ── 2. 송장번호로 소포 조회 ────────────────────────────────────────
  const { data: byTracking } = await adminDb
    .from("parcels")
    .select(`
      id, tracking_no, status, parcel_size_code,
      pre_invoice_items,
      storage_location_id,
      storage_locations(id, code, zone, slot),
      customers(id, name, customer_code)
    `)
    .eq("tracking_no", q)
    .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")')
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (byTracking) {
    return NextResponse.json({ type: "parcel", parcel: normalizeParcel(byTracking) });
  }

  // ── 3. 로케이션 코드로 로케이션 + 보관 소포 조회 ─────────────────
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
    const { data: parcels } = await adminDb
      .from("parcels")
      .select(`
        id, tracking_no, status, parcel_size_code,
        pre_invoice_items,
        customers(id, name, customer_code)
      `)
      .eq("storage_location_id", loc.id)
      .not("status", "in", '("DONE","SHIPPING","PICKUP_CANCELLED")')
      .order("inbound_at", { ascending: false });

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
      parcels: (parcels ?? []).map(normalizeParcel),
    });
  }

  return NextResponse.json({ type: "not_found" }, { status: 404 });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeParcel(p: any) {
  const items: { product_name?: string; name_en?: string }[] = p.pre_invoice_items ?? [];
  const firstName = items[0]?.product_name || items[0]?.name_en || null;
  return {
    id: p.id,
    tracking_no: p.tracking_no,
    status: p.status,
    parcel_size_code: p.parcel_size_code,
    display_name: firstName ?? p.tracking_no ?? "물품 미등록",
    item_count: items.length,
    storage_location_id: p.storage_location_id ?? null,
    location: p.storage_locations ?? null,
    customer: p.customers ?? null,
  };
}
