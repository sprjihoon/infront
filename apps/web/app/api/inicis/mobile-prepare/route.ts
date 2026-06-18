import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const TEST_MID = "INIpayTest";
const TEST_HASH_KEY = "3CB8183A4BE283555ACC8363C0360223";

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
      return NextResponse.json({ error: "?ÑÏàò ?åÎùºÎØ∏ÌÑ∞ ?ÑÎùΩ" }, { status: 400 });
    }

    const forceTest = process.env.INICIS_TEST_MODE?.trim() === "true";
    const mid = (forceTest ? TEST_MID : (process.env.INICIS_MID ?? TEST_MID)).trim();
    const hashKey = (forceTest ? TEST_HASH_KEY : (process.env.INICIS_MOBILE_HASH_KEY ?? TEST_HASH_KEY)).trim();

    // MID???§Ï†ï?êÎäî??HASH_KEYÍ∞Ä ?ÜÏúºÎ©??úÎ™Ö Î∂àÏùºÏπòÎ°ú Í≤∞Ï†ú ?§Ìå®
    if (!forceTest && process.env.INICIS_MID && !process.env.INICIS_MOBILE_HASH_KEY) {
      console.error("[inicis/mobile-prepare] INICIS_MID is set but INICIS_MOBILE_HASH_KEY is missing!");
      return NextResponse.json(
        { error: "Í≤∞Ï†ú ?§Ï†ï ?§Î•ò: INICIS_MOBILE_HASH_KEY ?òÍ≤Ω Î≥Ä?òÍ? ?§Ï†ï?òÏ? ?äÏïò?µÎãà??" },
        { status: 500 }
      );
    }

    const timestamp = Date.now().toString();
    const oid = `SHOP-${timestamp}-${crypto.randomBytes(4).toString("hex")}`;
    const amtStr = String(price);

    // P_CHKFAKE: SHA512(P_AMT + P_OID + P_TIMESTAMP + hashKey) ??Í∏àÏï° ?ÑÎ?Ï°?Î∞©Ï?
    const chkfake = crypto
      .createHash("sha512")
      .update(amtStr + oid + timestamp + hashKey, "utf8")
      .digest("base64");

    const cleanTel = buyertel.replace(/[^0-9\-]/g, "");
    if (!cleanTel) {
      return NextResponse.json({ error: "?∞ÎùΩÏ≤òÎ? ?¨Î∞îÎ•¥Í≤å ?ÖÎ†•??Ï£ºÏÑ∏??" }, { status: 400 });
    }

    /* ?Ä?Ä pending shop_order DB ?Ä???Ä?Ä */
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
      });
      if (dbErr) {
        console.error("[inicis/mobile-prepare] shop_order insert error:", dbErr.message);
      }
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://infront.kr").trim();

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
      // amt_hash=Y ?úÍ±∞ ??P_INI_PAYMENT ?ÑÎìú Ï∂©Îèå Î∞©Ï?, P_CHKFAKEÎ°?Í∏àÏï° Î¨¥Í≤∞??Î≥¥Ïû•
      P_RESERVED: "below1000=Y&vbank_receipt=Y&centerCd=Y",
      payUrl: "https://mobile.inicis.com/smart/payment/",
    });
  } catch (e) {
    console.error("[inicis/mobile-prepare]", e);
    return NextResponse.json({ error: "?úÎ≤Ñ ?§Î•ò" }, { status: 500 });
  }
}
