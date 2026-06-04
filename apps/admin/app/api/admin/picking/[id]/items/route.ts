import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { getOrderBarcodes } from "../route";

/**
 * PATCH /api/admin/picking/[id]/items
 *
 * 물품 수동 상태 변경 (수동완료·보류·물품없음)
 * rawId 형식: "intl-{uuid}" or "dom-{uuid}"
 *
 * Body:
 *   barcodeId  string                   변경할 바코드 UUID
 *   status     "DONE" | "HOLD" | "NOT_FOUND"
 *   reason     string                   사유 (필수)
 *   note       string | undefined       메모 (선택)
 */
export async function PATCH(
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
    barcodeId: string;
    status:    string;
    reason:    string;
    note?:     string;
  };

  const { barcodeId, status, reason, note } = body;

  if (!["DONE", "HOLD", "NOT_FOUND"].includes(status))
    return NextResponse.json({ error: "status 는 DONE·HOLD·NOT_FOUND 중 하나" }, { status: 400 });

  if (!reason?.trim())
    return NextResponse.json({ error: "reason 은 필수입니다." }, { status: 400 });

  // 이 주문에 속한 바코드인지 검증
  const orderBarcodes = await getOrderBarcodes(orderId, orderType);
  const isValid = orderBarcodes.some((b) => b.id === barcodeId);

  if (!isValid)
    return NextResponse.json({ error: "이 주문에 속하지 않는 바코드입니다." }, { status: 400 });

  const now = new Date().toISOString();

  const { error } = await adminDb
    .from("parcel_barcodes")
    .update({
      picking_status: status,
      picking_reason: reason.trim(),
      picking_note:   note?.trim() ?? null,
      picked_at:      now,
      picked_by:      admin.id,
    })
    .eq("id", barcodeId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
