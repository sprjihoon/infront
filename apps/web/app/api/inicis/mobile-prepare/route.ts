import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 모바일 결제 준비
   모바일은 PC와 다른 파라미터 체계 사용 (P_* prefix)
   P_CHKFAKE = BASE64_ENCODE(SHA512(P_AMT + P_OID + P_TIMESTAMP + HashKey))
   모바일 테스트 HashKey: 3CB8183A4BE283555ACC8363C0360223
──────────────────────────────────────────────────────────────── */
const TEST_MID = "INIpayTest";
const TEST_HASH_KEY = "3CB8183A4BE283555ACC8363C0360223";

export async function POST(request: NextRequest) {
  try {
    const { price, goodname, buyername, buyertel, buyeremail } = await request.json() as {
      price: number;
      goodname: string;
      buyername: string;
      buyertel: string;
      buyeremail: string;
    };

    if (!price || !goodname || !buyername || !buyertel || !buyeremail) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const mid = process.env.INICIS_MID ?? TEST_MID;
    const hashKey = process.env.INICIS_MOBILE_HASH_KEY ?? TEST_HASH_KEY;

    const timestamp = Date.now().toString();
    const oid = `SHOP-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
    const amtStr = String(price);

    /* 모바일 위변조 방지 해시: BASE64(SHA512(AMT+OID+TIMESTAMP+HashKey)) */
    const chkfake = crypto
      .createHash("sha512")
      .update(amtStr + oid + timestamp + hashKey, "utf8")
      .digest("base64");

    /* 연락처 정제 */
    const cleanTel = buyertel.replace(/[^0-9\-]/g, "");
    if (!cleanTel) {
      return NextResponse.json({ error: "연락처를 올바르게 입력해 주세요." }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr";

    return NextResponse.json({
      P_MID: mid,
      P_OID: oid,
      P_AMT: amtStr,
      P_GOODS: goodname,
      P_UNAME: buyername,
      P_MOBILE: cleanTel.replace(/-/g, ""),
      P_EMAIL: buyeremail,
      P_TIMESTAMP: timestamp,
      P_CHKFAKE: chkfake,
      P_NOTI: oid,
      P_NEXT_URL: `${appUrl}/api/inicis/mobile-return`,
      P_CHARSET: "utf8",
      P_RESERVED: "below1000=Y&vbank_receipt=Y&centerCd=Y&amt_hash=Y",
      payUrl: "https://mobile.inicis.com/smart/payment/",
    });
  } catch (e) {
    console.error("[inicis/mobile-prepare]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
