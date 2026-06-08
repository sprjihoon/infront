import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/* ────────────────────────────────────────────────────────────────
   스토리지 결제 콜백 (KG이니시스 returnUrl)
   - OID 포맷: STG-{shortStorageId}-{timestamp}-{randomHex}
   - DB에서 storage_payments.pg_oid로 레코드 찾기
   - 결제 성공 시 storage_payments.status = 'PAID' 업데이트
   - PICKUP_FEE 완료 시 customer_storages.status = 'ACTIVE'
──────────────────────────────────────────────────────────────── */

function sha256hex(str: string) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function redirectHtml(url: string): NextResponse {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head><body>
<script>
var u = ${JSON.stringify(url)};
try {
  if (window !== window.top) { window.top.location.replace(u); }
  else { window.location.replace(u); }
} catch(e) { window.location.replace(u); }
</script>
</body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function parseBody(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  new URLSearchParams(text).forEach((v, k) => { result[k] = v; });
  return result;
}

/** 서비스 롤 클라이언트 (RLS 우회, 서버에서만 사용) */
function adminDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    return redirectHtml("/storage/payment/fail?reason=parse_error");
  }

  const { resultCode, resultMsg, authToken, authUrl, idc_name, netCancelUrl, mid, oid, price } = fields;

  /* ── 1. 인증 단계 실패 ── */
  if (resultCode !== "0000") {
    const msg = resultMsg ?? "결제 인증 실패";
    console.error("[storage-return] auth failed:", resultCode, msg);
    /* storage_payment 실패 처리 */
    if (oid) {
      try {
        await adminDb()
          .from("storage_payments")
          .update({ status: "FAILED", fail_reason: `[${resultCode}] ${msg}` })
          .eq("pg_oid", oid);
      } catch { /* ignore */ }
    }
    return redirectHtml(`/storage/payment/fail?reason=${encodeURIComponent(msg)}&code=${resultCode}`);
  }

  if (!authToken || !authUrl) {
    return redirectHtml("/storage/payment/fail?reason=missing_token");
  }

  /* ── 2. authUrl 검증 ── */
  const IDC_URLS: Record<string, string> = {
    fc:  "https://fcstdpay.inicis.com/api/payAuth",
    ks:  "https://ksstdpay.inicis.com/api/payAuth",
    stg: "https://stgstdpay.inicis.com/api/payAuth",
  };
  const expectedAuthUrl = idc_name ? IDC_URLS[idc_name] : null;
  if (expectedAuthUrl && authUrl !== expectedAuthUrl) {
    console.error("[storage-return] authUrl mismatch:", authUrl);
    return redirectHtml("/storage/payment/fail?reason=auth_url_mismatch");
  }

  /* ── 3. DB에서 결제 레코드 조회 ── */
  const db = adminDb();
  const { data: paymentRec, error: recErr } = await db
    .from("storage_payments")
    .select("id, storage_id, user_id, payment_type, amount, billing_weeks, billing_plan_type, billing_memo")
    .eq("pg_oid", oid)
    .single();

  if (recErr || !paymentRec) {
    console.error("[storage-return] payment record not found for oid:", oid, recErr);
    return redirectHtml("/storage/payment/fail?reason=record_not_found");
  }

  /* ── 4. 네트결제 승인 요청 ── */
  let tid = "";
  try {
    const signKey = process.env.INICIS_SIGN_KEY ?? "SU5JTElURV9UUklQTEVERVNfS0VZU1JS";
    const timestamp = Date.now().toString();
    const signature = sha256hex(`authToken=${authToken}&timestamp=${timestamp}`);
    const verification = sha256hex(`authToken=${authToken}&signKey=${signKey}&timestamp=${timestamp}`);

    const params = new URLSearchParams({
      authToken,
      timestamp,
      mid: mid ?? (process.env.INICIS_MID ?? "INIpayTest"),
      oid: oid ?? "",
      price: price ?? "",
      currency: "WON",
      signature,
      verification,
      returnCharSet: "utf-8",
      format: "JSON",
    });

    const netRes = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" },
      body: params.toString(),
    });

    const netText = await netRes.text();
    let net: Record<string, string> = parseBody(netText);
    try {
      const json = JSON.parse(netText);
      if (json.resultCode) Object.assign(net, json);
    } catch { /* ignore */ }

    const netCode = net.resultCode ?? net.P_STATUS;
    if (netCode !== "0000") {
      const msg = net.resultMsg ?? net.P_RMESG1 ?? "결제 승인 실패";
      console.error("[storage-return] netpay failed:", netCode, msg);
      await db
        .from("storage_payments")
        .update({ status: "FAILED", fail_reason: `[${netCode}] ${msg}` })
        .eq("pg_oid", oid);
      return redirectHtml(`/storage/payment/fail?reason=${encodeURIComponent(msg)}&code=${netCode}`);
    }

    tid = net.tid ?? net.TID ?? "";

  } catch (e) {
    console.error("[storage-return] netpay error:", e);

    /* 망취소 시도 */
    if (netCancelUrl && authToken) {
      try {
        const signKey = process.env.INICIS_SIGN_KEY ?? "SU5JTElURV9UUklQTEVERVNfS0VZU1JS";
        const ts = Date.now().toString();
        const IDC_CANCEL: Record<string, string> = {
          fc: "https://fcstdpay.inicis.com/api/netCancel",
          ks: "https://ksstdpay.inicis.com/api/netCancel",
          stg: "https://stgstdpay.inicis.com/api/netCancel",
        };
        const cancelUrl = idc_name ? (IDC_CANCEL[idc_name] ?? netCancelUrl) : netCancelUrl;
        if (cancelUrl) {
          await fetch(cancelUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              mid: mid ?? (process.env.INICIS_MID ?? "INIpayTest"),
              authToken,
              timestamp: ts,
              signature: sha256hex(`authToken=${authToken}&timestamp=${ts}`),
              verification: sha256hex(`authToken=${authToken}&signKey=${signKey ?? ""}&timestamp=${ts}`),
              charset: "UTF-8",
              format: "JSON",
            }).toString(),
          });
        }
      } catch (ncErr) {
        console.error("[storage-return] netCancel error:", ncErr);
      }
    }

    await db
      .from("storage_payments")
      .update({ status: "FAILED", fail_reason: "승인 처리 오류" })
      .eq("pg_oid", oid);
    return redirectHtml("/storage/payment/fail?reason=approval_error");
  }

  /* ── 5. DB 업데이트 (결제 성공) ── */
  const now = new Date().toISOString();

  await db
    .from("storage_payments")
    .update({
      status: "PAID",
      pg_tid: tid,
      approved_at: now,
    })
    .eq("pg_oid", oid);

  /* 수거비 결제 완료 → 스토리지 활성화 */
  if (paymentRec.payment_type === "PICKUP_FEE") {
    await db
      .from("customer_storages")
      .update({ status: "ACTIVE", updated_at: now })
      .eq("id", paymentRec.storage_id);
  }

  /* 단기보관 정산 완료 → 스토리지 EMPTY 처리 */
  if (paymentRec.payment_type === "SHORT_TERM_STORAGE") {
    await db
      .from("customer_storages")
      .update({ status: "EMPTY", updated_at: now })
      .eq("id", paymentRec.storage_id);
  }

  /* ── 6. 성공 페이지 리다이렉트 ── */
  const successUrl = `/storage/payment/success?oid=${encodeURIComponent(oid)}&amount=${encodeURIComponent(price ?? "")}&tid=${encodeURIComponent(tid)}&storage_id=${encodeURIComponent(paymentRec.storage_id)}&type=${encodeURIComponent(paymentRec.payment_type)}`;
  return redirectHtml(successUrl);
}
