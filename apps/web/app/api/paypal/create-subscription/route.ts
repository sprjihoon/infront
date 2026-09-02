import { NextRequest, NextResponse } from "next/server";
import { getShopAuthUser } from "@/lib/shop/auth";
import { assertForeignPaypalUser } from "@/lib/shop/foreign-pay";
import { getShopProduct } from "@/lib/shop/products";
import { createPaypalMonthlyPlan, paypalConfigured } from "@/lib/paypal/client";
import { krwToUsd, usdValueString } from "@/lib/paypal/fx";
import { getEmsUsdKrwRate, getEmsUsdKrwRateNumber } from "@/lib/ems/exchange-rate-store";
import { nextBillingDateFirstOfMonth } from "@/lib/inicis/billing";
import { paypalAdminDb } from "@/lib/paypal/mark-paid";
import { createClient } from "@/lib/supabase/server";

const SHOP_PLANS: Record<string, { name: string; amount: number }> = {
  MEMBERSHIP_BASIC: { name: "Infront Basic Membership", amount: 9900 },
  STORAGE_BASIC: { name: "Infront Basic Membership", amount: 9900 },
};

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
      planId?: string;
      storage_id?: string;
      monthly_amount?: number;
      plan_type?: string;
    };

    const db = paypalAdminDb();
    if (!db) return NextResponse.json({ error: "DB 설정 오류" }, { status: 500 });

    const rateInfo = await getEmsUsdKrwRate(db);
    const fxRate = getEmsUsdKrwRateNumber(rateInfo);
    const fxLockedAt = new Date().toISOString();

    if ((body.kind ?? "shop") === "storage") {
      if (!body.storage_id || !(body.monthly_amount && body.monthly_amount > 0)) {
        return NextResponse.json({ error: "storage_id / monthly_amount 필수" }, { status: 400 });
      }
      const supabase = await createClient();
      const { data: storage } = await supabase
        .from("customer_storages")
        .select("id")
        .eq("id", body.storage_id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (!storage) {
        return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
      }

      const amountUsd = krwToUsd(body.monthly_amount, fxRate);
      const { planId } = await createPaypalMonthlyPlan({
        name: `Infront storage ${body.plan_type ?? "monthly"}`,
        description: "Long-term storage monthly fee",
        amountUsd: usdValueString(amountUsd),
      });

      const { data: profile, error } = await db.from("storage_recurring_profiles").insert({
        user_id: user!.id,
        storage_id: body.storage_id,
        pg_bill_key: null,
        pg_provider: "paypal",
        monthly_amount: body.monthly_amount,
        plan_type: body.plan_type ?? null,
        billing_day: 1,
        next_billing_date: nextBillingDateFirstOfMonth(),
        status: "PAUSED",
        paypal_plan_id: planId,
        currency: "USD",
        amount_fx: amountUsd,
        fx_rate: fxRate,
        fx_locked_at: fxLockedAt,
      }).select("id").single();
      if (error || !profile) {
        console.error("[paypal/create-subscription] storage profile:", error?.message);
        return NextResponse.json({ error: "구독 프로파일 생성 실패" }, { status: 500 });
      }

      return NextResponse.json({
        planId,
        profileId: profile.id,
        amountKrw: body.monthly_amount,
        amountUsd,
        fxRate,
        kind: "storage",
      });
    }

    const planId = body.planId ?? "MEMBERSHIP_BASIC";
    const plan = SHOP_PLANS[planId] ?? (getShopProduct(planId)?.billingType === "recurring"
      ? { name: getShopProduct(planId)!.nameEn, amount: getShopProduct(planId)!.price }
      : null);
    if (!plan) {
      return NextResponse.json({ error: "유효하지 않은 멤버십입니다." }, { status: 400 });
    }

    const amountUsd = krwToUsd(plan.amount, fxRate);
    const paypalPlan = await createPaypalMonthlyPlan({
      name: plan.name,
      description: "Infront membership monthly billing",
      amountUsd: usdValueString(amountUsd),
    });

    const { data: sub, error } = await db.from("shop_subscriptions").insert({
      user_id: user!.id,
      plan_id: planId,
      plan_name: plan.name,
      monthly_amount: plan.amount,
      pg_provider: "paypal",
      status: "PENDING",
      next_billing_date: nextBillingDateFirstOfMonth(),
      paypal_plan_id: paypalPlan.planId,
      currency: "USD",
      amount_fx: amountUsd,
      fx_rate: fxRate,
      fx_locked_at: fxLockedAt,
    }).select("id").single();
    if (error || !sub) {
      console.error("[paypal/create-subscription] shop insert:", error?.message);
      return NextResponse.json({ error: "구독 생성 실패" }, { status: 500 });
    }

    return NextResponse.json({
      planId: paypalPlan.planId,
      subId: sub.id,
      amountKrw: plan.amount,
      amountUsd,
      fxRate,
      kind: "shop",
    });
  } catch (e) {
    console.error("[paypal/create-subscription]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "서버 오류" },
      { status: 500 },
    );
  }
}
