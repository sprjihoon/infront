import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 결제 취소 API
   POST /api/inicis/cancel
   Body: { tid, price, msg?, type? }
   - type: "Refund" (전액취소, default) | "PartialRefund" (부분취소)
   - 부분취소 시 price 필드 = 취소할 금액
──────────────────────────────────────────────────────────────── */

const CANCEL_URL = "https://iniapi.inicis.com/api/v1/refund";

function sha256hex(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      tid: string;
      price: number;
      msg?: string;
      type?: "Refund" | "PartialRefund";
    };

    const { tid, price, msg = "관리자 취소", type = "Refund" } = body;

    if (!tid || !price) {
      return NextResponse.json({ error: "tid, price는 필수입니다." }, { status: 400 });
    }

    const mid = process.env.INICIS_MID;
    const signKey = process.env.INICIS_SIGN_KEY;

    if (!mid || !signKey) {
      console.error("[inicis/cancel] INICIS_MID or INICIS_SIGN_KEY not set");
      return NextResponse.json({ error: "결제 설정 오류" }, { status: 500 });
    }

    const timestamp = Date.now().toString();
    const priceStr = String(price);

    /*
     * KG이니시스 REST API signData 계산
     * signData = SHA256(type={type}&mid={mid}&tid={tid}&msg={msg}&price={price}&timestamp={timestamp}&hashKey={signKey})
     */
    const signSource = `type=${type}&mid=${mid}&tid=${tid}&msg=${msg}&price=${priceStr}&timestamp=${timestamp}&hashKey=${signKey}`;
    const signData = sha256hex(signSource);

    const params = new URLSearchParams({
      type,
      mid,
      tid,
      msg,
      price: priceStr,
      timestamp,
      signData,
    });

    const res = await fetch(CANCEL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      },
      body: params.toString(),
    });

    const resText = await res.text();

    /* 응답 파싱 (URL-encoded 또는 JSON) */
    let result: Record<string, string> = {};
    try {
      const json = JSON.parse(resText);
      result = json;
    } catch {
      new URLSearchParams(resText).forEach((v, k) => { result[k] = v; });
    }

    const resultCode = result.resultCode ?? result.P_STATUS;
    const resultMsg  = result.resultMsg  ?? result.P_RMESG1 ?? "알 수 없는 오류";

    if (resultCode !== "00" && resultCode !== "0000") {
      console.error("[inicis/cancel] cancel failed:", resultCode, resultMsg, "raw:", resText);
      return NextResponse.json({ error: resultMsg, code: resultCode }, { status: 400 });
    }

    console.log("[inicis/cancel] success:", tid, resultCode, resultMsg);
    return NextResponse.json({ ok: true, resultCode, resultMsg, tid });

  } catch (e) {
    console.error("[inicis/cancel] error:", e);
    return NextResponse.json({ error: "취소 처리 오류" }, { status: 500 });
  }
}
