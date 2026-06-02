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

  // SHIPPABLE = 보관중·출고가능
  if (updates.status === "SHIPPABLE") {
    updates.is_shippable = true;
  }
  // INBOUND = 센터입고(처리중)
  if (updates.status === "INBOUND") {
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
    const STATUS_NOTIFY: Record<string, { title: string; body: string }> = {
      PICKED_UP:  { title: "수거가 완료되었습니다", body: "물품이 센터로 이동 중입니다." },
      INBOUND:    { title: "센터에 입고되었습니다", body: "보관 처리 후 출고 신청이 가능해집니다." },
      SHIPPABLE:  { title: "보관 완료 · 출고 가능", body: "출고 신청이 가능합니다." },
      HOLD:       { title: "물품이 보류되었습니다", body: `사유: ${body.hold_reason ?? ""}` },
      PACKING:    { title: "포장 작업이 시작되었습니다", body: "포장 완료 후 발송됩니다." },
      SHIPPING:   { title: "물품이 발송되었습니다", body: "국제 배송이 시작되었어요." },
      DONE:       { title: "배송이 완료되었습니다", body: "물품이 목적지에 도착했습니다." },
    };
    const notify = STATUS_NOTIFY[body.status];
    if (notify) {
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

  // 레거시 inspection 액션 — 보류 처리만 유지
  if (action === "inspection") {
    const { grade, notes } = body;

    const isOk = grade === "OK";
    const nextStatus = (grade === "RETURN_RECOMMENDED" || grade === "HOLD") ? "HOLD" : "SHIPPABLE";
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
        type: "PARCEL_SHIPPABLE",
        title: isOk ? "보관 완료 · 출고 가능" : "물품이 보류되었습니다",
        body: isOk ? "출고 신청이 가능합니다." : `${notes ?? ""}`,
      });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
