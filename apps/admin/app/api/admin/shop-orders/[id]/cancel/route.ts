import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminDb } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/server";

/* ────────────────────────────────────────────────────────────────
   POST /api/admin/shop-orders/[id]/cancel
   Body: { msg?: string }
   KG이니시스 INIAPI AES-128-CBC signData 방식 전액 취소
──────────────────────────────────────────────────────────────── */

const CANCEL_URL = "https://iniapi.inicis.com/api/v1/refund";

function buildSignData(
  type: string, mid: string, tid: string,
  msg: string, price: string, timestamp: string,
): string {
  const key = process.env.INICIS_INIAPI_KEY!;
  const iv  = process.env.INICIS_INIAPI_IV!;
  const plain = type + mid + tid + msg + price + timestamp;
  const cipher = crypto.createCipheriv(
    "aes-128-cbc",
    Buffer.from(key, "utf8"),
    Buffer.from(iv,  "utf8"),
  );
  return Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]).toString("base64");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminUser = await requireAdmin();
  if (!adminUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  /* 1. shop_order 조회 */
  const { data: order, error: fetchErr } = await adminDb
    .from("shop_orders")
    .select("id, oid, inicis_tid, amount, status")
    .eq("id", id)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 });
  }

  if (order.status === "CANCELLED") {
    return NextResponse.json({ error: "이미 취소된 주문입니다." }, { status: 400 });
  }

  if (order.status !== "PAID" || !order.inicis_tid) {
    return NextResponse.json({ error: "결제 완료된 주문만 취소할 수 있습니다." }, { status: 400 });
  }

  const mid     = process.env.INICIS_MID;
  const apiKey  = process.env.INICIS_INIAPI_KEY;
  const apiIv   = process.env.INICIS_INIAPI_IV;
  if (!mid || !apiKey || !apiIv) {
    console.error("[shop-orders/cancel] 환경변수 누락");
    return NextResponse.json({ error: "결제 설정 오류" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({})) as { msg?: string };
  const msg       = body.msg?.trim() || "관리자 취소";
  const type      = "Refund";
  const tid       = order.inicis_tid;
  const price     = String(order.amount);
  const timestamp = Date.now().toString();

  /* 2. KG이니시스 취소 요청 (INIAPI AES-128-CBC signData) */
  const signData   = buildSignData(type, mid, tid, msg, price, timestamp);

  const cancelParams = new URLSearchParams({ type, mid, tid, msg, price, timestamp, signData });

  let cancelResult: Record<string, string> = {};
  try {
    const res = await fetch(CANCEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: cancelParams.toString(),
    });
    const text = await res.text();
    try {
      cancelResult = JSON.parse(text);
    } catch {
      new URLSearchParams(text).forEach((v, k) => { cancelResult[k] = v; });
    }
  } catch (e) {
    console.error("[shop-orders/cancel] fetch error:", e);
    return NextResponse.json({ error: "KG이니시스 통신 오류" }, { status: 500 });
  }

  const resultCode = cancelResult.resultCode ?? cancelResult.P_STATUS;
  const resultMsg  = cancelResult.resultMsg  ?? cancelResult.P_RMESG1 ?? "알 수 없는 오류";

  if (resultCode !== "00" && resultCode !== "0000") {
    console.error("[shop-orders/cancel] cancel failed:", resultCode, resultMsg);
    return NextResponse.json({ error: resultMsg, code: resultCode }, { status: 400 });
  }

  /* 3. DB 업데이트 */
  const { error: updErr } = await adminDb
    .from("shop_orders")
    .update({
      status:       "CANCELLED",
      cancelled_at: new Date().toISOString(),
      cancel_msg:   msg,
    })
    .eq("id", id);

  if (updErr) {
    console.error("[shop-orders/cancel] db update error:", updErr.message);
    return NextResponse.json({ error: "DB 업데이트 오류 (취소는 처리됨)" }, { status: 500 });
  }

  console.log("[shop-orders/cancel] success:", tid, resultCode);
  return NextResponse.json({ ok: true, resultCode, resultMsg });
}
