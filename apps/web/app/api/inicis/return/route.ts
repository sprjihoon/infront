import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 결제 결과 처리 (returnUrl POST)
   1. KG이니시스가 인증 결과를 POST로 전송
   2. 서버에서 authUrl에 최종 승인 요청 (네트결제)
   3. 결과에 따라 success/fail 페이지로 iframe 부모창 리다이렉트
──────────────────────────────────────────────────────────────── */

function sha256hex(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** iframe 오버레이 또는 리다이렉트 방식 모두 처리 */
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
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("응답 파싱 오류"));
  }

  const { resultCode, resultMsg, authToken, authUrl, idc_name, netCancelUrl, mid, oid, price } = fields;

  /* 인증 단계 실패 */
  if (resultCode !== "0000") {
    const msg = resultMsg ?? "결제 인증 실패";
    console.error("[inicis/return] auth failed:", resultCode, msg);
    return redirectHtml(`/shop/payment/fail?message=${encodeURIComponent(msg)}&code=${resultCode}`);
  }

  if (!authToken || !authUrl) {
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("인증 토큰 누락"));
  }

  /* idc_name으로 authUrl 검증 (보안) */
  const IDC_URLS: Record<string, string> = {
    fc:  "https://fcstdpay.inicis.com/api/payAuth",
    ks:  "https://ksstdpay.inicis.com/api/payAuth",
    stg: "https://stgstdpay.inicis.com/api/payAuth",
  };
  const expectedAuthUrl = idc_name ? IDC_URLS[idc_name] : null;
  if (expectedAuthUrl && authUrl !== expectedAuthUrl) {
    console.error("[inicis/return] authUrl mismatch:", authUrl, "expected:", expectedAuthUrl);
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("승인 URL 검증 실패"));
  }

  /* ── 네트결제 승인 요청 ── */
  try {
    const signKey = (process.env.INICIS_SIGN_KEY ?? "").trim();
    const timestamp = Date.now().toString();

    /*
     * KG이니시스 공식 스펙 (manual.inicis.com/pay/)
     * signature  = SHA256(authToken={authToken}&timestamp={timestamp})   ← 알파벳 순 NVP
     * verification = SHA256(authToken={authToken}&signKey={signKey}&timestamp={timestamp})
     */
    const signature = sha256hex(`authToken=${authToken}&timestamp=${timestamp}`);
    const verification = sha256hex(`authToken=${authToken}&signKey=${signKey}&timestamp=${timestamp}`);

    const params = new URLSearchParams({
      authToken,
      timestamp,
      mid: (mid ?? (process.env.INICIS_MID ?? "INIpayTest")).trim(),
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

    /* KG이니시스 응답은 URL-encoded 또는 JSON */
    let net: Record<string, string> = parseBody(netText);
    try {
      const json = JSON.parse(netText);
      if (json.resultCode) Object.assign(net, json);
    } catch { /* ignore */ }

    const netCode = net.resultCode ?? net.P_STATUS;

    if (netCode !== "0000") {
      const msg = net.resultMsg ?? net.P_RMESG1 ?? "결제 승인 실패";
      console.error("[inicis/return] netpay failed:", netCode, msg);
      return redirectHtml(
        `/shop/payment/fail?message=${encodeURIComponent(msg)}&code=${netCode}`
      );
    }

    const tid = net.tid ?? net.TID ?? net.P_TID ?? "";
    const successUrl = `/shop/payment/success?paymentId=${encodeURIComponent(oid ?? "")}&amount=${encodeURIComponent(price ?? "")}&tid=${encodeURIComponent(tid)}&verified=1`;

    /* shop_order 결제 완료 처리 */
    const admin = createAdminClient();
    if (admin && oid) {
      const { error: updErr } = await admin
        .from("shop_orders")
        .update({ status: "PAID", inicis_tid: tid, paid_at: new Date().toISOString() })
        .eq("oid", oid);
      if (updErr) {
        console.error("[inicis/return] shop_order update error:", updErr.message);
      }
    }

    return redirectHtml(successUrl);

  } catch (e) {
    console.error("[inicis/return] netpay error:", e);
    /* 망취소 시도 */
    if (netCancelUrl && authToken) {
      try {
        const signKey = (process.env.INICIS_SIGN_KEY ?? "").trim();
        const ts = Date.now().toString();
        const ncParams = new URLSearchParams({
          mid: (mid ?? (process.env.INICIS_MID ?? "INIpayTest")).trim(),
          authToken,
          timestamp: ts,
          signature: sha256hex(`authToken=${authToken}&timestamp=${ts}`),
          verification: sha256hex(`authToken=${authToken}&signKey=${signKey}&timestamp=${ts}`),
          charset: "UTF-8",
          format: "JSON",
        });
        const IDC_CANCEL: Record<string, string> = {
          fc: "https://fcstdpay.inicis.com/api/netCancel",
          ks: "https://ksstdpay.inicis.com/api/netCancel",
          stg: "https://stgstdpay.inicis.com/api/netCancel",
        };
        const cancelUrl = idc_name ? (IDC_CANCEL[idc_name] ?? netCancelUrl) : netCancelUrl;
        if (cancelUrl) await fetch(cancelUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: ncParams.toString() });
      } catch (ncErr) {
        console.error("[inicis/return] netCancel error:", ncErr);
      }
    }
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("승인 처리 오류"));
  }
}
