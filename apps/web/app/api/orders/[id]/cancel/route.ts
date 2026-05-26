import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { canCustomerCancelOrder } from "@/lib/order-reservation";

export const preferredRegion = "icn1";

function createUserSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );
}

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    srk,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

/**
 * POST /api/orders/[id]/cancel
 * 신청 완료(DRAFT) 주문 취소 — 연결된 소포를 출고 가능 상태로 복원
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const cookieStore = await cookies();
    const supabase = createUserSupabase(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, order_no, status, payment_status, order_parcels(parcel_id)")
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }

    if (!canCustomerCancelOrder(order.status, order.payment_status ?? "UNPAID")) {
      return NextResponse.json(
        {
          error:
            order.payment_status === "PAID"
              ? "결제가 완료된 주문은 직접 취소할 수 없습니다. 고객센터로 문의해 주세요."
              : "신청 완료 상태에서만 취소할 수 있습니다. 포장·견적 진행 후에는 고객센터로 문의해 주세요.",
        },
        { status: 400 }
      );
    }

    const parcelIds = (order.order_parcels ?? []).map(
      (op: { parcel_id: string }) => op.parcel_id
    );

    const admin = createAdminSupabase();

    if (parcelIds.length > 0) {
      const { error: opDelErr } = await admin
        .from("order_parcels")
        .delete()
        .eq("order_id", orderId);
      if (opDelErr) {
        console.error("[ORDER CANCEL] order_parcels delete:", opDelErr);
        return NextResponse.json({ error: "물품 연결 해제에 실패했습니다." }, { status: 500 });
      }
    }

    await admin.from("packaging_requests").delete().eq("order_id", orderId).eq("status", "PENDING");

    await admin
      .from("order_services")
      .update({ status: "CANCELLED" })
      .eq("order_id", orderId)
      .neq("status", "DONE");

    await admin.from("shipping_boxes").delete().eq("order_id", orderId).in("status", ["PREPARING", "PACKED"]);

    if (parcelIds.length > 0) {
      await admin
        .from("parcel_service_requests")
        .update({ status: "CANCELLED" })
        .in("parcel_id", parcelIds)
        .eq("status", "REQUESTED");
    }

    const { error: updateErr } = await admin
      .from("orders")
      .update({
        status: "CANCELLED",
        payment_status: "CANCELLED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .eq("customer_id", user.id);

    if (updateErr) {
      console.error("[ORDER CANCEL] order update:", updateErr);
      return NextResponse.json({ error: "주문 취소 처리에 실패했습니다." }, { status: 500 });
    }

    await supabase.from("notifications").insert({
      customer_id: user.id,
      order_id: orderId,
      type: "INBOUND",
      title: "해외배송 신청 취소",
      body: `주문번호 ${order.order_no} 신청이 취소되었습니다. 마이창고에서 물품을 다시 출고 신청할 수 있습니다.`,
    });

    return NextResponse.json({
      ok: true,
      order_id: orderId,
      restored_parcel_count: parcelIds.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[ORDER CANCEL]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
