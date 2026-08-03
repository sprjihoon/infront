import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  callRebill,
  getBillingCredentials,
  nextBillingDateFirstOfMonth,
} from "@/lib/inicis/billing";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 결제 실행 (INIAPI Rebill)
   POST /api/inicis/billing/pay

   Body: { recurring_id?: string, storage_id?: string, amount?: number, msg?: string }
   Auth: Authorization Bearer CRON_SECRET 또는 (내부 서버 호출)
──────────────────────────────────────────────────────────────── */

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function authorize(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json() as {
      recurring_id?: string;
      storage_id?:   string;
      amount?:       number;
      msg?:          string;
    };

    const creds = getBillingCredentials();
    if (!creds?.iniapiKey || !creds.iniapiIv) {
      console.error("[billing/pay] 빌링 환경변수 누락");
      return NextResponse.json({ error: "결제 설정 오류" }, { status: 500 });
    }

    const db = adminDb();

    let profileQuery = db
      .from("storage_recurring_profiles")
      .select("id, user_id, storage_id, pg_bill_key, monthly_amount, plan_type, next_billing_date, fail_count")
      .eq("status", "ACTIVE");

    if (body.recurring_id) {
      profileQuery = profileQuery.eq("id", body.recurring_id);
    } else if (body.storage_id) {
      profileQuery = profileQuery.eq("storage_id", body.storage_id);
    } else {
      return NextResponse.json({ error: "recurring_id 또는 storage_id 필수" }, { status: 400 });
    }

    const { data: profile, error: pErr } = await profileQuery.single();
    if (pErr || !profile) {
      return NextResponse.json({ error: "활성 자동결제 프로파일을 찾을 수 없습니다." }, { status: 404 });
    }

    const billKey = profile.pg_bill_key as string;
    if (!billKey || billKey.startsWith("PENDING:")) {
      return NextResponse.json({ error: "유효한 빌링키가 없습니다." }, { status: 400 });
    }

    const amount    = body.amount ?? Number(profile.monthly_amount);
    const msg       = body.msg ?? `인프론트 장기보관 월정액 (${profile.plan_type})`;
    const priceStr  = String(amount);

    const shortId = (profile.storage_id as string).replace(/-/g, "").substring(0, 8);
    const oid     = `RBILL-${shortId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

    const { data: payment, error: insertErr } = await db
      .from("storage_payments")
      .insert({
        user_id:      profile.user_id,
        storage_id:   profile.storage_id,
        payment_type: "LONG_TERM_MONTHLY",
        amount,
        status:       "PENDING",
        pg_provider:  "kg_inicis",
        pg_oid:       oid,
        billing_memo: msg,
        billing_plan_type: profile.plan_type,
      })
      .select("id")
      .single();

    if (insertErr || !payment) {
      console.error("[billing/pay] insert payment:", insertErr);
      return NextResponse.json({ error: "결제 레코드 생성 실패" }, { status: 500 });
    }

    const result = await callRebill({
      mid: creds.mid,
      billKey,
      msg,
      price: priceStr,
      iniapiKey: creds.iniapiKey,
      iniapiIv: creds.iniapiIv,
    });

    if (!result.ok) {
      console.error("[billing/pay] rebill failed:", result.resultCode, result.resultMsg);
      await db.from("storage_payments").update({
        status:      "FAILED",
        fail_reason: `[${result.resultCode}] ${result.resultMsg}`,
      }).eq("id", payment.id);

      const prevFail = Number(profile.fail_count ?? 0);
      await db.from("storage_recurring_profiles").update({
        status:           "PAUSED",
        fail_count:       prevFail + 1,
        last_fail_at:     new Date().toISOString(),
        last_fail_reason: `[${result.resultCode}] ${result.resultMsg}`,
        updated_at:       new Date().toISOString(),
      }).eq("id", profile.id);

      return NextResponse.json({ error: result.resultMsg, code: result.resultCode }, { status: 400 });
    }

    const now = new Date().toISOString();
    await db.from("storage_payments").update({
      status:      "PAID",
      pg_tid:      result.tid,
      approved_at: now,
    }).eq("id", payment.id);

    await db.from("storage_recurring_profiles").update({
      last_billing_date: new Date().toISOString().split("T")[0],
      next_billing_date: nextBillingDateFirstOfMonth(),
      fail_count:        0,
      status:            "ACTIVE",
      updated_at:        now,
    }).eq("id", profile.id);

    console.log("[billing/pay] success:", oid, result.tid);
    return NextResponse.json({ ok: true, oid, tid: result.tid, resultCode: result.resultCode, amount });

  } catch (e) {
    console.error("[billing/pay] error:", e);
    return NextResponse.json({ error: "자동결제 처리 오류" }, { status: 500 });
  }
}
