import { NextRequest, NextResponse } from "next/server";
import { getShopAuthUser } from "@/lib/shop/auth";
import { assertForeignPaypalUser } from "@/lib/shop/foreign-pay";
import { paypalAdminDb } from "@/lib/paypal/mark-paid";

export async function POST(request: NextRequest) {
  const user = await getShopAuthUser();
  const gate = assertForeignPaypalUser(user);
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await request.json() as {
    kind?: "shop" | "storage";
    subscriptionId?: string;
    subId?: string;
    profileId?: string;
  };
  if (!body.subscriptionId) {
    return NextResponse.json({ error: "subscriptionId 필수" }, { status: 400 });
  }

  const db = paypalAdminDb();
  if (!db) return NextResponse.json({ error: "DB 설정 오류" }, { status: 500 });

  if (body.kind === "storage") {
    if (!body.profileId) {
      return NextResponse.json({ error: "profileId 필수" }, { status: 400 });
    }
    const { error } = await db
      .from("storage_recurring_profiles")
      .update({
        paypal_subscription_id: body.subscriptionId,
        status: "ACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("id", body.profileId)
      .eq("user_id", user!.id);
    if (error) {
      console.error("[paypal/activate-subscription] storage:", error.message);
      return NextResponse.json({ error: "구독 활성화 실패" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, kind: "storage" });
  }

  if (!body.subId) {
    return NextResponse.json({ error: "subId 필수" }, { status: 400 });
  }
  const { error } = await db
    .from("shop_subscriptions")
    .update({
      paypal_subscription_id: body.subscriptionId,
      status: "ACTIVE",
      last_paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.subId)
    .eq("user_id", user!.id);
  if (error) {
    console.error("[paypal/activate-subscription] shop:", error.message);
    return NextResponse.json({ error: "구독 활성화 실패" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, kind: "shop" });
}
