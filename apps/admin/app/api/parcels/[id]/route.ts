import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";
import { mapParcelForClient, parcelUpdatesFromBody } from "@/lib/parcels/fields";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const updates = parcelUpdatesFromBody(body);

  const { data: current } = await adminDb
    .from("parcels")
    .select("status, is_shippable")
    .eq("id", id)
    .maybeSingle();

  if (updates.status === "INBOUND" && body.is_shippable !== true) {
    updates.is_shippable = false;
  }
  if (updates.status === "INSPECTION") {
    updates.is_shippable = false;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "변경할 항목이 없습니다." }, { status: 400 });
  }

  const { data, error } = await adminDb
    .from("parcels")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (body.status) {
    const isReady = body.status === "INBOUND" && updates.is_shippable === true;
    const isRevertToInbound =
      current?.status === "INSPECTION" && body.status === "INBOUND" && !isReady;

    const STATUS_NOTIFY: Record<string, { title: string; body: string }> = {
      PICKED_UP:   { title: "수거가 완료되었습니다", body: "물품이 센터로 이동 중입니다." },
      INBOUND:     isReady
        ? { title: "입고 완료", body: "스토리지에서 출고 신청이 가능합니다." }
        : { title: "센터에 입고되었습니다", body: "검수 후 출고 신청이 가능해집니다." },
      INSPECTION:  { title: "검수가 시작되었습니다", body: "담당자가 물품을 검수하고 있어요." },
      HOLD:        { title: "물품이 보류되었습니다", body: `사유: ${body.hold_reason ?? ""}` },
      PACKING:     { title: "포장 작업이 시작되었습니다", body: "포장 완료 후 발송됩니다." },
      SHIPPING:    { title: "물품이 발송되었습니다", body: "국제 배송이 시작되었어요." },
      DONE:        { title: "배송이 완료되었습니다", body: "물품이 목적지에 도착했습니다." },
    };
    const notify = STATUS_NOTIFY[body.status];
    if (notify && !isRevertToInbound) {
      const { data: parcel } = await adminDb.from("parcels").select("customer_id").eq("id", id).single();
      if (parcel) {
        await adminDb.from("notifications").insert({
          customer_id: parcel.customer_id,
          parcel_id: id,
          type: `PARCEL_${body.status}`,
          title: notify.title,
          body: notify.body,
        });
      }
    }
  }

  return NextResponse.json({ data: mapParcelForClient(data) });
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

    const isOk = grade === "OK";
    const nextStatus = grade === "RETURN_RECOMMENDED" || grade === "HOLD" ? "HOLD" : "INBOUND";
    await adminDb.from("parcels").update({
      status: nextStatus,
      is_shippable: isOk,
      hold_reason: grade === "RETURN_RECOMMENDED"
        ? "검수 결과: 반품 권장"
        : grade === "HOLD"
          ? "검수 결과: 보류"
          : null,
    }).eq("id", id);

    const { data: parcel } = await adminDb.from("parcels").select("customer_id").eq("id", id).single();
    if (parcel) {
      await adminDb.from("notifications").insert({
        customer_id: parcel.customer_id,
        parcel_id: id,
        type: "INSPECTION_DONE",
        title: "검수가 완료되었습니다",
        body: grade === "OK" ? "물품 상태 양호 - 배송 신청 가능합니다" : `검수 결과: ${GRADE_LABEL[grade] ?? grade}`,
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
