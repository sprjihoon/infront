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
 * - body 없음 또는 전체 parcel_ids: 주문 전체 취소, 물품 스토리지 복구
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

    // admin client로 조회 후 코드에서 소유권 검증 (RLS 우회)
    const admin = createAdminSupabase();

    const ADMIN_SELECTS = [
      "id, order_no, status, payment_status, shipping_method, recipient_country, customer_id, duty_prepaid, insurance_enabled, order_parcels(parcel_id)",
      "id, order_no, status, payment_status, shipping_method, recipient_country, customer_id, duty_prepaid, order_parcels(parcel_id)",
      "id, order_no, status, payment_status, shipping_method, recipient_country, customer_id, duty_prepaid",
      "id, order_no, status, payment_status, shipping_method, recipient_country, customer_id, order_parcels(parcel_id)",
      "id, order_no, status, payment_status, shipping_method, recipient_country, customer_id",
    ];

    let orderRow: Record<string, unknown> | null = null;
    for (const sel of ADMIN_SELECTS) {
      const { data, error } = await admin
        .from("orders")
        .select(sel)
        .eq("id", orderId)
        .maybeSingle();
      if (!error) {
        orderRow = data as Record<string, unknown> | null;
        break;
      }
      console.warn("[ORDER CANCEL] admin select fallback:", (error as { message?: string }).message);
    }

    if (!orderRow) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    // 소유권 검증 (코드 레벨)
    if (String(orderRow.customer_id) !== String(user.id)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    // order_parcels가 조인에 없으면 별도 조회
    let orderParcels = (orderRow.order_parcels ?? []) as Array<{ parcel_id: string }>;
    if (!Array.isArray(orderRow.order_parcels)) {
      const { data: opData } = await admin
        .from("order_parcels")
        .select("parcel_id")
        .eq("order_id", orderId);
      orderParcels = opData ?? [];
    }

    const order = {
      id: orderRow.id as string,
      order_no: orderRow.order_no as string,
      status: orderRow.status as string,
      payment_status: (orderRow.payment_status ?? "UNPAID") as string,
      shipping_method: orderRow.shipping_method as string,
      recipient_country: (orderRow.recipient_country ?? null) as string | null,
      duty_prepaid: (orderRow.duty_prepaid ?? false) as boolean,
      insurance_enabled: (orderRow.insurance_enabled ?? false) as boolean,
      order_parcels: orderParcels,
    };

    if (order.status === "CANCELLED") {
      return NextResponse.json({ ok: true, alreadyCancelled: true });
    }

    const paymentStatus = order.payment_status;
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
        body: `주문번호 ${order.order_no} 신청이 취소되었습니다. 스토리지에서 물품을 다시 출고 신청할 수 있습니다.`,
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
      body: `주문번호 ${order.order_no}에서 물품 ${parcelIdsToRemove.length}개가 제외되었습니다. 스토리지에서 다시 출고 신청할 수 있습니다.`,
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
