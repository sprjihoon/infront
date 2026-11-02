import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { getShopAuthUser } from "@/lib/shop/auth";
import { assertForeignPaypalUser } from "@/lib/shop/foreign-pay";
import { validateShopOrderRequest } from "@/lib/shop/prepare-order";
import { createPaypalOrder, paypalConfigured } from "@/lib/paypal/client";
import { krwToUsd, usdValueString } from "@/lib/paypal/fx";
import { getEmsUsdKrwRate, getEmsUsdKrwRateNumber } from "@/lib/ems/exchange-rate-store";
import { quoteStoragePayment, type StoragePayInput } from "@/lib/storage/quote-payment";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function POST(request: NextRequest) {
  try {
    if (!paypalConfigured()) {
      return NextResponse.json({ error: "PayPal이 아직 설정되지 않았습니다." }, { status: 503 });
    }

    const user = await getShopAuthUser();
    const gate = assertForeignPaypalUser(user);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json() as {
      kind?: "shop" | "storage";
      productId?: string;
      buyername?: string;
      buyertel?: string;
      buyeremail?: string;
      paymentMethod?: string;
      sender?: Record<string, string>;
      recipient?: Record<string, string>;
    } & Partial<StoragePayInput>;

    const db = adminDb();
    const rateInfo = await getEmsUsdKrwRate(db);
    const fxRate = getEmsUsdKrwRateNumber(rateInfo);
    const fxLockedAt = new Date().toISOString();

    if ((body.kind ?? "shop") === "storage") {
      if (!body.payment_type || (!body.storage_id && !body.box_request_id)) {
        return NextResponse.json({ error: "storage_id / payment_type 필수" }, { status: 400 });
      }
      const supabase = await createServerSupabase();
      const quoted = await quoteStoragePayment(supabase, user!.id, {
        storage_id: body.storage_id,
        payment_type: body.payment_type,
        pickup_boxes: body.pickup_boxes,
        billing_weeks: body.billing_weeks,
        billing_plan_type: body.billing_plan_type,
        item_count: body.item_count,
        amount: body.amount,
        long_term_plan_type: body.long_term_plan_type,
        box_request_id: body.box_request_id,
      });
      if (!quoted.ok) {
        return NextResponse.json({ error: quoted.error }, { status: quoted.status });
      }

      const amountUsd = krwToUsd(quoted.data.amount, fxRate);
      const timestamp = Date.now().toString();
      const shortId = body.storage_id ? body.storage_id.replace(/-/g, "").slice(0, 8) : "BOX";
      const oid = `STG-PP-${shortId}-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;

      const paypal = await createPaypalOrder({
        oid,
        customId: `storage:${oid}`,
        description: quoted.data.goodname,
        amountUsd: usdValueString(amountUsd),
      });

      const { error: insErr } = await db.from("storage_payments").insert({
        user_id: user!.id,
        storage_id: body.storage_id ?? null,
        payment_type: body.payment_type,
        amount: quoted.data.amount,
        status: "PENDING",
        pg_provider: "paypal",
        pg_oid: oid,
        paypal_order_id: paypal.id,
        currency: "USD",
        amount_fx: amountUsd,
        fx_rate: fxRate,
        fx_locked_at: fxLockedAt,
        billing_weeks: quoted.data.billing_weeks,
        billing_plan_type: quoted.data.billing_plan_type,
        billing_memo: quoted.data.billing_memo,
        item_count: quoted.data.item_count,
      });
      if (insErr) {
        console.error("[paypal/create-order] storage insert:", insErr.message);
        return NextResponse.json({ error: "결제 레코드 생성 실패" }, { status: 500 });
      }

      return NextResponse.json({
        paypalOrderId: paypal.id,
        oid,
        amountKrw: quoted.data.amount,
        amountUsd,
        fxRate,
        currency: "USD",
        kind: "storage",
        monthlyAmount: quoted.data.monthly_amount,
        billingPlanType: quoted.data.billing_plan_type,
        storageId: body.storage_id,
      });
    }

    const validated = await validateShopOrderRequest(
      body.productId,
      body.buyername,
      body.buyertel,
      body.buyeremail,
      "paypal",
    );
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }

    const { product, price, goodname, paymentMethod, paymentMethodCode, paymentItemType, paymentItemKey, shippingType, trackingAvailable } = validated.data;
    const amountUsd = krwToUsd(price, fxRate);
    const timestamp = Date.now().toString();
    const oid = `SHOP-PP-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;

    const paypal = await createPaypalOrder({
      oid,
      customId: `shop:${oid}`,
      description: goodname,
      amountUsd: usdValueString(amountUsd),
    });

    const sender = body.sender ?? {};
    const recipient = body.recipient ?? {};
    const { error: insErr } = await db.from("shop_orders").insert({
      oid,
      product_id: product.id,
      amount: price,
      status: "PENDING_PAYMENT",
      user_id: user!.id,
      customer_type: user!.customerType,
      sender_name: sender.name ?? body.buyername,
      sender_phone: sender.phone ?? body.buyertel,
      sender_zipcode: sender.zipcode ?? null,
      sender_address: sender.address ?? null,
      sender_detail: sender.addressDetail ?? null,
      sender_email: body.buyeremail,
      recipient_name: recipient.name ?? body.buyername,
      recipient_phone: recipient.phone ?? null,
      recipient_zipcode: recipient.zipcode ?? null,
      recipient_address: recipient.address ?? null,
      recipient_detail: recipient.addressDetail ?? null,
      recipient_addr1: recipient.addr1 ?? null,
      recipient_addr2: recipient.addr2 ?? null,
      recipient_addr3: recipient.addr3 ?? null,
      payment_method: paymentMethod,
      payment_method_code: paymentMethodCode,
      is_foreign_card: true,
      payment_item_type: paymentItemType,
      payment_item_key: paymentItemKey,
      shipping_type: shippingType,
      tracking_available: trackingAvailable,
      pg_provider: "paypal",
      paypal_order_id: paypal.id,
      currency: "USD",
      amount_fx: amountUsd,
      fx_rate: fxRate,
      fx_locked_at: fxLockedAt,
    });
    if (insErr) {
      console.error("[paypal/create-order] shop insert:", insErr.message);
      return NextResponse.json({ error: "주문 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({
      paypalOrderId: paypal.id,
      oid,
      amountKrw: price,
      amountUsd,
      fxRate,
      currency: "USD",
      kind: "shop",
    });
  } catch (e) {
    console.error("[paypal/create-order]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 },
    );
  }
}
