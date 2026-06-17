import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 결제 취소 API  (INIAPI v1)
   POST /api/inicis/cancel
   Body: { tid, price, msg?, type? }
   - type: "Refund" (전액취소, default) | "PartialRefund" (부분취소)

   signData = Base64( AES-128-CBC( type+mid+tid+msg+price+timestamp,
                                   key=INIAPI_KEY, iv=INIAPI_IV ) )
──────────────────────────────────────────────────────────────── */

const CANCEL_URL = "https://iniapi.inicis.com/api/v1/refund";

/**
 * KG이니시스 INIAPI signData 생성
 * - plainText: 파라미터 값들을 순서대로 단순 연결 (key=value 형식 아님)
 * - 암호화: AES-128-CBC / PKCS5Padding
 * - KEY, IV: 포털에서 발급한 16-byte UTF-8 문자열
 */
function buildSignData(
  type: string,
  mid: string,
  tid: string,
  msg: string,
  price: string,
  timestamp: string,
): string {
  const key = process.env.INICIS_INIAPI_KEY!;
  const iv  = process.env.INICIS_INIAPI_IV!;

  const plain = type + mid + tid + msg + price + timestamp;
  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(iv,  "utf8"),
  );
  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  return encrypted.toString("base64");
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

    const mid     = process.env.INICIS_MID;
    const apiKey  = process.env.INICIS_INIAPI_KEY;
    const apiIv   = process.env.INICIS_INIAPI_IV;

    if (!mid || !apiKey || !apiIv) {
      console.error("[inicis/cancel] 환경변수 누락: INICIS_MID / INICIS_INIAPI_KEY / INICIS_INIAPI_IV");
      return NextResponse.json({ error: "결제 설정 오류" }, { status: 500 });
    }

    const timestamp = Date.now().toString();
    const priceStr  = String(price);

    const signData = buildSignData(type, mid, tid, msg, priceStr, timestamp);

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
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: params.toString(),
    });

    const resText = await res.text();

    let result: Record<string, string> = {};
    try {
      result = JSON.parse(resText);
    } catch {
      new URLSearchParams(resText).forEach((v, k) => { result[k] = v; });
    }

    const resultCode = result.resultCode ?? result.P_STATUS;
    const resultMsg  = result.resultMsg  ?? result.P_RMESG1 ?? "알 수 없는 오류";

    if (resultCode !== "00" && resultCode !== "0000") {
      console.error("[inicis/cancel] failed:", resultCode, resultMsg, "raw:", resText);
      return NextResponse.json({ error: resultMsg, code: resultCode }, { status: 400 });
    }

    console.log("[inicis/cancel] success:", tid, resultCode, resultMsg);
    return NextResponse.json({ ok: true, resultCode, resultMsg, tid });

  } catch (e) {
    console.error("[inicis/cancel] error:", e);
    return NextResponse.json({ error: "취소 처리 오류" }, { status: 500 });
  }
}
