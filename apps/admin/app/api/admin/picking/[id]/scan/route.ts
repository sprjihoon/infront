import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { getOrderBarcodes } from "../route";

/**
 * POST /api/admin/picking/[id]/scan
 *
 * 피킹 현장 바코드 스캔 처리
 * rawId 형식: "intl-{uuid}" or "dom-{uuid}"
 *
 * Body:  { barcode: string }
 * Returns:
 *   { result: "PICKED"       }  정상 스캔  → picking_status = DONE
 *   { result: "WRONG_ORDER"  }  오스캔     → 상태 변경 없음
 *   { result: "DUPLICATE"    }  중복 스캔  → 상태 변경 없음
 *   { result: "NOT_FOUND"    }  미등록     → 상태 변경 없음
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: rawId } = await params;
  const isIntl    = !rawId.startsWith("dom-");
  const orderId   = rawId.replace(/^(intl|dom)-/, "");
  const orderType = isIntl ? "intl" : "domestic";

  const body = (await req.json()) as { barcode?: string };
  const barcode = body.barcode?.trim();

  if (!barcode)
    return NextResponse.json({ error: "barcode 필드가 필요합니다." }, { status: 400 });

  // ── 1. 바코드가 parcel_barcodes 에 등록돼 있는지 확인 ────────
  const { data: barcodeRow } = await adminDb
    .from("parcel_barcodes")
    .select(`
      id, barcode_no, seq, item_name,
      picking_status, parcel_id,
      storage_location_id,
      storage_locations(id, code)
    `)
    .eq("barcode_no", barcode)
    .maybeSingle();

  if (!barcodeRow) {
    await logScan({ orderId, orderType, barcode, result: "NOT_FOUND", userId: admin.id });
    return NextResponse.json({ result: "NOT_FOUND" });
  }

  // ── 2. 이 주문에 속한 바코드인지 확인 ───────────────────────
  const orderBarcodes = await getOrderBarcodes(orderId, orderType);
  const belongsToOrder = orderBarcodes.some((b) => b.id === barcodeRow.id);

  if (!belongsToOrder) {
    await logScan({ orderId, orderType, barcode, result: "WRONG_ORDER", userId: admin.id });
    return NextResponse.json({ result: "WRONG_ORDER" });
  }

  // ── 3. 이미 피킹 완료된 바코드인지 확인 ─────────────────────
  if (barcodeRow.picking_status === "DONE") {
    await logScan({ orderId, orderType, barcode, result: "DUPLICATE", userId: admin.id });
    return NextResponse.json({
      result: "DUPLICATE",
      barcode: formatBarcode(barcodeRow),
    });
  }

  // ── 4. 정상 스캔 → DONE 처리 ────────────────────────────────
  const now = new Date().toISOString();
  const { error } = await adminDb
    .from("parcel_barcodes")
    .update({
      picking_status: "DONE",
      picked_at:      now,
      picked_by:      admin.id,
      picking_reason: null,
      picking_note:   null,
    })
    .eq("id", barcodeRow.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await logScan({ orderId, orderType, barcode, result: "PICKED", userId: admin.id });

  return NextResponse.json({
    result: "PICKED",
    barcode: {
      ...formatBarcode(barcodeRow),
      picking_status: "DONE",
      picked_at:      now,
    },
  });
}

// ── 헬퍼 ─────────────────────────────────────────────────────

function formatBarcode(row: {
  id: string;
  barcode_no: string;
  seq: number;
  item_name: string | null;
  picking_status: string;
  storage_locations: unknown;
}) {
  return {
    id:             row.id,
    barcode_no:     row.barcode_no,
    seq:            row.seq,
    item_name:      row.item_name,
    picking_status: row.picking_status,
    location:       (row.storage_locations as { id: string; code: string } | null) ?? null,
  };
}

async function logScan(params: {
  orderId:   string;
  orderType: "intl" | "domestic";
  barcode:   string;
  result:    "PICKED" | "WRONG_ORDER" | "DUPLICATE" | "NOT_FOUND";
  userId:    string;
}) {
  await adminDb.from("picking_scan_logs").insert({
    order_id:    params.orderId,
    order_type:  params.orderType,
    barcode_no:  params.barcode,
    scan_result: params.result,
    scanned_by:  params.userId,
  });
}
