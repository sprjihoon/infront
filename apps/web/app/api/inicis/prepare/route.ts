import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const TEST_MID = "INIpayTest";
const TEST_SIGN_KEY = "SU5JTElURV9UUklQTEVERVNfS0VZU1RS";

function sha256hex(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

interface AddressPayload {
  name?: string;
  phone?: string;
  zipcode?: string;
  address?: string;
  addressDetail?: string;
  addr1?: string;
  addr2?: string;
  addr3?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      price: number;
      goodname: string;
      buyername: string;
      buyertel: string;
      buyeremail: string;
      productId?: string;
      sender?: AddressPayload;
      recipient?: AddressPayload;
    };

    const { price, goodname, buyername, buyertel, buyeremail, productId, sender, recipient } = body;

    if (!price || !goodname || !buyername || !buyertel || !buyeremail) {
      return NextResponse.json({ error: "필수 파라미터 누락" }, { status: 400 });
    }

    const mid = process.env.INICIS_MID ?? TEST_MID;
    const signKey = process.env.INICIS_SIGN_KEY ?? TEST_SIGN_KEY;
    const isTest = !process.env.INICIS_MID;

    // MID는 설정됐는데 SIGN_KEY가 없으면 서명 불일치로 결제 실패
    if (process.env.INICIS_MID && !process.env.INICIS_SIGN_KEY) {
      console.error("[inicis/prepare] INICIS_MID is set but INICIS_SIGN_KEY is missing!");
      return NextResponse.json(
        { error: "결제 설정 오류: INICIS_SIGN_KEY 환경 변수가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const timestamp = Date.now().toString();
    const oid = `SHOP-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
    const priceStr = String(price);

    const cleanTel = buyertel.replace(/[^0-9\-]/g, "");
    if (!cleanTel) {
      return NextResponse.json({ error: "연락처를 올바르게 입력해 주세요." }, { status: 400 });
    }

    const signature = sha256hex(`oid=${oid}&price=${priceStr}&timestamp=${timestamp}`);
    const verification = sha256hex(
      `oid=${oid}&price=${priceStr}&signKey=${signKey}&timestamp=${timestamp}`
    );
    const mKey = sha256hex(signKey);

    /* ── pending shop_order DB 저장 ── */
    const admin = createAdminClient();
    if (admin) {
      const { error: dbErr } = await admin.from("shop_orders").insert({
        oid,
        product_id: productId ?? "UNKNOWN",
        amount: price,
        status: "PENDING_PAYMENT",
        sender_name:    sender?.name    ?? buyername,
        sender_phone:   sender?.phone   ?? cleanTel,
        sender_zipcode: sender?.zipcode ?? null,
        sender_address: sender?.address ?? null,
        sender_detail:  sender?.addressDetail ?? null,
        sender_email:   buyeremail,
        recipient_name:    recipient?.name    ?? buyername,
        recipient_phone:   recipient?.phone   ?? null,
        recipient_zipcode: recipient?.zipcode ?? null,
        recipient_address: recipient?.address ?? null,
        recipient_detail:  recipient?.addressDetail ?? null,
        recipient_addr1:   recipient?.addr1 ?? null,
        recipient_addr2:   recipient?.addr2 ?? null,
        recipient_addr3:   recipient?.addr3 ?? null,
        recipient_email:   null,
      });
      if (dbErr) {
        console.error("[inicis/prepare] shop_order insert error:", dbErr.message);
      }
    }

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
      returnUrl: `${appUrl}/api/inicis/return`,
      closeUrl: `${appUrl}/shop/payment/close`,
      jsUrl: isTest
        ? "https://stgstdpay.inicis.com/stdjs/INIStdPay.js"
        : "https://stdpay.inicis.com/stdjs/INIStdPay.js",
    });
  } catch (e) {
    console.error("[inicis/prepare]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
