import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  callRebill,
  getBillingCredentials,
  nextBillingDateFirstOfMonth,
} from "@/lib/inicis/billing";

/* ────────────────────────────────────────────────────────────────
   GET /api/cron/shop-billing
   활성 샵 구독 중 next_billing_date <= today 인 건 Rebill
──────────────────────────────────────────────────────────────── */

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function todayYmd(): string {
  return new Date().toISOString().split("T")[0]!;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const creds = getBillingCredentials();
  if (!creds?.iniapiKey || !creds.iniapiIv) {
    return NextResponse.json({ error: "빌링 환경변수 미설정" }, { status: 500 });
  }

  const db = adminDb();
  const today = todayYmd();

  const { data: subs, error } = await db
    .from("shop_subscriptions")
    .select("id, pg_bill_key, plan_name, monthly_amount, fail_count")
    .eq("status", "ACTIVE")
    .lte("next_billing_date", today)
    .not("pg_bill_key", "is", null)
    .limit(100);

  if (error) {
    console.error("[cron/shop-billing] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const sub of subs ?? []) {
    const billKey = sub.pg_bill_key as string;
    const amount = Number(sub.monthly_amount);
    const msg = `인프론트 ${sub.plan_name} 월 구독료`;
    const oid = `SBRB-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

    try {
      const result = await callRebill({
        mid: creds.mid,
        billKey,
        msg,
        price: String(amount),
        iniapiKey: creds.iniapiKey,
        iniapiIv: creds.iniapiIv,
      });

      if (!result.ok) {
        const prevFail = Number(sub.fail_count ?? 0);
        await db.from("shop_subscriptions").update({
          fail_count:       prevFail + 1,
          last_fail_at:     new Date().toISOString(),
          last_fail_reason: `[${result.resultCode}] ${result.resultMsg}`,
          updated_at:       new Date().toISOString(),
        }).eq("id", sub.id);
        results.push({ id: sub.id, ok: false, error: result.resultMsg });
        continue;
      }

      await db.from("shop_subscriptions").update({
        last_paid_at:      new Date().toISOString(),
        next_billing_date: nextBillingDateFirstOfMonth(),
        fail_count:        0,
        last_fail_at:      null,
        last_fail_reason:  null,
        updated_at:        new Date().toISOString(),
      }).eq("id", sub.id);

      console.log("[cron/shop-billing] charged:", oid, result.tid);
      results.push({ id: sub.id, ok: true });
    } catch (e) {
      console.error("[cron/shop-billing] error:", sub.id, e);
      results.push({ id: sub.id, ok: false, error: String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    processed: results.length,
    success: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
