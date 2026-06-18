import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 발급 준비
   POST /api/inicis/billing/issue

   Body:
   {
     storage_id: string,        // 어떤 스토리지에 빌링키를 연결할지
     plan_type: string,         // 장기보관 플랜 (monthly_rate 조회)
     buyername: string,
     buyertel: string,
     buyeremail: string,
   }

   Returns: KG이니시스 빌링키 발급 팝업에 필요한 폼 파라미터
   - 클라이언트에서 INIStdPay.pay('frmBillIssue') 호출

   ※ 빌링키 발급 자체는 0원 결제 요청으로 처리됩니다.
──────────────────────────────────────────────────────────────── */

function sha256hex(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

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

  /* 스토리지 소유권 확인 */
  const { data: storage, error: sErr } = await supabase
    .from("customer_storages")
    .select("id, user_id")
    .eq("id", storage_id)
    .eq("user_id", user.id)
    .single();

  if (sErr || !storage) {
    return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
  }

  /* 이미 활성 빌링 프로파일이 있는지 확인 */
  const { data: existing } = await supabase
    .from("storage_recurring_profiles")
    .select("id, status")
    .eq("storage_id", storage_id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "이미 자동결제가 등록되어 있습니다." }, { status: 409 });
  }

  const forceTest = process.env.INICIS_TEST_MODE === "true";
  const mid      = (forceTest ? "INIpayTest" : (process.env.INICIS_MID ?? "INIpayTest")).trim();
  const signKey  = (forceTest ? "SU5JTElURV9UUklQTEVERVNfS0VZU1JS" : (process.env.INICIS_SIGN_KEY ?? "SU5JTElURV9UUklQTEVERVNfS0VZU1JS")).trim();
  const isTest   = forceTest || !process.env.INICIS_MID?.trim();

  const cleanTel  = buyertel.replace(/[^0-9\-]/g, "");
  const timestamp = Date.now().toString();
  const shortId   = storage_id.replace(/-/g, "").substring(0, 8);
  /* 빌링키 발급 OID는 결제 OID와 구분되도록 접두사 다르게 */
  const oid       = `BILL-${shortId}-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;

  /* 빌링키 발급은 price=0 으로 처리 (KG이니시스 스펙) */
  const price     = "0";

  const signature    = sha256hex(`oid=${oid}&price=${price}&timestamp=${timestamp}`);
  const verification = sha256hex(`oid=${oid}&price=${price}&signKey=${signKey}&timestamp=${timestamp}`);
  const mKey         = sha256hex(signKey);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr").trim();

  /* 발급 결과 콜백에서 storage_id, plan_type을 조회할 수 있도록 OID에 메타 저장 */
  /* DB에 발급 요청 미리 기록 (issue-return에서 업데이트) */
  await supabase.from("storage_recurring_profiles").upsert({
    user_id:          user.id,
    storage_id,
    pg_bill_key:      `PENDING:${oid}`,  // 임시값, issue-return에서 실제 빌키로 교체
    pg_provider:      "kg_inicis",
    monthly_amount:   0,                 // issue-return에서 플랜 금액으로 업데이트
    plan_type,
    billing_day:      1,
    next_billing_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split("T")[0],
    status:           "PAUSED",          // 빌키 발급 완료 후 ACTIVE로 전환
  }, { onConflict: "storage_id,status" });

  return NextResponse.json({
    mid,
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
    /* 빌링키 발급용 파라미터 */
    billtype:   "1",          // 1 = 빌링키 발급
    gopaymethod: "Card",      // 카드 전용
    returnUrl:  `${appUrl}/api/inicis/billing/issue-return`,
    closeUrl:   `${appUrl}/storage/billing/fail?reason=close`,
    /* 빌링키 발급 결과 콜백에서 storage_id, plan_type 식별용 */
    custom_data: JSON.stringify({ storage_id, plan_type, user_id: user.id }),
    jsUrl: isTest
      ? "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
      : "https://stdpay.inicis.com/stdjs/INIStdPay.js",
  });
}
