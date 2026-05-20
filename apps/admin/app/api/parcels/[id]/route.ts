import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "status", "weight_actual", "vol_length", "vol_width", "vol_height",
    "is_shippable", "hold_reason", "notes", "inbound_at", "tracking_no",
  ];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data, error } = await adminDb
    .from("parcels")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 상태 변경 시 알림
  if (body.status) {
    const STATUS_NOTIFY: Record<string, { title: string; body: string }> = {
      INBOUND:     { title: "물품이 창고에 입고되었습니다", body: "입고 처리가 완료되었어요." },
      INSPECTION:  { title: "검수가 시작되었습니다",        body: "담당자가 물품을 검수하고 있어요." },
      HOLD:        { title: "물품이 보류되었습니다",        body: `사유: ${body.hold_reason ?? ""}` },
      PACKING:     { title: "포장 작업이 시작되었습니다",   body: "포장 완료 후 발송됩니다." },
      SHIPPING:    { title: "물품이 발송되었습니다",        body: "국제 배송이 시작되었어요." },
      DONE:        { title: "배송이 완료되었습니다",        body: "물품이 목적지에 도착했습니다." },
    };
    const notify = STATUS_NOTIFY[body.status];
    if (notify) {
      const { data: parcel } = await adminDb.from("parcels").select("customer_id").eq("id", id).single();
      if (parcel) {
        await adminDb.from("notifications").insert({
          customer_id: parcel.customer_id,
          type: `PARCEL_${body.status}`,
          title: notify.title,
          body: notify.body,
          data: { parcel_id: id },
        });
      }
    }
  }

  return NextResponse.json({ data });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  if (action === "inspection") {
    const { checklist, grade, notes } = body;
    const { data, error } = await adminDb
      .from("inspection_results")
      .insert({
        parcel_id: id,
        inspector_id: admin.id,
        checklist: checklist ?? {},
        grade: grade ?? "OK",
        notes: notes ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 검수 결과에 따라 parcel 상태 업데이트
    const nextStatus = grade === "RETURN_RECOMMENDED" ? "HOLD" : "INSPECTION";
    await adminDb.from("parcels").update({
      status: nextStatus,
      is_shippable: grade !== "RETURN_RECOMMENDED",
      hold_reason: grade === "RETURN_RECOMMENDED" ? "검수 결과: 반품 권장" : null,
    }).eq("id", id);

    // 고객 알림
    const { data: parcel } = await adminDb.from("parcels").select("customer_id").eq("id", id).single();
    if (parcel) {
      await adminDb.from("notifications").insert({
        customer_id: parcel.customer_id,
        type: "INSPECTION_DONE",
        title: "검수가 완료되었습니다",
        body: grade === "OK" ? "물품 상태 양호 - 배송 신청 가능합니다" : `검수 결과: ${GRADE_LABEL[grade] ?? grade}`,
        data: { parcel_id: id, grade },
      });
    }

    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

const GRADE_LABEL: Record<string, string> = {
  OK:                 "정상",
  HOLD:               "보류",
  RETURN_RECOMMENDED: "반품 권장",
};
