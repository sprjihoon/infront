import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/**
 * GET /api/admin/outbound/scan?q={input}
 *
 * 출고처리용 스캔 조회.
 * 입력 형태 자동 판별:
 *   - 주문번호    (SPB-ORD-... / SPB-DOM-...)  → 해당 주문 직접 조회
 *   - 내부 바코드 (573842910234-01)             → parcel → order_parcels → order 역추적
 *   - 송장번호    (숫자 10~)                    → parcel → order_parcels → order 역추적
 *
 * Response:
 *   { type: 'intl'|'domestic', order: {...}, parcels: [...] }
 *   { type: 'not_found' }
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q 파라미터 필요" }, { status: 400 });

  // ── 1. 해외 주문번호로 직접 조회 ───────────────────────────────
  if (q.startsWith("SPB-ORD") || /^ORD-/.test(q)) {
    const result = await findIntlOrder({ order_no: q });
    if (result) return NextResponse.json(result);
  }

  // ── 2. 국내 주문번호로 직접 조회 ───────────────────────────────
  if (q.startsWith("SPB-DOM") || /^DOM-/.test(q)) {
    const result = await findDomesticOrder({ order_no_pattern: q });
    if (result) return NextResponse.json(result);
  }

  // ── 3. 내부 바코드 (형식: tracking_no-seq) ─────────────────────
  const barcodeMatch = /^.+-\d{2}$/.test(q);
  if (barcodeMatch) {
    const { data: barcode } = await adminDb
      .from("parcel_barcodes")
      .select("parcel_id")
      .eq("barcode_no", q)
      .maybeSingle();

    if (barcode?.parcel_id) {
      const result = await findOrderByParcelId(barcode.parcel_id);
      if (result) return NextResponse.json(result);
    }
  }

  // ── 4. 송장번호로 소포 조회 → 주문 역추적 ──────────────────────
  const { data: parcel } = await adminDb
    .from("parcels")
    .select("id")
    .eq("tracking_no", q)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (parcel?.id) {
    const result = await findOrderByParcelId(parcel.id);
    if (result) return NextResponse.json(result);
  }

  // ── 5. 주문번호 패턴 광역 조회 (부분 일치) ─────────────────────
  const intlResult = await findIntlOrder({ order_no: q });
  if (intlResult) return NextResponse.json(intlResult);

  const domResult = await findDomesticOrder({ order_no_pattern: q });
  if (domResult) return NextResponse.json(domResult);

  return NextResponse.json({ type: "not_found" }, { status: 404 });
}

// ── 헬퍼: 해외 주문 조회 ────────────────────────────────────────

async function findIntlOrder({ order_no }: { order_no: string }) {
  const { data: order } = await adminDb
    .from("orders")
    .select(`
      id, order_no, status, shipping_method,
      recipient_name, recipient_country, recipient_address,
      total_amount, ems_regino, ems_fee, ems_applied_at,
      outbound_weight_g, outbound_length_cm, outbound_width_cm, outbound_height_cm,
      outbound_label_printed_at, shipped_at,
      customers(id, name, customer_code, email)
    `)
    .ilike("order_no", `%${order_no}%`)
    .in("status", ["PICKING_DONE", "OUTBOUND_WAIT", "IN_TRANSIT", "PAID", "PICKING"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) return null;

  const parcels = await fetchOrderParcels(order.id);
  return { type: "intl", order, parcels };
}

async function findDomesticOrder({ order_no_pattern }: { order_no_pattern: string }) {
  const { data: order } = await adminDb
    .from("domestic_orders")
    .select(`
      id, status, recipient_name, recipient_phone,
      recipient_zip, recipient_addr1, recipient_addr2,
      items_desc, delivery_msg, weight_g,
      epost_regi_no, epost_price, epost_applied_at,
      outbound_weight_g, outbound_length_cm, outbound_width_cm, outbound_height_cm,
      outbound_label_printed_at, shipped_at,
      parcel_ids,
      customers(id, name, customer_code, email)
    `)
    .ilike("id", `%${order_no_pattern}%`)
    .in("status", ["PICKING_DONE", "PENDING", "PICKING", "BOOKED"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) return null;

  const parcelIds: string[] = order.parcel_ids ?? [];
  const parcels = parcelIds.length > 0 ? await fetchParcelsByIds(parcelIds) : [];
  return { type: "domestic", order, parcels };
}

async function findOrderByParcelId(parcelId: string) {
  // 해외 주문에서 parcel 역추적
  const { data: opRow } = await adminDb
    .from("order_parcels")
    .select("order_id")
    .eq("parcel_id", parcelId)
    .maybeSingle();

  if (opRow?.order_id) {
    const { data: order } = await adminDb
      .from("orders")
      .select(`
        id, order_no, status, shipping_method,
        recipient_name, recipient_country, recipient_address,
        total_amount, ems_regino, ems_fee, ems_applied_at,
        outbound_weight_g, outbound_length_cm, outbound_width_cm, outbound_height_cm,
        outbound_label_printed_at, shipped_at,
        customers(id, name, customer_code, email)
      `)
      .eq("id", opRow.order_id)
      .single();

    if (order) {
      const parcels = await fetchOrderParcels(order.id);
      return { type: "intl", order, parcels };
    }
  }

  // 국내 주문에서 parcel 역추적 (parcel_ids 배열 검색)
  const { data: domOrder } = await adminDb
    .from("domestic_orders")
    .select(`
      id, status, recipient_name, recipient_phone,
      recipient_zip, recipient_addr1, recipient_addr2,
      items_desc, delivery_msg, weight_g,
      epost_regi_no, epost_price, epost_applied_at,
      outbound_weight_g, outbound_length_cm, outbound_width_cm, outbound_height_cm,
      outbound_label_printed_at, shipped_at,
      parcel_ids,
      customers(id, name, customer_code, email)
    `)
    .contains("parcel_ids", [parcelId])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (domOrder) {
    const parcelIds: string[] = domOrder.parcel_ids ?? [];
    const parcels = parcelIds.length > 0 ? await fetchParcelsByIds(parcelIds) : [];
    return { type: "domestic", order: domOrder, parcels };
  }

  return null;
}

// ── 헬퍼: 주문에 속한 소포 + 위치 + 바코드 ────────────────────

async function fetchOrderParcels(orderId: string) {
  const { data: ops } = await adminDb
    .from("order_parcels")
    .select(`
      parcels!inner(
        id, tracking_no, status, item_count, pre_invoice_items,
        storage_location_id,
        storage_locations(id, code, zone, slot)
      )
    `)
    .eq("order_id", orderId);

  if (!ops) return [];

  return Promise.all(
    ops.map(async (op) => {
      const p = op.parcels as unknown as RawParcel;
      const { data: barcodes } = await adminDb
        .from("parcel_barcodes")
        .select("id, barcode_no, seq, item_name, storage_location_id, storage_locations(id, code)")
        .eq("parcel_id", p.id)
        .order("seq");

      return {
        id: p.id,
        tracking_no: p.tracking_no,
        status: p.status,
        item_count: p.item_count,
        pre_invoice_items: p.pre_invoice_items,
        location: (p.storage_locations as unknown as LocationRow | null) ?? null,
        barcodes: (barcodes ?? []).map((b) => ({
          id: b.id,
          barcode_no: b.barcode_no,
          seq: b.seq,
          item_name: b.item_name,
          location: (b.storage_locations as unknown as { id: string; code: string } | null) ?? null,
        })),
      };
    }),
  );
}

async function fetchParcelsByIds(ids: string[]) {
  const { data: parcels } = await adminDb
    .from("parcels")
    .select(`
      id, tracking_no, status, item_count, pre_invoice_items,
      storage_location_id,
      storage_locations(id, code, zone, slot)
    `)
    .in("id", ids);

  if (!parcels) return [];

  return Promise.all(
    parcels.map(async (p) => {
      const { data: barcodes } = await adminDb
        .from("parcel_barcodes")
        .select("id, barcode_no, seq, item_name, storage_location_id, storage_locations(id, code)")
        .eq("parcel_id", p.id)
        .order("seq");

      return {
        id: p.id,
        tracking_no: p.tracking_no,
        status: p.status,
        item_count: p.item_count,
        pre_invoice_items: p.pre_invoice_items,
        location: (p.storage_locations as unknown as LocationRow | null) ?? null,
        barcodes: (barcodes ?? []).map((b) => ({
          id: b.id,
          barcode_no: b.barcode_no,
          seq: b.seq,
          item_name: b.item_name,
          location: (b.storage_locations as unknown as { id: string; code: string } | null) ?? null,
        })),
      };
    }),
  );
}

interface RawParcel {
  id: string;
  tracking_no: string | null;
  status: string;
  item_count: number;
  pre_invoice_items: unknown;
  storage_location_id: string | null;
  storage_locations: unknown;
}

interface LocationRow {
  id: string;
  code: string;
  zone: string;
  slot: string;
}
