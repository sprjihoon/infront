import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { getOrderBarcodes } from "../route";

/**
 * POST /api/admin/picking/[id]/scan
 *
 * 피킹 스캔 1회 처리:
 *  - picking_scan_logs 에 이력 기록 (항상)
 *  - 정상 스캔이면 parcel_barcodes.picking_status = 'DONE'
 *  - 보류/누락이면 parcel_barcodes.picking_status = 'HOLD' | 'NOT_FOUND'
 *
 * Body:
 *   barcode_no    string
 *   order_type    'intl' | 'domestic'
 *   scan_result?  'PICKED' | 'WRONG_ORDER' | 'DUPLICATE' | 'NOT_FOUND'
 *                 (생략 시 자동 판별)
 *   reason?       string   보류·누락 사유
 *   note?         string   추가 메모
 *
 * Response:
 *   { ok, scan_result, item_name?, barcode_id? }
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

  const body = (await req.json()) as {
    barcode_no: string;
    scan_result?: "PICKED" | "WRONG_ORDER" | "DUPLICATE" | "NOT_FOUND";
    reason?: string;
    note?: string;
  };

  const { barcode_no, reason, note } = body;
  if (!barcode_no) return NextResponse.json({ error: "barcode_no 필수" }, { status: 400 });

  const now = new Date().toISOString();

  // ── 1. 해당 주문의 바코드 목록에서 조회 ──────────────────────
  const barcodes = await getOrderBarcodes(orderId, orderType);
  const found    = barcodes.find((b) => b.barcode_no === barcode_no);

  let scanResult: "PICKED" | "WRONG_ORDER" | "DUPLICATE" | "NOT_FOUND";

  if (body.scan_result) {
    // 클라이언트가 명시적으로 결과를 지정한 경우 (보류·누락 수동 처리)
    scanResult = body.scan_result;
  } else if (!found) {
    // 바코드가 시스템에 존재하는지 추가 확인
    const { data: sysBarcode } = await adminDb
      .from("parcel_barcodes")
      .select("id")
      .eq("barcode_no", barcode_no)
      .maybeSingle();

    scanResult = sysBarcode ? "WRONG_ORDER" : "NOT_FOUND";
  } else if (found.picking_status === "DONE") {
    scanResult = "DUPLICATE";
  } else {
    scanResult = "PICKED";
  }

  // ── 2. picking_scan_logs 에 이력 저장 ────────────────────────
  await adminDb.from("picking_scan_logs").insert({
    order_id:    orderId,
    order_type:  orderType,
    barcode_no,
    scan_result: scanResult,
    scanned_by:  admin.id,
    scanned_at:  now,
  });

  // ── 3. parcel_barcodes 상태 업데이트 ─────────────────────────
  if (found) {
    const newStatus =
      scanResult === "PICKED"    ? "DONE"
      : scanResult === "DUPLICATE" ? found.picking_status // 변경 없음
      : null; // WRONG_ORDER는 다른 바코드라 업데이트 불필요

    // 수동 보류·누락도 처리
    const manualStatus =
      body.scan_result === "HOLD"      ? "HOLD"
      : body.scan_result === "NOT_FOUND" ? "NOT_FOUND"
      : null;

    const statusToSet = manualStatus ?? newStatus;
    if (statusToSet && statusToSet !== found.picking_status) {
      await adminDb
        .from("parcel_barcodes")
        .update({
          picking_status: statusToSet,
          picking_reason: reason ?? null,
          picking_note:   note   ?? null,
          picked_at:      statusToSet === "DONE" ? now : null,
          picked_by:      statusToSet === "DONE" ? admin.id : null,
        })
        .eq("id", found.id);
    }
  }

  return NextResponse.json({
    ok:          true,
    scan_result: scanResult,
    item_name:   found?.item_name ?? null,
    barcode_id:  found?.id        ?? null,
  });
}

/**
 * PATCH /api/admin/picking/[id]/scan
 *
 * 개별 바코드 상태 수동 수정
 * Body: { barcode_id, picking_status, reason?, note? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await params;

  const { barcode_id, picking_status, reason, note } = (await req.json()) as {
    barcode_id:     string;
    picking_status: "WAITING" | "DONE" | "HOLD" | "NOT_FOUND";
    reason?:        string;
    note?:          string;
  };

  if (!barcode_id || !picking_status)
    return NextResponse.json({ error: "barcode_id, picking_status 필수" }, { status: 400 });

  const now = new Date().toISOString();
  const { error } = await adminDb
    .from("parcel_barcodes")
    .update({
      picking_status,
      picking_reason: reason ?? null,
      picking_note:   note   ?? null,
      picked_at:      picking_status === "DONE" ? now : null,
      picked_by:      picking_status === "DONE" ? admin.id : null,
    })
    .eq("id", barcode_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
