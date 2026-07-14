import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { validateShopOrderRequest } from "@/lib/shop/prepare-order";

const TEST_HASH_KEY_FALLBACK = "3CB8183A4BE283555ACC8363C0360223";

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
      buyername: string;
      buyertel: string;
      buyeremail: string;
      productId?: string;
      paymentMethod?: string;
      sender?: AddressPayload;
      recipient?: AddressPayload;
    };

    const { buyername, buyertel, buyeremail, productId, paymentMethod, sender, recipient } = body;

    const validated = await validateShopOrderRequest(
      productId,
      buyername,
      buyertel,
      buyeremail,
      paymentMethod
    );
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: validated.status });
    }

    const {
      user,
      product,
      price,
      goodname,
      paymentMethod: payMethodLabel,
      paymentMethodCode,
      isForeignCard,
      paymentItemType,
      paymentItemKey,
      shippingType,
      trackingAvailable,
    } = validated.data;

    const mid = (process.env.INICIS_MID ?? "").trim();
    const hashKey = (process.env.INICIS_MOBILE_HASH_KEY ?? TEST_HASH_KEY_FALLBACK).trim();

    if (!mid) {
      console.error("[inicis/mobile-prepare] INICIS_MID 환경 변수가 설정되지 않았습니다.");
      return NextResponse.json(
        { error: "결제 설정 오류: INICIS_MID 환경 변수가 필요합니다." },
        { status: 500 }
      );
    }

    const timestamp = Date.now().toString();
    const oid = `SHOP-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
    const amtStr = String(price);

    const chkfake = crypto
      .createHash("sha512")
      .update(amtStr + oid + timestamp + hashKey, "utf8")
      .digest("base64");

    const cleanTel = buyertel.replace(/[^0-9\-]/g, "");
    if (!cleanTel) {
      return NextResponse.json({ error: "연락처를 올바르게 입력해 주세요." }, { status: 400 });
    }

    const admin = createAdminClient();
    if (admin) {
      const { error: dbErr } = await admin.from("shop_orders").insert({
        oid,
        product_id: product.id,
        amount: price,
        status: "PENDING_PAYMENT",
        user_id: user.id,
        customer_type: user.customerType,
        sender_name: sender?.name ?? buyername,
        sender_phone: sender?.phone ?? cleanTel,
        sender_zipcode: sender?.zipcode ?? null,
        sender_address: sender?.address ?? null,
        sender_detail: sender?.addressDetail ?? null,
        sender_email: buyeremail,
        recipient_name: recipient?.name ?? buyername,
        recipient_phone: recipient?.phone ?? null,
        recipient_zipcode: recipient?.zipcode ?? null,
        recipient_address: recipient?.address ?? null,
        recipient_detail: recipient?.addressDetail ?? null,
        recipient_addr1: recipient?.addr1 ?? null,
        recipient_addr2: recipient?.addr2 ?? null,
        recipient_addr3: recipient?.addr3 ?? null,
        payment_method: payMethodLabel,
        payment_method_code: paymentMethodCode,
        is_foreign_card: isForeignCard,
        payment_item_type: paymentItemType,
        payment_item_key: paymentItemKey,
        shipping_type: shippingType,
        tracking_available: trackingAvailable,
      });
      if (dbErr) {
        console.error("[inicis/mobile-prepare] shop_order insert error:", dbErr.message);
      }
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr").trim();

    return NextResponse.json({
      P_INI_PAYMENT: "Card",
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
      P_RESERVED: "centerCd=Y",
      payUrl: process.env.INICIS_TEST_MODE?.trim() === "true"
        ? "https://stgmobile.inicis.com/smart/payment/"
        : "https://mobile.inicis.com/smart/payment/",
    });
  } catch (e) {
    console.error("[inicis/mobile-prepare]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
