import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

/* ────────────────────────────────────────────────────────────────
   스토리지 결제 준비 엔드포인트
   - PICKUP_FEE  : DB pickup_box_fees 기반 박스 크기·수량별 수거비 합산
   - SHORT_TERM_STORAGE : 단기보관 정산 (주수 × 주간요금)
   - RELEASE_FEE : 출고 처리비 (고정 1,000원)
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
    payment_type:
      | "PICKUP_FEE"
      | "LISTING_FEE"
      | "PHOTO_INSPECTION_FEE"
      | "SHORT_TERM_STORAGE"
      | "LONG_TERM_FIRST"
      | "UPGRADE_FEE"
      | "RELEASE_FEE"
      | "SHIPPING_FEE"
      | "OPEN_CHECK_FEE"
      | "PENALTY_FEE";
    buyername: string;
    buyertel: string;
    buyeremail: string;
    /** PICKUP_FEE / LONG_TERM_FIRST: 수거할 박스 목록 */
    pickup_boxes?: Array<{ size_code: string; qty: number }>;
    /** SHORT_TERM_STORAGE: 정산 주수 */
    billing_weeks?: number;
    billing_plan_type?: string;
    /** LISTING_FEE / PHOTO_INSPECTION_FEE: 물품 개수 */
    item_count?: number;
    /** UPGRADE_FEE / SHIPPING_FEE / OPEN_CHECK_FEE / PENALTY_FEE: 직접 지정 금액 */
    amount?: number;
    /** LONG_TERM_FIRST: 장기보관 플랜 (첫 달 요금 계산) */
    long_term_plan_type?: string;
  };

  const { storage_id, payment_type, buyername, buyertel, buyeremail } = body;
  if (!storage_id || !payment_type || !buyername || !buyertel || !buyeremail) {
    return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
  }

  /* ── 스토리지 소유권 확인 ── */
  const { data: storage, error: sErr } = await supabase
    .from("customer_storages")
    .select("id, user_id, storage_mode, plan_type, max_plan_type, short_term_started_at")
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
  let item_count_val: number | null = null;

  if (payment_type === "PICKUP_FEE") {
    /* DB에서 박스 요금 조회 */
    const { data: feeRows, error: feeErr } = await supabase
      .from("pickup_box_fees")
      .select("size_code, label_ko, pickup_fee")
      .eq("is_active", true);

    if (feeErr || !feeRows?.length) {
      return NextResponse.json({ error: "박스 요금 정보를 불러올 수 없습니다." }, { status: 500 });
    }

    const feeMap = Object.fromEntries(feeRows.map((r) => [r.size_code, r]));

    const boxes = body.pickup_boxes?.length
      ? body.pickup_boxes
      : [{ size_code: "DEFAULT", qty: 1 }];

    const boxLines: string[] = [];
    for (const b of boxes) {
      const spec = feeMap[b.size_code];
      if (!spec) {
        return NextResponse.json({ error: `잘못된 박스 규격: ${b.size_code}` }, { status: 400 });
      }
      const qty = Math.max(1, Math.floor(b.qty ?? 1));
      amount += spec.pickup_fee * qty;
      boxLines.push(`${spec.label_ko} ${qty}개 × ${spec.pickup_fee.toLocaleString()}원`);
    }

    goodname = `인프론트 보관 서비스 수거비`;
    billing_memo = boxLines.join(" / ");

  } else if (payment_type === "LISTING_FEE") {
    const cnt = Math.max(1, Math.floor(body.item_count ?? 1));
    amount = cnt * 500;
    item_count_val = cnt;
    goodname = "인프론트 리스트 확인비";
    billing_memo = `물품 ${cnt}개 × 500원`;

  } else if (payment_type === "PHOTO_INSPECTION_FEE") {
    const cnt = Math.max(1, Math.floor(body.item_count ?? 1));
    amount = cnt * 1_000;
    item_count_val = cnt;
    goodname = "인프론트 사진·검품 등록비";
    billing_memo = `물품 ${cnt}개 × 1,000원`;

  } else if (payment_type === "RELEASE_FEE") {
    amount = 1_000;
    goodname = "인프론트 보관 서비스 출고 처리비";
    billing_memo = "출고 처리비 1,000원";

  } else if (payment_type === "UPGRADE_FEE") {
    amount = body.amount ?? 0;
    if (amount <= 0) return NextResponse.json({ error: "업그레이드 차액을 입력해 주세요." }, { status: 400 });
    goodname = "인프론트 플랜 업그레이드";
    billing_memo = `업그레이드 차액 ${amount.toLocaleString()}원`;

  } else if (payment_type === "SHIPPING_FEE") {
    amount = body.amount ?? 0;
    if (amount <= 0) return NextResponse.json({ error: "배송비를 입력해 주세요." }, { status: 400 });
    goodname = "인프론트 배송비";
    billing_memo = `배송비 ${amount.toLocaleString()}원`;

  } else if (payment_type === "OPEN_CHECK_FEE") {
    amount = body.amount ?? 5_000;
    goodname = "인프론트 해외배송 개봉 확인비";
    billing_memo = `개봉 확인비 ${amount.toLocaleString()}원`;

  } else if (payment_type === "PENALTY_FEE") {
    amount = body.amount ?? 0;
    if (amount <= 0) return NextResponse.json({ error: "페널티 금액을 입력해 주세요." }, { status: 400 });
    goodname = "인프론트 페널티";
    billing_memo = `페널티 ${amount.toLocaleString()}원`;

  } else if (payment_type === "LONG_TERM_FIRST") {
    /* 장기보관 첫 결제: 수거비 + 첫 달 이용료 */
    const planType = body.long_term_plan_type;
    if (!planType) return NextResponse.json({ error: "long_term_plan_type 필수" }, { status: 400 });

    const { data: planData } = await supabase
      .from("storage_plan_config")
      .select("monthly_rate, label_ko")
      .eq("plan_type", planType)
      .single();
    if (!planData?.monthly_rate) return NextResponse.json({ error: "플랜 요금 정보 없음" }, { status: 400 });

    /* 수거비 계산 */
    const { data: feeRows } = await supabase
      .from("pickup_box_fees")
      .select("size_code, label_ko, pickup_fee")
      .eq("is_active", true);
    const feeMap = Object.fromEntries((feeRows ?? []).map((r) => [r.size_code, r]));
    const boxes = body.pickup_boxes?.length ? body.pickup_boxes : [{ size_code: "DEFAULT", qty: 1 }];
    let pickupAmount = 0;
    const pickupLines: string[] = [];
    for (const b of boxes) {
      const spec = feeMap[b.size_code];
      if (!spec) return NextResponse.json({ error: `잘못된 박스 규격: ${b.size_code}` }, { status: 400 });
      const qty = Math.max(1, Math.floor(b.qty ?? 1));
      pickupAmount += spec.pickup_fee * qty;
      pickupLines.push(`${spec.label_ko} ${qty}개 × ${spec.pickup_fee.toLocaleString()}원`);
    }
    const monthlyAmount = Number(planData.monthly_rate);
    amount = pickupAmount + monthlyAmount;
    billing_plan_type = planType;
    goodname = `인프론트 장기보관 시작 (${planType}플랜)`;
    billing_memo = `수거비(${pickupLines.join("/")})+첫달이용료(${planData.label_ko} ${monthlyAmount.toLocaleString()}원)`;

  } else if (payment_type === "SHORT_TERM_STORAGE") {
    billing_weeks = body.billing_weeks ?? null;
    billing_plan_type = body.billing_plan_type ?? (storage.max_plan_type as string | null);

    if (!billing_weeks || billing_weeks <= 0) {
      return NextResponse.json({ error: "보관 기간(주)이 올바르지 않습니다." }, { status: 400 });
    }
    if (!billing_plan_type) {
      return NextResponse.json({ error: "과금 플랜을 확인할 수 없습니다." }, { status: 400 });
    }

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

  if (amount <= 0) {
    return NextResponse.json({ error: "결제 금액이 0원입니다." }, { status: 400 });
  }

  /* buyertel 정제 */
  const cleanTel = buyertel.replace(/[^0-9\-]/g, "");
  if (!cleanTel) {
    return NextResponse.json({ error: "연락처를 올바르게 입력해 주세요." }, { status: 400 });
  }

  /* ── storage_payments 레코드 생성 ── */
  const forceTest = process.env.INICIS_TEST_MODE === "true";
  const mid = (forceTest ? TEST_MID : (process.env.INICIS_MID ?? TEST_MID)).trim();
  const signKey = (forceTest ? TEST_SIGN_KEY : (process.env.INICIS_SIGN_KEY ?? TEST_SIGN_KEY)).trim();
  const isTest = forceTest || !process.env.INICIS_MID?.trim();

  if (!forceTest && process.env.INICIS_MID && !process.env.INICIS_SIGN_KEY) {
    console.error("[storage/pay/prepare] INICIS_MID is set but INICIS_SIGN_KEY is missing!");
    return NextResponse.json(
      { error: "결제 설정 오류: 관리자에게 문의해 주세요." },
      { status: 500 }
    );
  }

  const timestamp = Date.now().toString();
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
      item_count: item_count_val,
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr").trim();

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
