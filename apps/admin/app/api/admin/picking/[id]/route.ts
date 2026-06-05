import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

// ── 공용 타입 ─────────────────────────────────────────────────

export interface PickingBarcode {
  id: string;
  barcode_no: string;
  seq: number;
  item_name: string | null;
  picking_status: "WAITING" | "DONE" | "HOLD" | "NOT_FOUND";
  picking_reason: string | null;
  picking_note: string | null;
  picked_at: string | null;
  location: { id: string; code: string } | null;
}

export interface PickingStats {
  total: number;
  done: number;
  hold: number;
  not_found: number;
  waiting: number;
}

// ── 헬퍼: 주문에 속한 모든 바코드 조회 ───────────────────────

export async function getOrderBarcodes(
  orderId: string,
  orderType: "intl" | "domestic",
): Promise<PickingBarcode[]> {
  let parcelIds: string[] = [];

  if (orderType === "intl") {
    const { data: ops } = await adminDb
      .from("order_parcels")
      .select("parcel_id")
      .eq("order_id", orderId);
    parcelIds = (ops ?? []).map((r) => r.parcel_id);
    if (parcelIds.length === 0) {
      console.warn(`[picking] order_parcels empty for intl order ${orderId} — parcels not linked`);
    }
  } else {
    const { data: domOrder } = await adminDb
      .from("domestic_orders")
      .select("parcel_ids")
      .eq("id", orderId)
      .single();
    parcelIds = (domOrder?.parcel_ids as string[] | null) ?? [];
    if (parcelIds.length === 0) {
      console.warn(`[picking] parcel_ids empty for domestic order ${orderId}`);
    }
  }

  if (parcelIds.length === 0) return [];

  // 바코드 조회 (바코드 자체의 위치 포함)
  const { data: barcodes } = await adminDb
    .from("parcel_barcodes")
    .select(
      "id, parcel_id, barcode_no, seq, item_name, picking_status, picking_reason, picking_note, picked_at, storage_location_id, storage_locations(id, code)",
    )
    .in("parcel_id", parcelIds)
    .order("seq");

  // 바코드에 위치가 없으면 소포(parcels)의 위치로 폴백
  const barcodesWithoutLoc = (barcodes ?? []).filter(
    (b) => !b.storage_location_id,
  );

  let parcelLocMap: Record<string, { id: string; code: string } | null> = {};
  if (barcodesWithoutLoc.length > 0) {
    const uniqueParcelIds = [...new Set(barcodesWithoutLoc.map((b) => b.parcel_id as string))];
    const { data: parcels } = await adminDb
      .from("parcels")
      .select("id, storage_location_id, storage_locations(id, code)")
      .in("id", uniqueParcelIds);
    parcelLocMap = Object.fromEntries(
      (parcels ?? []).map((p) => [
        p.id,
        (p.storage_locations as unknown as { id: string; code: string } | null) ?? null,
      ]),
    );
  }

  return (barcodes ?? []).map((b) => {
    const barcodeLocation = (b.storage_locations as unknown as { id: string; code: string } | null) ?? null;
    const fallbackLocation = parcelLocMap[b.parcel_id as string] ?? null;
    return {
      id: b.id,
      barcode_no: b.barcode_no,
      seq: b.seq,
      item_name: b.item_name,
      picking_status: (b.picking_status ?? "WAITING") as PickingBarcode["picking_status"],
      picking_reason: b.picking_reason ?? null,
      picking_note: b.picking_note ?? null,
      picked_at: b.picked_at ?? null,
      location: barcodeLocation ?? fallbackLocation,
    };
  });
}

export function computeStats(barcodes: PickingBarcode[]): PickingStats {
  const done      = barcodes.filter((b) => b.picking_status === "DONE").length;
  const hold      = barcodes.filter((b) => b.picking_status === "HOLD").length;
  const not_found = barcodes.filter((b) => b.picking_status === "NOT_FOUND").length;
  return {
    total: barcodes.length,
    done,
    hold,
    not_found,
    waiting: barcodes.length - done - hold - not_found,
  };
}

// ── GET /api/admin/picking/[id] ───────────────────────────────
// rawId 형식: "intl-{uuid}" or "dom-{uuid}"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: rawId } = await params;
  const isIntl    = !rawId.startsWith("dom-");
  const orderId   = rawId.replace(/^(intl|dom)-/, "");
  const orderType = isIntl ? "intl" : "domestic";

  if (isIntl) {
    const { data: order } = await adminDb
      .from("orders")
      .select(`
        id, order_no, status, shipping_method,
        recipient_name, recipient_country, packaging_type,
        picking_started_at, picking_done_at,
        customers(name, customer_code)
      `)
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const barcodes = await getOrderBarcodes(orderId, orderType);
    return NextResponse.json({
      type: "intl",
      order,
      barcodes,
      stats: computeStats(barcodes),
      ...(barcodes.length === 0 ? { warn: "no_parcels_linked" } : {}),
    });
  } else {
    const { data: order } = await adminDb
      .from("domestic_orders")
      .select(`
        id, status, recipient_name, recipient_addr1,
        packaging_type, delivery_msg, notes,
        picking_started_at, picking_done_at,
        customers(name, customer_code)
      `)
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const barcodes = await getOrderBarcodes(orderId, orderType);
    return NextResponse.json({
      type: "domestic",
      order,
      barcodes,
      stats: computeStats(barcodes),
      ...(barcodes.length === 0 ? { warn: "no_parcels_linked" } : {}),
    });
  }
}

// ── PATCH /api/admin/picking/[id] ────────────────────────────
// 피킹 상태 변경: action = 'start' | 'done'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: rawId } = await params;
  const isIntl  = !rawId.startsWith("dom-");
  const orderId = rawId.replace(/^(intl|dom)-/, "");

  const body = (await req.json()) as { action: string; type?: string };
  const { action } = body;
  const type = isIntl ? "intl" : "domestic";

  if (!["start", "done"].includes(action))
    return NextResponse.json({ error: "action은 start 또는 done" }, { status: 400 });

  const table = type === "domestic" ? "domestic_orders" : "orders";
  const now   = new Date().toISOString();

  if (action === "start") {
    const { data: row, error: fetchErr } = await adminDb
      .from(table)
      .select("status")
      .eq("id", orderId)
      .single();

    if (fetchErr || !row)
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });

    const allowedFrom = type === "domestic" ? ["PENDING"] : ["DRAFT", "PAID", "PACKING"];
    if (!allowedFrom.includes(row.status)) {
      return NextResponse.json(
        { error: `현재 상태(${row.status})에서 피킹을 시작할 수 없습니다.`, current_status: row.status },
        { status: 409 },
      );
    }

    const { error } = await adminDb
      .from(table)
      .update({ status: "PICKING", picking_started_at: now })
      .eq("id", orderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (action === "done") {
    const { data: row, error: fetchErr } = await adminDb
      .from(table)
      .select("status")
      .eq("id", orderId)
      .single();

    if (fetchErr || !row)
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });

    if (row.status !== "PICKING") {
      return NextResponse.json(
        { error: `현재 상태(${row.status})에서 피킹 완료할 수 없습니다.` },
        { status: 409 },
      );
    }

    const { error } = await adminDb
      .from(table)
      .update({ status: "PICKING_DONE", picking_done_at: now })
      .eq("id", orderId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
