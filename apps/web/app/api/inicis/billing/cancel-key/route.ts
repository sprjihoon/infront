import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 해지
   POST /api/inicis/billing/cancel-key
   Body: { recurring_id?: string, storage_id?: string, msg?: string }
──────────────────────────────────────────────────────────────── */

const CANCEL_KEY_URL = "https://iniapi.inicis.com/api/v1/bill/delete";

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function buildSignData(
  type: string, mid: string, tid: string,
  msg: string, timestamp: string,
): string {
  const key  = process.env.INICIS_INIAPI_KEY!;
  const iv   = process.env.INICIS_INIAPI_IV!;
  const plain = type + mid + tid + msg + timestamp;
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
      msg?:          string;
    };

    const db = adminDb();

    let profileQuery = db
      .from("storage_recurring_profiles")
      .select("id, pg_bill_key, status")
      .in("status", ["ACTIVE", "PAUSED"]);

    if (body.recurring_id) {
      profileQuery = profileQuery.eq("id", body.recurring_id);
    } else if (body.storage_id) {
      profileQuery = profileQuery.eq("storage_id", body.storage_id);
    } else {
      return NextResponse.json({ error: "recurring_id 또는 storage_id 필수" }, { status: 400 });
    }

    const { data: profile, error: pErr } = await profileQuery.single();
    if (pErr || !profile) {
      return NextResponse.json({ error: "자동결제 프로파일을 찾을 수 없습니다." }, { status: 404 });
    }

    const billKey = profile.pg_bill_key;
    if (!billKey || billKey.startsWith("PENDING:")) {
      /* 빌키 없으면 그냥 CANCELLED 처리 */
      await db.from("storage_recurring_profiles")
        .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
        .eq("id", profile.id);
      return NextResponse.json({ ok: true, msg: "빌링키 없음, 프로파일 해지 처리" });
    }

    const mid    = process.env.INICIS_MID;
    const apiKey = process.env.INICIS_INIAPI_KEY;
    const apiIv  = process.env.INICIS_INIAPI_IV;
    if (!mid || !apiKey || !apiIv) {
      return NextResponse.json({ error: "결제 설정 오류" }, { status: 500 });
    }

    const msg       = body.msg ?? "자동결제 해지";
    const type      = "BillKeyCancel";
    const timestamp = Date.now().toString();
    const signData  = buildSignData(type, mid, billKey, msg, timestamp);

    const params = new URLSearchParams({ type, mid, tid: billKey, msg, timestamp, signData });

    const res = await fetch(CANCEL_KEY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: params.toString(),
    });
    const resText = await res.text();

    let result: Record<string, string> = {};
    try { result = JSON.parse(resText); }
    catch { new URLSearchParams(resText).forEach((v, k) => { result[k] = v; }); }

    const resultCode = result.resultCode ?? result.P_STATUS;
    const resultMsg  = result.resultMsg  ?? "알 수 없는 오류";

    if (resultCode !== "00" && resultCode !== "0000") {
      console.error("[billing/cancel-key] failed:", resultCode, resultMsg);
      return NextResponse.json({ error: resultMsg, code: resultCode }, { status: 400 });
    }

    /* 프로파일 해지 */
    await db.from("storage_recurring_profiles")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    console.log("[billing/cancel-key] success:", billKey);
    return NextResponse.json({ ok: true, resultCode, resultMsg });

  } catch (e) {
    console.error("[billing/cancel-key] error:", e);
    return NextResponse.json({ error: "빌링키 해지 오류" }, { status: 500 });
  }
}
