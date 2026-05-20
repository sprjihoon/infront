import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const [{ data: order }, { data: orderParcels }, { data: orderServices }] = await Promise.all([
    adminDb
      .from("orders")
      .select("*, customers(name, email, customer_code, personal_address)")
      .eq("id", id)
      .single(),
    adminDb
      .from("order_parcels")
      .select("*, parcels(tracking_no, weight_actual, vol_length, vol_width, vol_height)")
      .eq("order_id", id),
    adminDb
      .from("order_services")
      .select("*, services(code, name, category)")
      .eq("order_id", id),
  ]);

  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ order, orderParcels: orderParcels ?? [], orderServices: orderServices ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { action } = body;

  if (action === "confirm_quote") {
    const { final_shipping_fee, note } = body;
    if (!final_shipping_fee) return NextResponse.json({ error: "최종 배송비가 필요합니다" }, { status: 400 });

    const { data: order } = await adminDb.from("orders").select("*").eq("id", id).single();
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const newTotal = (order.packaging_fee ?? 0) + parseInt(final_shipping_fee);

    const { data, error } = await adminDb
      .from("orders")
      .update({
        status: "QUOTE_SENT",
        shipping_fee: parseInt(final_shipping_fee),
        total_amount: newTotal,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminDb.from("notifications").insert({
      customer_id: order.customer_id,
      type: "QUOTE_SENT",
      title: "배송 견적이 확정되었습니다",
      body: `총 결제 금액: ${newTotal.toLocaleString()}원${note ? ` (${note})` : ""}`,
      data: { order_id: id, total_amount: newTotal },
    });

    return NextResponse.json({ data });
  }

  if (action === "ship") {
    const { tracking_no, carrier } = body;
    if (!tracking_no) return NextResponse.json({ error: "운송장 번호가 필요합니다" }, { status: 400 });

    const { data: order } = await adminDb.from("orders").select("customer_id").eq("id", id).single();
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data, error } = await adminDb
      .from("orders")
      .update({
        status: "IN_TRANSIT",
        tracking_no,
        carrier: carrier ?? null,
        shipped_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await adminDb.from("notifications").insert({
      customer_id: order.customer_id,
      type: "ORDER_SHIPPED",
      title: "물품이 발송되었습니다 ✈️",
      body: `운송장: ${tracking_no}`,
      data: { order_id: id, tracking_no },
    });

    // 연결된 parcel 상태도 SHIPPING으로 업데이트
    const { data: parcelLinks } = await adminDb
      .from("order_parcels")
      .select("parcel_id")
      .eq("order_id", id);

    if (parcelLinks && parcelLinks.length > 0) {
      const parcelIds = parcelLinks.map((p) => p.parcel_id);
      await adminDb.from("parcels").update({ status: "SHIPPING" }).in("id", parcelIds);
    }

    return NextResponse.json({ data });
  }

  if (action === "cancel") {
    const { data, error } = await adminDb
      .from("orders")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
