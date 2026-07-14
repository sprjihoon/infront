import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getShopAuthUser } from "@/lib/shop/auth";
import { fetchEmsTraceEvents } from "@/lib/ems/tracking";
import { trackParcel } from "@/lib/tracking/client";

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ oid: string }> }
) {
  const user = await getShopAuthUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { oid } = await params;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  const { data: order, error } = await admin
    .from("shop_orders")
    .select(
      "oid, product_id, amount, status, customer_type, shipping_type, tracking_available, ems_regino, ems_premium_cd, paid_at, created_at, user_id"
    )
    .eq("oid", oid)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }

  if (order.user_id && order.user_id !== user.id) {
    return NextResponse.json({ error: "본인 주문만 조회할 수 있습니다." }, { status: 403 });
  }

  const regino = order.ems_regino?.trim() ?? null;
  let events: Array<{
    time: string;
    status: string;
    location: string;
    detail: string;
  }> = [];

  if (regino) {
    const emsEvents = await fetchEmsTraceEvents(regino);
    if (emsEvents?.length) {
      events = emsEvents.map((e) => ({
        time: e.processDe,
        status: e.processSttus,
        location: e.nowLc ?? "",
        detail: e.detailDc ?? "",
      }));
    } else {
      const tracked = await trackParcel("kr.epost", regino);
      if (tracked?.events.length) {
        events = tracked.events.map((e) => ({
          time: e.time,
          status: e.statusLabel || e.statusCode,
          location: e.location,
          detail: e.description,
        }));
      }
    }
  }

  const carrierLabel =
    order.ems_premium_cd === "32"
      ? "EMS Premium"
      : order.ems_premium_cd === "14"
        ? "K-Packet"
        : order.ems_premium_cd === "31"
          ? "EMS"
          : order.shipping_type === "intl"
            ? "EMS/K-Packet"
            : order.shipping_type === "domestic"
              ? "국내 택배"
              : null;

  return NextResponse.json({
    order: {
      oid: order.oid,
      productId: order.product_id,
      amount: order.amount,
      status: order.status,
      customerType: order.customer_type,
      shippingType: order.shipping_type,
      trackingAvailable: order.tracking_available,
      paidAt: order.paid_at,
      createdAt: order.created_at,
    },
    tracking: {
      waybillNo: regino,
      carrier: carrierLabel,
      events,
      hasEvents: events.length > 0,
      note:
        "해외배송은 EMS, EMS Premium, K-Packet 등 추적 가능한 배송수단을 사용합니다. 통관 이후 현지 배송 추적 범위는 국가 및 현지 배송사 사정에 따라 일부 차이가 있을 수 있습니다.",
    },
  });
}
