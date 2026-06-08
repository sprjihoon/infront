import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 테스트 자격증명 (실서비스 시 환경변수로 교체)
   MID: INIpayTest
   signKey: SU5JTElURV9UUklQTEVERVNfS0VZU1JS
──────────────────────────────────────────────────────────────── */
const TEST_MID = "INIpayTest";
const TEST_SIGN_KEY = "SU5JTElURV9UUklQTEVERVNfS0VZU1JS";

function sha256hex(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

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
    const signKey = process.env.INICIS_SIGN_KEY ?? TEST_SIGN_KEY;
    const isTest = !process.env.INICIS_MID;

    const timestamp = Date.now().toString();
    const oid = `SHOP-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
    const priceStr = String(price);

    /* KG이니시스 필수 서명값 */
    const signature = sha256hex(`oid=${oid}&price=${priceStr}&timestamp=${timestamp}`);
    const verification = sha256hex(
      `oid=${oid}&price=${priceStr}&signKey=${signKey}&timestamp=${timestamp}`
    );
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
      buyertel,
      buyeremail,
      returnUrl: `${appUrl}/api/inicis/return`,
      closeUrl: `${appUrl}/shop/payment/close`,
      /* 테스트: stgstdpay / 운영: stdpay */
      jsUrl: isTest
        ? "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
        : "https://stdpay.inicis.com/stdjs/INIStdPay.js",
    });
  } catch (e) {
    console.error("[inicis/prepare]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
