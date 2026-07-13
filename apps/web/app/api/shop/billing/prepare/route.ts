import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 발급 준비 (샵 구독용)
   POST /api/shop/billing/prepare

   Body: { buyername, buyertel, buyeremail, planId? }
   Returns: INIStdPay.pay() 호출에 필요한 폼 파라미터

   - 별도 빌링 MID(INICIS_BILLING_MID) 사용
   - 미설정 시 테스트 MID(INIpayTest) + 스테이징 URL 사용
──────────────────────────────────────────────────────────────── */

const PLANS: Record<string, { name: string; amount: number }> = {
  STORAGE_BASIC: { name: "인프론트 보관함 기본 구독", amount: 9900 },
};

function sha256hex(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

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

  const { buyername, buyertel, buyeremail, planId = "STORAGE_BASIC" } = body;
  if (!buyername || !buyertel || !buyeremail) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const plan = PLANS[planId];
  if (!plan) {
    return NextResponse.json({ error: "유효하지 않은 플랜입니다." }, { status: 400 });
  }

  /* 빌링 MID 설정 — INICIS_BILLING_MID 미설정 시 테스트 MID */
  const forceTest = !process.env.INICIS_BILLING_MID?.trim();
  const mid     = forceTest ? "INIpayTest" : process.env.INICIS_BILLING_MID!.trim();
  const signKey = forceTest
    ? "SU5JTElURV9UUklQTEVERVNfS0VZU1JS"
    : (process.env.INICIS_BILLING_SIGN_KEY ?? "").trim();

  const cleanTel  = buyertel.replace(/[^0-9\-]/g, "");
  const timestamp = Date.now().toString();
  const oid       = `SBBILL-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
  const price     = "0"; // 빌링키 발급은 0원

  const signature    = sha256hex(`oid=${oid}&price=${price}&timestamp=${timestamp}`);
  const verification = sha256hex(`oid=${oid}&price=${price}&signKey=${signKey}&timestamp=${timestamp}`);
  const mKey         = sha256hex(signKey);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr").trim();

  /* 구독 레코드 생성 (PENDING 상태) */
  const db = adminDb();
  const { data: sub } = await db.from("shop_subscriptions").insert({
    user_id:        user.id,
    plan_id:        planId,
    plan_name:      plan.name,
    monthly_amount: plan.amount,
    pg_oid:         oid,
    pg_provider:    "kg_inicis",
    status:         "PENDING",
  }).select("id").single();

  const subId = sub?.id ?? "";

  return NextResponse.json({
    mid,
    oid,
    price,
    timestamp,
    signature,
    verification,
    mKey,
    goodname:    plan.name,
    buyername,
    buyertel:   cleanTel,
    buyeremail,
    billtype:   "1",
    gopaymethod: "Card",
    returnUrl:  `${appUrl}/api/shop/billing/callback`,
    closeUrl:   `${appUrl}/shop/billing/fail?reason=close`,
    custom_data: JSON.stringify({ sub_id: subId, user_id: user.id }),
    jsUrl: forceTest
      ? "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
      : "https://stdpay.inicis.com/stdjs/INIStdPay.js",
  });
}
