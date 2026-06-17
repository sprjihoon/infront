import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 가상계좌 입금 통보 수신
   POST /api/inicis/vbank-notify

   KG이니시스가 가상계좌 입금 완료 시 이 URL로 POST 전송
   ※ KG이니시스 관리자에서 가상계좌 입금통보 URL 등록 필요:
      https://infront.kr/api/inicis/vbank-notify

   처리 대상:
   - storage_payments (pg_oid 기준)
   - shop_orders (oid 기준)

   응답: "00" 문자열 (KG이니시스 스펙 — 정확히 이 값이어야 통보 완료 처리)
──────────────────────────────────────────────────────────────── */

function parseBody(text: string): Record<string, string> {
  const r: Record<string, string> = {};
  new URLSearchParams(text).forEach((v, k) => { r[k] = v; });
  return r;
}

function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(request: NextRequest) {
  let fields: Record<string, string> = {};

  try {
    const text = await request.text();
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      Object.assign(fields, JSON.parse(text));
    } else {
      fields = parseBody(text);
    }
  } catch {
    console.error("[vbank-notify] parse error");
    return new NextResponse("ER", { status: 200 });
  }

  const {
    resultCode, resultMsg,
    tid,        // 거래번호
    MOID,       // 주문번호 (OID)
    TotPrice,   // 입금 금액
    Vbank_Num,  // 가상계좌 번호
    Vbank_Name, // 은행명
  } = fields;

  console.log("[vbank-notify] received:", { resultCode, MOID, TotPrice, Vbank_Num });

  if (resultCode !== "00") {
    console.warn("[vbank-notify] non-00 code:", resultCode, resultMsg);
    return new NextResponse("00", { status: 200 }); // KG이니시스 재전송 방지를 위해 항상 "00" 응답
  }

  if (!MOID) {
    console.error("[vbank-notify] missing MOID");
    return new NextResponse("ER", { status: 200 });
  }

  const db = adminDb();
  const now = new Date().toISOString();

  /* ── storage_payments 에서 OID 검색 ── */
  const { data: storagePay } = await db
    .from("storage_payments")
    .select("id, storage_id, user_id, payment_type, amount")
    .eq("pg_oid", MOID)
    .maybeSingle();

  if (storagePay) {
    const { error: updErr } = await db
      .from("storage_payments")
      .update({
        status:      "PAID",
        pg_tid:      tid ?? null,
        approved_at: now,
      })
      .eq("id", storagePay.id);

    if (updErr) {
      console.error("[vbank-notify] storage_payment update error:", updErr.message);
      return new NextResponse("ER", { status: 200 });
    }

    /* PICKUP_FEE / LONG_TERM_FIRST 완료 시 스토리지 ACTIVE 전환 */
    if (
      storagePay.payment_type === "PICKUP_FEE" ||
      storagePay.payment_type === "LONG_TERM_FIRST"
    ) {
      await db
        .from("customer_storages")
        .update({ status: "ACTIVE", updated_at: now })
        .eq("id", storagePay.storage_id);
    }

    console.log("[vbank-notify] storage_payment updated:", storagePay.id);
    return new NextResponse("00", { status: 200 });
  }

  /* ── shop_orders 에서 OID 검색 ── */
  const { data: shopOrder } = await db
    .from("shop_orders")
    .select("id")
    .eq("oid", MOID)
    .maybeSingle();

  if (shopOrder) {
    await db
      .from("shop_orders")
      .update({
        status:    "PAID",
        inicis_tid: tid ?? null,
        paid_at:   now,
      })
      .eq("id", shopOrder.id);

    console.log("[vbank-notify] shop_order updated:", shopOrder.id);
    return new NextResponse("00", { status: 200 });
  }

  console.warn("[vbank-notify] OID not found:", MOID);
  return new NextResponse("00", { status: 200 }); // 재전송 방지
}
