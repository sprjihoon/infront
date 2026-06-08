import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

/* ────────────────────────────────────────────────────────────────
   스토리지 결제 준비 엔드포인트
   - 결제 유형: PICKUP_FEE(수거비) | SHORT_TERM_STORAGE(단기보관 정산)
   - 새 storage_payments 레코드 생성 → KG Inicis 서명 파라미터 반환
   - OID 포맷: STG-{storageId(8자)}-{timestamp}-{randomHex}
──────────────────────────────────────────────────────────────── */

const TEST_MID = "INIpayTest";
const TEST_SIGN_KEY = "SU5JTElURV9UUklQTEVERVNfS0VZU1JS";

function sha256hex(str: string) {
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
    payment_type: "PICKUP_FEE" | "SHORT_TERM_STORAGE" | "RELEASE_FEE";
    buyername: string;
    buyertel: string;
    buyeremail: string;
    /** SHORT_TERM_STORAGE 정산 시만 사용 */
    billing_weeks?: number;
    billing_plan_type?: string;
  };

  const { storage_id, payment_type, buyername, buyertel, buyeremail } = body;
  if (!storage_id || !payment_type || !buyername || !buyertel || !buyeremail) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  /* ── 스토리지 소유권 및 플랜 확인 ── */
  const { data: storage, error: sErr } = await supabase
    .from("customer_storages")
    .select(`
      id, user_id, storage_mode, plan_type, max_plan_type,
      short_term_started_at,
      storage_plan_config!plan_type (weekly_rate)
    `)
    .eq("id", storage_id)
    .eq("user_id", user.id)
    .single();

  if (sErr || !storage) {
    return NextResponse.json({ error: "스토리지를 찾을 수 없습니다." }, { status: 404 });
  }

  /* ── 결제 금액 계산 ── */
  let amount = 0;
  let goodname = "";
  let billing_memo: string | null = null;
  let billing_weeks: number | null = null;
  let billing_plan_type: string | null = null;

  if (payment_type === "PICKUP_FEE") {
    amount = 3000;
    goodname = "인프론트 보관 서비스 수거비";
    billing_memo = "수거비 3,000원";

  } else if (payment_type === "RELEASE_FEE") {
    amount = 1000;
    goodname = "인프론트 보관 서비스 출고 처리비";
    billing_memo = "출고 처리비 1,000원";

  } else if (payment_type === "SHORT_TERM_STORAGE") {
    /* 단기보관 정산: weeks × weekly_rate(max_plan_type 기준) */
    billing_weeks = body.billing_weeks ?? null;
    billing_plan_type = body.billing_plan_type ?? (storage.max_plan_type as string | null);

    if (!billing_weeks || billing_weeks <= 0) {
      return NextResponse.json({ error: "보관 기간(주)이 올바르지 않습니다." }, { status: 400 });
    }
    if (!billing_plan_type) {
      return NextResponse.json({ error: "과금 플랜을 확인할 수 없습니다." }, { status: 400 });
    }

    /* 플랜별 주간 요금 조회 */
    const { data: planData } = await supabase
      .from("storage_plan_config")
      .select("weekly_rate, label_ko")
      .eq("plan_type", billing_plan_type)
      .single();

    if (!planData?.weekly_rate) {
      return NextResponse.json({ error: "플랜 요금 정보를 찾을 수 없습니다." }, { status: 400 });
    }

    amount = billing_weeks * planData.weekly_rate;
    goodname = `인프론트 단기보관 정산 (${billing_plan_type}플랜 ${billing_weeks}주)`;
    billing_memo = `${billing_weeks}주 × ${planData.label_ko} ${planData.weekly_rate.toLocaleString()}원`;

  } else {
    return NextResponse.json({ error: "지원하지 않는 결제 유형입니다." }, { status: 400 });
  }

  /* buyertel 정제 */
  const cleanTel = buyertel.replace(/[^0-9\-]/g, "");
  if (!cleanTel) {
    return NextResponse.json({ error: "연락처를 올바르게 입력해 주세요." }, { status: 400 });
  }

  /* ── storage_payments 레코드 생성 ── */
  const mid = process.env.INICIS_MID ?? TEST_MID;
  const signKey = process.env.INICIS_SIGN_KEY ?? TEST_SIGN_KEY;
  const isTest = !process.env.INICIS_MID;

  const timestamp = Date.now().toString();
  /* OID에 storageId 앞 8자리 포함 → 콜백에서 파싱 */
  const shortId = storage_id.replace(/-/g, "").substring(0, 8);
  const oid = `STG-${shortId}-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
  const priceStr = String(amount);

  const { data: payment, error: pErr } = await supabase
    .from("storage_payments")
    .insert({
      user_id: user.id,
      storage_id,
      payment_type,
      amount,
      status: "PENDING",
      pg_provider: "kg_inicis",
      pg_oid: oid,
      billing_weeks,
      billing_plan_type,
      billing_memo,
    })
    .select("id")
    .single();

  if (pErr || !payment) {
    console.error("[storage/pay/prepare] insert payment:", pErr);
    return NextResponse.json({ error: "결제 레코드 생성 실패" }, { status: 500 });
  }

  /* ── KG Inicis 서명 계산 ── */
  const signature = sha256hex(`oid=${oid}&price=${priceStr}&timestamp=${timestamp}`);
  const verification = sha256hex(`oid=${oid}&price=${priceStr}&signKey=${signKey}&timestamp=${timestamp}`);
  const mKey = sha256hex(signKey);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr";

  return NextResponse.json({
    mid,
    oid,
    price: priceStr,
    timestamp,
    signature,
    verification,
    mKey,
    goodname,
    buyername,
    buyertel: cleanTel,
    buyeremail,
    returnUrl: `${appUrl}/api/inicis/storage-return`,
    closeUrl: `${appUrl}/storage/payment/fail?reason=close`,
    jsUrl: isTest
      ? "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
      : "https://stdpay.inicis.com/stdjs/INIStdPay.js",
  });
}
