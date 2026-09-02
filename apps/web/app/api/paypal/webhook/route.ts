import { NextRequest, NextResponse } from "next/server";
import { verifyPaypalWebhook } from "@/lib/paypal/client";
import { markShopOrderPaid, markStoragePaymentPaid, paypalAdminDb } from "@/lib/paypal/mark-paid";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  try {
    const valid = await verifyPaypalWebhook(request.headers, raw);
    if (!valid) {
      console.error("[paypal/webhook] signature mismatch");
      return NextResponse.json({ error: "invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(raw) as {
      event_type?: string;
      resource?: {
        id?: string;
        status?: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
        billing_info?: { last_payment?: { amount?: { value?: string } } };
        custom_id?: string;
      };
    };

    const db = paypalAdminDb();
    if (!db) return NextResponse.json({ error: "db" }, { status: 500 });

    const type = event.event_type ?? "";
    const resource = event.resource ?? {};

    if (type === "PAYMENT.CAPTURE.COMPLETED") {
      const orderId = resource.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        await markShopOrderPaid(db, orderId, resource.id);
        await markStoragePaymentPaid(db, orderId, resource.id);
      }
    }

    if (type === "BILLING.SUBSCRIPTION.ACTIVATED" && resource.id) {
      await db
        .from("shop_subscriptions")
        .update({
          status: "ACTIVE",
          paypal_subscription_id: resource.id,
          last_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("paypal_subscription_id", resource.id);

      await db
        .from("storage_recurring_profiles")
        .update({
          status: "ACTIVE",
          paypal_subscription_id: resource.id,
          last_billing_date: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        })
        .eq("paypal_subscription_id", resource.id);
    }

    if (type === "BILLING.SUBSCRIPTION.CANCELLED" && resource.id) {
      await db
        .from("shop_subscriptions")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("paypal_subscription_id", resource.id);
      await db
        .from("storage_recurring_profiles")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("paypal_subscription_id", resource.id);
    }

    if (type === "BILLING.SUBSCRIPTION.PAYMENT.FAILED" && resource.id) {
      const now = new Date().toISOString();
      await db
        .from("shop_subscriptions")
        .update({
          fail_count: 1,
          last_fail_at: now,
          last_fail_reason: "PayPal payment failed",
          updated_at: now,
        })
        .eq("paypal_subscription_id", resource.id);
      await db
        .from("storage_recurring_profiles")
        .update({
          fail_count: 1,
          last_fail_at: now,
          last_fail_reason: "PayPal payment failed",
          status: "PAUSED",
          updated_at: now,
        })
        .eq("paypal_subscription_id", resource.id);
    }

    if (type === "PAYMENT.SALE.COMPLETED" && resource.id) {
      await db
        .from("shop_subscriptions")
        .update({ last_paid_at: new Date().toISOString(), fail_count: 0, updated_at: new Date().toISOString() })
        .eq("paypal_subscription_id", resource.custom_id ?? "");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[paypal/webhook]", e);
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}
