import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 결제 실행 (샵 구독 테스트 청구)
   POST /api/shop/billing/charge

   Body: { sub_id: string }
   - 로그인 필요 (본인 구독만 청구 가능)
   - INIAPI Rebill 호출
──────────────────────────────────────────────────────────────── */

const REBILL_URL = "https://iniapi.inicis.com/api/v1/bill";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function buildSignData(
  type: string, mid: string, tid: string,
  msg: string, price: string, timestamp: string,
): string {
  const key   = (process.env.INICIS_BILLING_INIAPI_KEY ?? process.env.INICIS_INIAPI_KEY ?? "").trim();
  const iv    = (process.env.INICIS_BILLING_INIAPI_IV  ?? process.env.INICIS_INIAPI_IV  ?? "").trim();
  if (!key || !iv) throw new Error("INIAPI KEY/IV 환경변수 누락");
  const plain = type + mid + tid + msg + price + timestamp;
  const cipher = crypto.createCipheriv("aes-128-cbc", Buffer.from(key, "utf8"), Buffer.from(iv, "utf8"));
  return Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]).toString("base64");
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

  const db = adminDb();

  const { data: sub, error: subErr } = await db
    .from("shop_subscriptions")
    .select("id, user_id, pg_bill_key, plan_name, monthly_amount, status")
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

  const mid = (process.env.INICIS_BILLING_MID ?? "").trim();
  if (!mid) {
    return NextResponse.json({ error: "빌링 MID가 설정되지 않았습니다. 관리자에게 문의하세요." }, { status: 500 });
  }

  const amount    = sub.monthly_amount as number;
  const msg       = `인프론트 ${sub.plan_name} 월 구독료`;
  const type      = "Rebill";
  const timestamp = Date.now().toString();
  const priceStr  = String(amount);
  const oid       = `SBRB-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;

  let signData: string;
  try {
    signData = buildSignData(type, mid, billKey, msg, priceStr, timestamp);
  } catch (e) {
    console.error("[shop/billing/charge] signData error:", e);
    return NextResponse.json({ error: "결제 서명 생성 실패" }, { status: 500 });
  }

  const params = new URLSearchParams({ type, mid, tid: billKey, msg, price: priceStr, timestamp, signData });

  const res = await fetch(REBILL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
    body: params.toString(),
  });
  const resText = await res.text();

  let result: Record<string, string> = {};
  try { result = JSON.parse(resText); }
  catch { new URLSearchParams(resText).forEach((v, k) => { result[k] = v; }); }

  const resultCode = result.resultCode ?? result.P_STATUS;
  const resultMsg2 = result.resultMsg  ?? result.P_RMESG1 ?? "알 수 없는 오류";
  const tid        = result.tid ?? result.TID ?? "";

  if (resultCode !== "00" && resultCode !== "0000") {
    console.error("[shop/billing/charge] rebill failed:", resultCode, resultMsg2);
    return NextResponse.json({ error: resultMsg2, code: resultCode }, { status: 400 });
  }

  /* 마지막 결제 일시 갱신 */
  await db.from("shop_subscriptions").update({
    last_paid_at: new Date().toISOString(),
    updated_at:   new Date().toISOString(),
  }).eq("id", sub_id);

  console.log("[shop/billing/charge] success:", oid, tid);
  return NextResponse.json({ ok: true, oid, tid, resultCode, amount });
}
