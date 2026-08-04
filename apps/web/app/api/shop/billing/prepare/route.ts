import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {
  buildStdPaySignatures,
  getBillingCredentials,
  nextBillingDateFirstOfMonth,
} from "@/lib/inicis/billing";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 발급 준비 (샵 구독용)
   POST /api/shop/billing/prepare

   Body: { buyername, buyertel, buyeremail, planId? }
   Returns: INIStdPay.pay() 호출에 필요한 폼 파라미터

   - 빌링 MID(INICIS_BILLING_MID, 예: infrontbil) 필수
   - INICIS_TEST_MODE=true 시에만 INIpayTest 스테이징
──────────────────────────────────────────────────────────────── */

const PLANS: Record<string, { name: string; amount: number }> = {
  MEMBERSHIP_BASIC: { name: "인프론트 베이직 멤버십", amount: 9900 },
  /** @deprecated 심사용 구 플랜 ID — MEMBERSHIP_BASIC과 동일 */
  STORAGE_BASIC: { name: "인프론트 베이직 멤버십", amount: 9900 },
};

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

  const body = await request.json() as {
    buyername: string;
    buyertel: string;
    buyeremail: string;
    planId?: string;
  };

  const { buyername, buyertel, buyeremail, planId = "MEMBERSHIP_BASIC" } = body;
  if (!buyername || !buyertel || !buyeremail) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const plan = PLANS[planId];
  if (!plan) {
    return NextResponse.json({ error: "유효하지 않은 플랜입니다." }, { status: 400 });
  }

  const creds = getBillingCredentials();
  if (!creds) {
    console.error("[shop/billing/prepare] INICIS_BILLING_MID / SIGN_KEY 미설정");
    return NextResponse.json(
      { error: "결제 설정 오류: INICIS_BILLING_MID / INICIS_BILLING_SIGN_KEY가 필요합니다." },
      { status: 500 },
    );
  }

  const cleanTel  = buyertel.replace(/[^0-9\-]/g, "");
  const timestamp = Date.now().toString();
  const oid       = `SBBILL-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
  // INIStdPay JS는 price=0을 거부하므로 실제 구독 금액으로 설정
  // billtype=1(빌링키 발급 전용)이므로 실제 즉시 청구는 없음
  const price     = String(plan.amount);

  const { signature, verification, mKey } = buildStdPaySignatures(
    oid, price, timestamp, creds.signKey,
  );

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr").trim();

  const db = adminDb();
  const { data: sub } = await db.from("shop_subscriptions").insert({
    user_id:           user.id,
    plan_id:           planId,
    plan_name:         plan.name,
    monthly_amount:    plan.amount,
    pg_oid:            oid,
    pg_provider:       "kg_inicis",
    status:            "PENDING",
    next_billing_date: nextBillingDateFirstOfMonth(),
  }).select("id").single();

  const subId = sub?.id ?? "";

  const merchantData = JSON.stringify({ sub_id: subId, user_id: user.id });

  return NextResponse.json({
    mid: creds.mid,
    oid,
    price,
    timestamp,
    signature,
    verification,
    mKey,
    goodname: plan.name,
    buyername,
    buyertel: cleanTel,
    buyeremail,
    /** 이니시스 PC 빌링키발급: gopaymethod는 빈값, BILLAUTH(Card)로 카드 등록창 호출 */
    gopaymethod: "",
    billtype: "1",
    offerPeriod: "M2",
    acceptmethod: "centerCd(Y):BILLAUTH(Card)",
    returnUrl: `${appUrl}/api/shop/billing/callback`,
    closeUrl: `${appUrl}/shop/billing/fail?reason=close`,
    custom_data: merchantData,
    merchantData,
    jsUrl: creds.jsUrl,
  });
}
