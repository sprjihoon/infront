import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  buildStdPaySignatures,
  getBillingCredentials,
  nextBillingDateFirstOfMonth,
} from "@/lib/inicis/billing";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 발급 준비
   POST /api/inicis/billing/issue

   Body:
   {
     storage_id: string,
     plan_type: string,
     buyername: string,
     buyertel: string,
     buyeremail: string,
   }

   - 빌링 MID(INICIS_BILLING_*, infrontbil) 사용
──────────────────────────────────────────────────────────────── */

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
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
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    storage_id: string;
    plan_type: string;
    buyername: string;
    buyertel: string;
    buyeremail: string;
  };

  const { storage_id, plan_type, buyername, buyertel, buyeremail } = body;
  if (!storage_id || !plan_type || !buyername || !buyertel || !buyeremail) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  const { data: storage, error: sErr } = await supabase
    .from("customer_storages")
    .select("id, user_id")
    .eq("id", storage_id)
    .eq("user_id", user.id)
    .single();

  if (sErr || !storage) {
    return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("storage_recurring_profiles")
    .select("id, status")
    .eq("storage_id", storage_id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "이미 자동결제가 등록되어 있습니다." }, { status: 409 });
  }

  const creds = getBillingCredentials();
  if (!creds) {
    console.error("[billing/issue] INICIS_BILLING_MID / SIGN_KEY 미설정");
    return NextResponse.json(
      { error: "결제 설정 오류: INICIS_BILLING_MID / INICIS_BILLING_SIGN_KEY가 필요합니다." },
      { status: 500 },
    );
  }

  const cleanTel  = buyertel.replace(/[^0-9\-]/g, "");
  const timestamp = Date.now().toString();
  const shortId   = storage_id.replace(/-/g, "").substring(0, 8);
  const oid       = `BILL-${shortId}-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;

  // INIStdPay: price=0 거부 가능 → 최소 금액 표기, billtype=1이면 즉시 청구 없음
  const price = "1000";

  const { signature, verification, mKey } = buildStdPaySignatures(
    oid, price, timestamp, creds.signKey,
  );

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr").trim();

  await supabase.from("storage_recurring_profiles").upsert({
    user_id:           user.id,
    storage_id,
    pg_bill_key:       `PENDING:${oid}`,
    pg_provider:       "kg_inicis",
    monthly_amount:    0,
    plan_type,
    billing_day:       1,
    next_billing_date: nextBillingDateFirstOfMonth(),
    status:            "PAUSED",
  }, { onConflict: "storage_id,status" });

  return NextResponse.json({
    mid: creds.mid,
    oid,
    price,
    timestamp,
    signature,
    verification,
    mKey,
    goodname:   "인프론트 장기보관 자동결제 등록",
    buyername,
    buyertel:   cleanTel,
    buyeremail,
    billtype:   "1",
    gopaymethod: "Card",
    returnUrl:  `${appUrl}/api/inicis/billing/issue-return`,
    closeUrl:   `${appUrl}/storage/billing/fail?reason=close`,
    custom_data: JSON.stringify({ storage_id, plan_type, user_id: user.id }),
    jsUrl: creds.jsUrl,
  });
}
