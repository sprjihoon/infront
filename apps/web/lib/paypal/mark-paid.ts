import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { markBoxRequestPaid } from "@/lib/storage/mark-box-paid";

export function paypalAdminDb(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function markShopOrderPaid(
  db: SupabaseClient,
  paypalOrderId: string,
  captureId?: string,
): Promise<{ oid: string; amount: number } | null> {
  const { data: order } = await db
    .from("shop_orders")
    .select("id, oid, amount, status")
    .eq("paypal_order_id", paypalOrderId)
    .maybeSingle();
  if (!order) return null;
  if (order.status === "PAID") return { oid: order.oid, amount: order.amount };
  await db
    .from("shop_orders")
    .update({
      status: "PAID",
      paypal_capture_id: captureId ?? null,
      paid_at: new Date().toISOString(),
    })
    .eq("id", order.id)
    .eq("status", "PENDING_PAYMENT");
  return { oid: order.oid, amount: order.amount };
}

export async function markStoragePaymentPaid(
  db: SupabaseClient,
  paypalOrderId: string,
  captureId?: string,
): Promise<{ oid: string; amount: number; storageId: string | null } | null> {
  const { data: payment } = await db
    .from("storage_payments")
    .select("id, pg_oid, amount, status, storage_id, billing_memo")
    .eq("paypal_order_id", paypalOrderId)
    .maybeSingle();
  if (!payment) return null;
  if (payment.status === "PAID") {
    await markBoxRequestPaid(db, payment.billing_memo, payment.pg_oid ?? paypalOrderId);
    return { oid: payment.pg_oid ?? paypalOrderId, amount: Number(payment.amount), storageId: payment.storage_id };
  }
  await db
    .from("storage_payments")
    .update({
      status: "PAID",
      paypal_capture_id: captureId ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq("id", payment.id)
    .eq("status", "PENDING");
  await markBoxRequestPaid(db, payment.billing_memo, payment.pg_oid ?? paypalOrderId);
  return {
    oid: payment.pg_oid ?? paypalOrderId,
    amount: Number(payment.amount),
    storageId: payment.storage_id,
  };
}
