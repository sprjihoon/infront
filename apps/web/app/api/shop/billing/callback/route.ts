import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 발급 결과 처리 (샵 구독용)
   POST /api/shop/billing/callback

   KG이니시스가 빌링키 발급 완료 후 이 URL로 POST 전송
   - resultCode === "0000" → BILL_KEY 저장, /shop/billing/complete로 이동
   - resultCode !== "0000" → /shop/billing/fail로 이동
──────────────────────────────────────────────────────────────── */

function parseBody(text: string): Record<string, string> {
  const r: Record<string, string> = {};
  new URLSearchParams(text).forEach((v, k) => { r[k] = v; });
  return r;
}

function redirectHtml(url: string): NextResponse {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<script>
var u=${JSON.stringify(url)};
try{if(window!==window.top){window.top.location.replace(u);}else{window.location.replace(u);}}catch(e){window.location.replace(u);}
</script></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
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
    const contentType = request.headers.get("content-type") ?? "";
    const text = await request.text();
    if (contentType.includes("application/json")) {
      Object.assign(fields, JSON.parse(text));
    } else {
      fields = parseBody(text);
    }
  } catch {
    return redirectHtml("/shop/billing/fail?reason=parse_error");
  }

  const { resultCode, resultMsg, BILL_KEY, custom_data } = fields;

  if (resultCode !== "0000") {
    console.error("[shop/billing/callback] failed:", resultCode, resultMsg);
    return redirectHtml(`/shop/billing/fail?reason=${encodeURIComponent(resultMsg ?? "발급 실패")}`);
  }

  if (!BILL_KEY) {
    return redirectHtml("/shop/billing/fail?reason=no_bill_key");
  }

  let subId = "";
  try {
    const parsed = JSON.parse(custom_data ?? "{}");
    subId = parsed.sub_id ?? "";
  } catch { /* ignore */ }

  if (!subId) {
    console.error("[shop/billing/callback] missing sub_id in custom_data:", custom_data);
    return redirectHtml("/shop/billing/fail?reason=missing_data");
  }

  const db = adminDb();
  const { error: updErr } = await db
    .from("shop_subscriptions")
    .update({
      pg_bill_key: BILL_KEY,
      status:      "ACTIVE",
      updated_at:  new Date().toISOString(),
    })
    .eq("id", subId)
    .eq("status", "PENDING");

  if (updErr) {
    console.error("[shop/billing/callback] DB update error:", updErr.message);
    return redirectHtml("/shop/billing/fail?reason=db_error");
  }

  console.log("[shop/billing/callback] success, sub_id:", subId);
  return redirectHtml(`/shop/billing/complete?id=${encodeURIComponent(subId)}`);
}
