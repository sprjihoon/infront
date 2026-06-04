import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

// ── GET: 워크스테이션용 주문 상세 + 모든 바코드 로드 ──────────

/**
 * GET /api/admin/outbound/[id]?type=intl|domestic
 * 워크스테이션 초기 데이터 로드
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const type = req.nextUrl.searchParams.get("type") ?? "intl";

  if (type === "intl") {
    const { data: order, error } = await adminDb
      .from("orders")
      .select(`
        id, order_no, status, shipping_method,
        recipient_name, recipient_country, recipient_address,
        total_amount, ems_regino, ems_fee,
        outbound_weight_g, outbound_length_cm, outbound_width_cm, outbound_height_cm,
        shipped_at, picking_done_at,
        customers(id, name, customer_code, email)
      `)
      .eq("id", id)
      .single();

    if (error || !order) return NextResponse.json({ error: "주문 없음" }, { status: 404 });

    const items = await buildItemsFromIntlOrder(id);

    // 최근 세션 조회
    const { data: session } = await adminDb
      .from("outbound_sessions")
      .select("*")
      .eq("order_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ type: "intl", order, items, session: session ?? null });
  }

  // domestic
  const { data: order, error } = await adminDb
    .from("domestic_orders")
    .select(`
      id, status, recipient_name, recipient_phone,
      recipient_zip, recipient_addr1, recipient_addr2,
      items_desc, weight_g, epost_regi_no, epost_price,
      outbound_weight_g, outbound_length_cm, outbound_width_cm, outbound_height_cm,
      shipped_at, picking_done_at, parcel_ids,
      customers(id, name, customer_code, email)
    `)
    .eq("id", id)
    .single();

  if (error || !order) return NextResponse.json({ error: "주문 없음" }, { status: 404 });

  const parcelIds: string[] = order.parcel_ids ?? [];
  const items = await buildItemsFromParcelIds(parcelIds);

  const { data: session } = await adminDb
    .from("outbound_sessions")
    .select("*")
    .eq("domestic_order_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ type: "domestic", order, items, session: session ?? null });
}

// ── PATCH: 치수·상태 업데이트 ─────────────────────────────────

/**
 * PATCH /api/admin/outbound/[id]
 * 출고처리 상태 업데이트
 *
 * Body:
 *   action  'set_dimensions' | 'set_label_printed' | 'ship'
 *   type    'intl' | 'domestic'
 *   weight_g? / length_cm? / width_cm? / height_cm?
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as {
    action: string;
    type: string;
    weight_g?: number;
    length_cm?: number;
    width_cm?: number;
    height_cm?: number;
  };

  const { action, type } = body;
  const table = type === "domestic" ? "domestic_orders" : "orders";
  const now = new Date().toISOString();

  if (action === "set_dimensions") {
    const { weight_g, length_cm, width_cm, height_cm } = body;
    if (!weight_g) return NextResponse.json({ error: "weight_g 필수" }, { status: 400 });

    const { error } = await adminDb
      .from(table)
      .update({
        outbound_weight_g:  weight_g,
        outbound_length_cm: length_cm ?? null,
        outbound_width_cm:  width_cm  ?? null,
        outbound_height_cm: height_cm ?? null,
        updated_at: now,
      })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "set_label_printed") {
    const updateData: Record<string, unknown> = {
      outbound_label_printed_at: now,
      updated_at: now,
    };
    if (type === "intl") updateData.status = "OUTBOUND_WAIT";

    const { error } = await adminDb.from(table).update(updateData).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "ship") {
    const { error } = await adminDb
      .from(table)
      .update({ status: "IN_TRANSIT", shipped_at: now, updated_at: now })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 연관 소포 상태 SHIPPING으로 변경
    if (type === "intl") {
      const { data: ops } = await adminDb
        .from("order_parcels")
        .select("parcel_id")
        .eq("order_id", id);
      const pids = (ops ?? []).map((r) => r.parcel_id);
      if (pids.length > 0) {
        await adminDb.from("parcels").update({ status: "SHIPPING" }).in("id", pids);
      }
    } else {
      const { data: dom } = await adminDb
        .from("domestic_orders")
        .select("parcel_ids")
        .eq("id", id)
        .single();
      const pids: string[] = dom?.parcel_ids ?? [];
      if (pids.length > 0) {
        await adminDb.from("parcels").update({ status: "SHIPPING" }).in("id", pids);
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "알 수 없는 action" }, { status: 400 });
}

// ── 헬퍼 ──────────────────────────────────────────────────────

async function buildItemsFromIntlOrder(orderId: string) {
  const { data: ops } = await adminDb
    .from("order_parcels")
    .select(`
      parcels!inner(
        id, tracking_no, storage_locations(code)
      )
    `)
    .eq("order_id", orderId);

  if (!ops || ops.length === 0) return [];

  const parcelIds = ops.map((op) => {
    const p = op.parcels as unknown as { id: string; tracking_no: string | null; storage_locations: { code: string } | null };
    return { id: p.id, tracking_no: p.tracking_no, location_code: p.storage_locations?.code ?? null };
  });

  return buildItemsFromParcels(parcelIds);
}

async function buildItemsFromParcelIds(ids: string[]) {
  if (ids.length === 0) return [];

  const { data: parcels } = await adminDb
    .from("parcels")
    .select("id, tracking_no, storage_locations(code)")
    .in("id", ids);

  const rows = (parcels ?? []).map((p) => ({
    id: p.id,
    tracking_no: p.tracking_no,
    location_code: (p.storage_locations as unknown as { code: string } | null)?.code ?? null,
  }));

  return buildItemsFromParcels(rows);
}

async function buildItemsFromParcels(
  parcels: { id: string; tracking_no: string | null; location_code: string | null }[],
) {
  const allBarcodes = await Promise.all(
    parcels.map(async (p) => {
      const { data: barcodes } = await adminDb
        .from("parcel_barcodes")
        .select("id, barcode_no, seq, item_name, storage_location_id, storage_locations(code)")
        .eq("parcel_id", p.id)
        .order("seq");

      return (barcodes ?? []).map((b) => ({
        barcode_id:      b.id,
        barcode_no:      b.barcode_no,
        seq:             b.seq,
        item_name:       b.item_name,
        parcel_id:       p.id,
        parcel_tracking: p.tracking_no,
        location_code:   (b.storage_locations as unknown as { code: string } | null)?.code
                         ?? p.location_code
                         ?? null,
      }));
    }),
  );

  return allBarcodes.flat().sort((a, b) => {
    if (a.location_code && b.location_code) return a.location_code.localeCompare(b.location_code);
    return a.seq - b.seq;
  });
}
