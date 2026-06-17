import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 결제 실행 (INIAPI Rebill)
   POST /api/inicis/billing/pay

   서버-서버 호출 (클라이언트에서 직접 호출 또는 Cron에서 호출)
   Body:
   {
     recurring_id?: string,   // storage_recurring_profiles.id (자동결제)
     storage_id?: string,     // 조회 키 대안
     user_id?: string,        // 보안 검증용 (서버에서 호출 시 생략 가능)
     amount?: number,         // override (미입력 시 profile.monthly_amount 사용)
     msg?: string,            // 결제 메모
   }

   signData = Base64( AES-128-CBC( "Rebill" + mid + billKey + msg + price + ts ) )
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
  const key  = process.env.INICIS_INIAPI_KEY!;
  const iv   = process.env.INICIS_INIAPI_IV!;
  const plain = type + mid + tid + msg + price + timestamp;
  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(iv,  "utf8"),
  );
  return Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]).toString("base64");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      recurring_id?: string;
      storage_id?:   string;
      amount?:       number;
      msg?:          string;
    };

    const db = adminDb();

    /* 프로파일 조회 */
    let profileQuery = db
      .from("storage_recurring_profiles")
      .select("id, user_id, storage_id, pg_bill_key, monthly_amount, plan_type, next_billing_date")
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

    const billKey = profile.pg_bill_key;
    if (!billKey || billKey.startsWith("PENDING:")) {
      return NextResponse.json({ error: "유효한 빌링키가 없습니다." }, { status: 400 });
    }

    const mid    = process.env.INICIS_MID;
    const apiKey = process.env.INICIS_INIAPI_KEY;
    const apiIv  = process.env.INICIS_INIAPI_IV;
    if (!mid || !apiKey || !apiIv) {
      console.error("[billing/pay] 환경변수 누락");
      return NextResponse.json({ error: "결제 설정 오류" }, { status: 500 });
    }

    const amount    = body.amount ?? Number(profile.monthly_amount);
    const msg       = body.msg ?? `인프론트 장기보관 월정액 (${profile.plan_type})`;
    const type      = "Rebill";
    const timestamp = Date.now().toString();
    const priceStr  = String(amount);

    /* payment record 생성 */
    const shortId = (profile.storage_id as string).replace(/-/g, "").substring(0, 8);
    const oid     = `RBILL-${shortId}-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;

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

    const signData = buildSignData(type, mid, billKey, msg, priceStr, timestamp);

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
    const resultMsg  = result.resultMsg  ?? result.P_RMESG1 ?? "알 수 없는 오류";
    const tid        = result.tid ?? result.TID ?? "";

    if (resultCode !== "00" && resultCode !== "0000") {
      console.error("[billing/pay] rebill failed:", resultCode, resultMsg);
      /* 결제 실패 처리 */
      await db.from("storage_payments").update({
        status:      "FAILED",
        fail_reason: `[${resultCode}] ${resultMsg}`,
      }).eq("id", payment.id);

      /* 프로파일 실패 카운트 업데이트 */
      await db.from("storage_recurring_profiles").update({
        status:          "PAUSED",
        fail_count:      (profile as { fail_count?: number }).fail_count ?? 0 + 1,
        last_fail_at:    new Date().toISOString(),
        last_fail_reason: `[${resultCode}] ${resultMsg}`,
        updated_at:      new Date().toISOString(),
      }).eq("id", profile.id);

      return NextResponse.json({ error: resultMsg, code: resultCode }, { status: 400 });
    }

    /* 결제 성공 처리 */
    const now = new Date().toISOString();
    await db.from("storage_payments").update({
      status:      "PAID",
      pg_tid:      tid,
      approved_at: now,
    }).eq("id", payment.id);

    /* 다음 결제일 갱신 */
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + 1);
    nextDate.setDate(1);
    await db.from("storage_recurring_profiles").update({
      last_billing_date: new Date().toISOString().split("T")[0],
      next_billing_date: nextDate.toISOString().split("T")[0],
      fail_count:        0,
      status:            "ACTIVE",
      updated_at:        now,
    }).eq("id", profile.id);

    console.log("[billing/pay] success:", oid, tid);
    return NextResponse.json({ ok: true, oid, tid, resultCode, amount });

  } catch (e) {
    console.error("[billing/pay] error:", e);
    return NextResponse.json({ error: "자동결제 처리 오류" }, { status: 500 });
  }
}
