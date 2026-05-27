import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  canCustomerCancelOrder,
  getCustomerCancelBlockReason,
} from "@/lib/order-reservation";
import {
  cleanupOrderDraftArtifacts,
  rebuildOrderAfterPartialRelease,
} from "@/lib/order-cancel";

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
            cookieStore.set(name, value, options),
          ),
      },
    },
  );
}

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srk, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

type CancelBody = {
  parcel_ids?: string[];
};

/**
 * POST /api/orders/[id]/cancel
 * - body 없음 또는 전체 parcel_ids: 주문 전체 취소, 물품 마이창고 복구
 * - body.parcel_ids: 해당 물품만 주문에서 제외(부분 취소), 나머지는 주문 유지
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: orderId } = await params;
    let body: CancelBody = {};
    try {
      const text = await req.text();
      if (text.trim()) body = JSON.parse(text) as CancelBody;
    } catch {
      return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

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
      .select(
        "id, order_no, status, payment_status, shipping_method, recipient_country, duty_prepaid, insurance_enabled, order_parcels(parcel_id)",
      )
      .eq("id", orderId)
      .eq("customer_id", user.id)
      .maybeSingle();

    if (orderErr || !order) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (order.status === "CANCELLED") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }

    const paymentStatus = order.payment_status ?? "UNPAID";
    if (!canCustomerCancelOrder(order.status, paymentStatus)) {
      return NextResponse.json(
        {
          error:
            getCustomerCancelBlockReason(order.status, paymentStatus) ??
            "출고 처리가 시작된 주문은 취소할 수 없습니다.",
        },
        { status: 400 },
      );
    }

    const allParcelIds = (order.order_parcels ?? []).map(
      (op: { parcel_id: string }) => op.parcel_id,
    );

    const requestedRemove = Array.isArray(body.parcel_ids)
      ? [...new Set(body.parcel_ids.filter((id) => typeof id === "string" && id))]
      : [];

    const parcelIdsToRemove =
      requestedRemove.length > 0
        ? requestedRemove.filter((id) => allParcelIds.includes(id))
        : allParcelIds;

    if (requestedRemove.length > 0 && parcelIdsToRemove.length === 0) {
      return NextResponse.json({ error: "주문에 포함된 물품만 선택할 수 있습니다." }, { status: 400 });
    }

    if (requestedRemove.length > 0 && parcelIdsToRemove.length !== requestedRemove.length) {
      return NextResponse.json({ error: "주문에 없는 물품이 포함되어 있습니다." }, { status: 400 });
    }

    const isFullCancel =
      parcelIdsToRemove.length === 0 ||
      parcelIdsToRemove.length >= allParcelIds.length;

    const admin = createAdminSupabase();

    if (isFullCancel) {
      await cleanupOrderDraftArtifacts(admin, orderId, allParcelIds, true);

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
        mode: "full",
        order_id: orderId,
        restored_parcel_count: allParcelIds.length,
      });
    }

    const remainingIds = allParcelIds.filter((id) => !parcelIdsToRemove.includes(id));

    await cleanupOrderDraftArtifacts(admin, orderId, parcelIdsToRemove, false);
    await rebuildOrderAfterPartialRelease(admin, order, remainingIds);

    await supabase.from("notifications").insert({
      customer_id: user.id,
      order_id: orderId,
      type: "INBOUND",
      title: "배송 신청 물품 제외",
      body: `주문번호 ${order.order_no}에서 물품 ${parcelIdsToRemove.length}개가 제외되었습니다. 마이창고에서 다시 출고 신청할 수 있습니다.`,
    });

    return NextResponse.json({
      ok: true,
      mode: "partial",
      order_id: orderId,
      restored_parcel_count: parcelIdsToRemove.length,
      remaining_parcel_count: remainingIds.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[ORDER CANCEL]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
