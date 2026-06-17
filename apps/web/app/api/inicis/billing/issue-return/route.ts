import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 빌링키 발급 결과 처리
   POST /api/inicis/billing/issue-return

   KG이니시스가 빌링키 발급 완료 후 이 URL로 POST 전송
   - resultCode === "0000" : 발급 성공 → storage_recurring_profiles 활성화
   - resultCode !== "0000" : 발급 실패 → PAUSED 프로파일 삭제
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
  return new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
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
    return redirectHtml("/storage/billing/fail?reason=parse_error");
  }

  const {
    resultCode, resultMsg,
    BILL_KEY,              // 발급된 빌링키
    mid, oid,
    custom_data,           // { storage_id, plan_type, user_id }
  } = fields;

  /* 실패 처리 */
  if (resultCode !== "0000") {
    console.error("[billing/issue-return] failed:", resultCode, resultMsg);
    /* PAUSED 프로파일 정리 */
    if (oid) {
      const db = adminDb();
      await db.from("storage_recurring_profiles")
        .delete()
        .like("pg_bill_key", `PENDING:${oid}%`);
    }
    return redirectHtml(`/storage/billing/fail?reason=${encodeURIComponent(resultMsg ?? "발급 실패")}`);
  }

  if (!BILL_KEY) {
    return redirectHtml("/storage/billing/fail?reason=no_bill_key");
  }

  /* custom_data 파싱 */
  let customData: { storage_id?: string; plan_type?: string; user_id?: string } = {};
  try { customData = JSON.parse(custom_data ?? "{}"); } catch { /* ignore */ }

  const { storage_id, plan_type, user_id } = customData;
  if (!storage_id || !plan_type || !user_id) {
    console.error("[billing/issue-return] missing custom_data:", custom_data);
    return redirectHtml("/storage/billing/fail?reason=missing_data");
  }

  const db = adminDb();

  /* 플랜 월 금액 조회 */
  const { data: planData } = await db
    .from("storage_plan_config")
    .select("monthly_rate")
    .eq("plan_type", plan_type)
    .single();

  const monthlyAmount = Number(planData?.monthly_rate ?? 0);

  /* recurring profile 활성화 */
  const today = new Date();
  const nextBillingDate = new Date(today.getFullYear(), today.getMonth() + 1, 1)
    .toISOString().split("T")[0];

  const { error: updErr } = await db
    .from("storage_recurring_profiles")
    .update({
      pg_bill_key:       BILL_KEY,
      monthly_amount:    monthlyAmount,
      billing_day:       1,
      next_billing_date: nextBillingDate,
      status:            "ACTIVE",
      updated_at:        new Date().toISOString(),
    })
    .eq("storage_id", storage_id)
    .eq("status", "PAUSED")
    .like("pg_bill_key", `PENDING:%`);

  if (updErr) {
    console.error("[billing/issue-return] profile update error:", updErr.message);
    return redirectHtml("/storage/billing/fail?reason=db_error");
  }

  console.log("[billing/issue-return] success:", storage_id, BILL_KEY);
  return redirectHtml(`/storage/billing/success?storage_id=${encodeURIComponent(storage_id)}`);
}
