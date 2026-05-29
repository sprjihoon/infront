import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

// 최신 컬럼부터 시도, 없으면 순차 폴백 — duty_prepaid 등 선택 컬럼은 뒤로
const ORDER_SELECTS = [
  // FULL: 모든 선택 컬럼 포함
  `id, order_no, status, shipping_method, packaging_type,
   packaging_fee, shipping_fee, extra_fee, total_amount, payment_status,
   recipient_name, recipient_phone, recipient_address, recipient_country,
   recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip, recipient_email,
   customs_value, insurance_enabled, insurance_amount,
   duty_prepaid, duty_deposit_krw, duty_estimate_usd, duty_paid_krw,
   item_list, intl_tracking_no,
   intl_tracking_status, intl_tracking_last_event, intl_tracking_events,
   intl_tracking_synced_at, delivered_at,
   actual_weight, chargeable_weight,
   created_at, updated_at, customer_id,
   order_parcels (parcel_id, parcels (id, tracking_no, sender_name, status, pre_invoice_items)),
   shipping_boxes (id, box_seq, intl_tracking_no, carrier, status, weight_kg)`,

  // MID: extra_fee, duty_paid_krw, actual/chargeable_weight 제외
  `id, order_no, status, shipping_method, packaging_type,
   packaging_fee, shipping_fee, total_amount, payment_status,
   recipient_name, recipient_phone, recipient_address, recipient_country,
   recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip, recipient_email,
   customs_value, insurance_enabled, insurance_amount,
   duty_prepaid, duty_deposit_krw, duty_estimate_usd,
   item_list, intl_tracking_no,
   intl_tracking_status, intl_tracking_last_event, intl_tracking_events,
   intl_tracking_synced_at, delivered_at,
   created_at, updated_at, customer_id,
   order_parcels (parcel_id, parcels (id, tracking_no, sender_name, status, pre_invoice_items)),
   shipping_boxes (id, box_seq, intl_tracking_no, carrier, status, weight_kg)`,

  // SLIM: duty_* / insurance_* / tracking 세부 제외
  `id, order_no, status, shipping_method, packaging_type,
   packaging_fee, shipping_fee, total_amount, payment_status,
   recipient_name, recipient_phone, recipient_address, recipient_country,
   recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip, recipient_email,
   customs_value, item_list, intl_tracking_no,
   intl_tracking_status, intl_tracking_last_event, delivered_at,
   created_at, updated_at, customer_id,
   order_parcels (parcel_id, parcels (id, tracking_no, sender_name, status, pre_invoice_items)),
   shipping_boxes (id, box_seq, intl_tracking_no, carrier, status, weight_kg)`,

  // CORE: shipping_boxes 제외
  `id, order_no, status, shipping_method, packaging_type,
   packaging_fee, shipping_fee, total_amount, payment_status,
   recipient_name, recipient_phone, recipient_address, recipient_country,
   recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip, recipient_email,
   customs_value, item_list, intl_tracking_no,
   intl_tracking_status, intl_tracking_last_event, delivered_at,
   created_at, updated_at, customer_id,
   order_parcels (parcel_id, parcels (id, tracking_no, sender_name, status, pre_invoice_items))`,

  // MIN: 조인 없이 orders 단독, 절대 존재하는 컬럼만
  `id, order_no, status, shipping_method, packaging_type,
   packaging_fee, shipping_fee, total_amount, payment_status,
   recipient_name, recipient_phone, recipient_address, recipient_country,
   customs_value, item_list, intl_tracking_no,
   intl_tracking_status, delivered_at, created_at, updated_at, customer_id`,
];

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const admin = createAdminSupabase();
    let orderRow: Record<string, unknown> | null = null;

    for (const sel of ORDER_SELECTS) {
      const { data, error } = await admin
        .from("orders")
        .select(sel)
        .eq("id", orderId)
        .maybeSingle();
      if (!error) {
        orderRow = data as Record<string, unknown> | null;
        break;
      }
      console.warn("[ORDER DETAIL] select fallback:", (error as { message?: string }).message);
    }

    if (!orderRow) {
      return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
    }

    if (String(orderRow.customer_id) !== String(user.id)) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    // order_parcels / shipping_boxes 조인 없는 폴백 시 별도 조회
    if (!Array.isArray(orderRow.order_parcels)) {
      const { data } = await admin
        .from("order_parcels")
        .select("parcel_id, parcels (id, tracking_no, sender_name, status, pre_invoice_items)")
        .eq("order_id", orderId);
      orderRow.order_parcels = data ?? [];
    }
    if (!Array.isArray(orderRow.shipping_boxes)) {
      const { data } = await admin
        .from("shipping_boxes")
        .select("id, box_seq, intl_tracking_no, carrier, status, weight_kg")
        .eq("order_id", orderId);
      orderRow.shipping_boxes = data ?? [];
    }

    return NextResponse.json({ order: orderRow });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[ORDER DETAIL]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
