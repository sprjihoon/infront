import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 결제 결과 처리 (returnUrl POST)
   1. KG이니시스가 인증 결과를 POST로 전송
   2. 서버에서 authUrl에 최종 승인 요청 (네트결제)
   3. 결과에 따라 success/fail 페이지로 iframe 부모창 리다이렉트
──────────────────────────────────────────────────────────────── */

function sha256hex(str: string): string {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
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

  const { resultCode, resultMsg, authToken, authUrl, mid, oid, price } = fields;

  /* 인증 단계 실패 */
  if (resultCode !== "00") {
    const msg = resultMsg ?? "결제 인증 실패";
    console.error("[inicis/return] auth failed:", resultCode, msg);
    return redirectHtml(`/shop/payment/fail?message=${encodeURIComponent(msg)}&code=${resultCode}`);
  }

  if (!authToken || !authUrl) {
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("인증 토큰 누락"));
  }

  /* ── 네트결제 승인 요청 ── */
  try {
    const timestamp = Date.now().toString();
    /* KG이니시스 signature: authToken + oid + price + timestamp 순서 */
    const signature = sha256hex(`authToken=${authToken}&timestamp=${timestamp}&mid=${mid}&price=${price}`);

    const params = new URLSearchParams({
      authToken,
      timestamp,
      mid: mid ?? (process.env.INICIS_MID ?? "INIpayTest"),
      oid: oid ?? "",
      price: price ?? "",
      currency: "WON",
      signature,
      returnCharSet: "utf-8",
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

    if (netCode !== "00") {
      const msg = net.resultMsg ?? net.P_RMESG1 ?? "결제 승인 실패";
      console.error("[inicis/return] netpay failed:", netCode, msg);
      return redirectHtml(
        `/shop/payment/fail?message=${encodeURIComponent(msg)}&code=${netCode}`
      );
    }

    const tid = net.tid ?? net.TID ?? net.P_TID ?? "";
    const successUrl = `/shop/payment/success?paymentId=${encodeURIComponent(oid ?? "")}&amount=${encodeURIComponent(price ?? "")}&tid=${encodeURIComponent(tid)}&verified=1`;
    return redirectHtml(successUrl);

  } catch (e) {
    console.error("[inicis/return] netpay error:", e);
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("승인 처리 오류"));
  }
}
