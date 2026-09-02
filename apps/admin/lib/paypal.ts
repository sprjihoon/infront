const SANDBOX = "https://api-m.sandbox.paypal.com";
const LIVE = "https://api-m.paypal.com";

function apiBase() {
  return process.env.PAYPAL_ENV === "live" ? LIVE : SANDBOX;
}

async function accessToken(): Promise<string> {
  const id = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? process.env.PAYPAL_CLIENT_ID ?? "").trim();
  const secret = (process.env.PAYPAL_CLIENT_SECRET ?? "").trim();
  if (!id || !secret) throw new Error("PayPal 환경변수 미설정");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal 토큰 실패");
  return data.access_token;
}

export async function refundPaypalCapture(captureId: string, note?: string): Promise<void> {
  const token = await accessToken();
  const res = await fetch(
    `${apiBase()}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ note_to_payer: (note ?? "Refund").slice(0, 255) }),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? "PayPal 환불 실패");
  }
}

export async function cancelPaypalSubscription(subscriptionId: string, reason: string): Promise<void> {
  const token = await accessToken();
  const res = await fetch(
    `${apiBase()}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: reason.slice(0, 128) }),
    },
  );
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? "PayPal 구독 해지 실패");
  }
}
