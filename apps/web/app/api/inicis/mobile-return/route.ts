import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/* ────────────────────────────────────────────────────────────────
   KG이니시스 모바일 결제 결과 처리 (P_NEXT_URL POST)
   모바일 성공코드: P_STATUS === "00" (2자리, PC의 "0000"과 다름)
   승인요청: P_REQ_URL에 { P_MID, P_TID } POST
──────────────────────────────────────────────────────────────── */

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function redirectHtml(url: string): NextResponse {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head><body>
<script>window.location.replace(${JSON.stringify(url)});</script>
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
    const text = await request.text();
    fields = parseBody(text);
  } catch {
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("응답 파싱 오류"));
  }

  const { P_STATUS, P_RMESG1, P_TID, P_AMT, P_OID, P_REQ_URL, idc_name } = fields;

  /* 인증 실패 */
  if (P_STATUS !== "00") {
    const msg = P_RMESG1 ?? "결제 인증 실패";
    console.error("[inicis/mobile-return] auth failed:", P_STATUS, msg);
    return redirectHtml(`/shop/payment/fail?message=${encodeURIComponent(msg)}&code=${P_STATUS}`);
  }

  if (!P_TID || !P_REQ_URL) {
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("인증 토큰 누락"));
  }

  /* idc_name으로 P_REQ_URL 검증 */
  const IDC_MOBILE: Record<string, string> = {
    fc:  "https://fcmobile.inicis.com/smart/payAction",
    ks:  "https://ksmobile.inicis.com/smart/payAction",
    stg: "https://stgmobile.inicis.com/smart/payAction",
  };
  const expectedUrl = idc_name ? IDC_MOBILE[idc_name] : null;
  if (expectedUrl && P_REQ_URL !== expectedUrl) {
    console.error("[inicis/mobile-return] P_REQ_URL mismatch:", P_REQ_URL, "expected:", expectedUrl);
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("승인 URL 검증 실패"));
  }

  /* 모바일 승인요청: P_MID + P_TID 만 전송 */
  try {
    const mid = P_TID.substring(10, 20); // TID에서 MID 추출
    const params = new URLSearchParams({ P_MID: mid, P_TID });

    const approvalRes = await fetch(P_REQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const resText = await approvalRes.text();
    const result = parseBody(resText);

    const resStatus = result.P_STATUS ?? result.resultCode;

    if (resStatus !== "00" && resStatus !== "0000") {
      const msg = result.P_RMESG1 ?? result.resultMsg ?? "결제 승인 실패";
      console.error("[inicis/mobile-return] approval failed:", resStatus, msg);
      return redirectHtml(`/shop/payment/fail?message=${encodeURIComponent(msg)}&code=${resStatus}`);
    }

    const tid = result.P_TID ?? result.tid ?? P_TID;
    const successUrl = `/shop/payment/success?paymentId=${encodeURIComponent(P_OID ?? "")}&amount=${encodeURIComponent(P_AMT ?? "")}&tid=${encodeURIComponent(tid)}&verified=1`;

    /* shop_order 결제 완료 처리 */
    const admin = createAdminClient();
    if (admin && P_OID) {
      const { error: updErr } = await admin
        .from("shop_orders")
        .update({ status: "PAID", inicis_tid: tid, paid_at: new Date().toISOString() })
        .eq("oid", P_OID);
      if (updErr) {
        console.error("[inicis/mobile-return] shop_order update error:", updErr.message);
      }
    }

    return redirectHtml(successUrl);

  } catch (e) {
    console.error("[inicis/mobile-return] approval error:", e);
    /* 망취소 */
    try {
      const mid = P_TID.substring(10, 20);
      const cancelUrl = P_REQ_URL.replace(/\/[^/]+$/, "/payNetCancel.ini");
      await fetch(cancelUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ P_TID, P_MID: mid, P_AMT: P_AMT ?? "", P_OID: P_OID ?? "" }).toString(),
      });
    } catch (ncErr) {
      console.error("[inicis/mobile-return] netCancel error:", ncErr);
    }
    return redirectHtml("/shop/payment/fail?message=" + encodeURIComponent("승인 처리 오류"));
  }
}
