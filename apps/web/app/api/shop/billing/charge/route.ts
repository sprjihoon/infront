import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  callRebill,
  getBillingCredentials,
  nextBillingDateFirstOfMonth,
} from "@/lib/inicis/billing";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 결제 실행 (샵 구독 청구)
   POST /api/shop/billing/charge

   Body: { sub_id: string }
   - 로그인 필요 (본인 구독만 청구 가능)
   - INIAPI Rebill 호출 (빌링 MID: infrontbil)
──────────────────────────────────────────────────────────────── */

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { sub_id } = await request.json() as { sub_id: string };
  if (!sub_id) {
    return NextResponse.json({ error: "sub_id 필수" }, { status: 400 });
  }

  const creds = getBillingCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "빌링 MID가 설정되지 않았습니다. 관리자에게 문의하세요." },
      { status: 500 },
    );
  }
  if (!creds.iniapiKey || !creds.iniapiIv) {
    return NextResponse.json(
      { error: "빌링 INIAPI KEY/IV가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const db = adminDb();

  const { data: sub, error: subErr } = await db
    .from("shop_subscriptions")
    .select("id, user_id, pg_bill_key, plan_name, monthly_amount, status, fail_count")
    .eq("id", sub_id)
    .eq("user_id", user.id)
    .single();

  if (subErr || !sub) {
    return NextResponse.json({ error: "구독 정보를 찾을 수 없습니다." }, { status: 404 });
  }
  if (sub.status !== "ACTIVE") {
    return NextResponse.json({ error: "활성 구독이 아닙니다." }, { status: 400 });
  }

  const billKey = sub.pg_bill_key as string;
  if (!billKey) {
    return NextResponse.json({ error: "빌링키가 없습니다." }, { status: 400 });
  }

  const amount   = sub.monthly_amount as number;
  const msg      = `인프론트 ${sub.plan_name} 월 구독료`;
  const priceStr = String(amount);
  const oid      = `SBRB-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  let result;
  try {
    result = await callRebill({
      mid: creds.mid,
      billKey,
      msg,
      price: priceStr,
      iniapiKey: creds.iniapiKey,
      iniapiIv: creds.iniapiIv,
    });
  } catch (e) {
    console.error("[shop/billing/charge] signData error:", e);
    return NextResponse.json({ error: "결제 서명 생성 실패" }, { status: 500 });
  }

  if (!result.ok) {
    console.error("[shop/billing/charge] rebill failed:", result.resultCode, result.resultMsg);
    const prevFail = Number(sub.fail_count ?? 0);
    await db.from("shop_subscriptions").update({
      fail_count:       prevFail + 1,
      last_fail_at:     new Date().toISOString(),
      last_fail_reason: `[${result.resultCode}] ${result.resultMsg}`,
      updated_at:       new Date().toISOString(),
    }).eq("id", sub_id);
    return NextResponse.json({ error: result.resultMsg, code: result.resultCode }, { status: 400 });
  }

  await db.from("shop_subscriptions").update({
    last_paid_at:      new Date().toISOString(),
    next_billing_date: nextBillingDateFirstOfMonth(),
    fail_count:        0,
    last_fail_at:      null,
    last_fail_reason:  null,
    updated_at:        new Date().toISOString(),
  }).eq("id", sub_id);

  console.log("[shop/billing/charge] success:", oid, result.tid);
  return NextResponse.json({ ok: true, oid, tid: result.tid, resultCode: result.resultCode, amount });
}
