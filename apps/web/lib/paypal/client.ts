const SANDBOX = "https://api-m.sandbox.paypal.com";
const LIVE = "https://api-m.paypal.com";

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

export function paypalEnv(): "sandbox" | "live" {
  return process.env.PAYPAL_ENV === "live" ? "live" : "sandbox";
}

export function paypalApiBase(): string {
  return paypalEnv() === "live" ? LIVE : SANDBOX;
}

export function paypalClientId(): string {
  return (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "").trim();
}

function paypalSecret(): string {
  return (process.env.PAYPAL_CLIENT_SECRET ?? "").trim();
}

export function paypalConfigured(): boolean {
  return Boolean(paypalClientId() && paypalSecret());
}

export async function paypalAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 30_000) {
    return tokenCache.token;
  }
  const id = paypalClientId();
  const secret = paypalSecret();
  if (!id || !secret) {
    throw new Error("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET 미설정");
  }
  const res = await fetch(`${paypalApiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(data.error ?? "PayPal 토큰 발급 실패");
  }
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 300) * 1000,
  };
  return data.access_token;
}

export async function paypalFetch<T = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const token = await paypalAccessToken();
  const res = await fetch(`${paypalApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let data = {} as T;
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = { raw: text } as T;
    }
  }
  return { ok: res.ok, status: res.status, data };
}

export async function createPaypalOrder(params: {
  oid: string;
  customId: string;
  description: string;
  amountUsd: string;
}): Promise<{ id: string }> {
  const { ok, data } = await paypalFetch<{ id?: string; message?: string }>(
    "/v2/checkout/orders",
    {
      method: "POST",
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: params.oid,
            custom_id: params.customId,
            description: params.description.slice(0, 127),
            amount: { currency_code: "USD", value: params.amountUsd },
          },
        ],
      }),
    },
  );
  if (!ok || !data.id) {
    throw new Error(data.message ?? "PayPal 주문 생성 실패");
  }
  return { id: data.id };
}

export async function capturePaypalOrder(orderId: string): Promise<{
  status: string;
  captureId?: string;
  amountUsd?: string;
  customId?: string;
  referenceId?: string;
}> {
  const { ok, data } = await paypalFetch<{
    status?: string;
    message?: string;
    purchase_units?: Array<{
      reference_id?: string;
      payments?: {
        captures?: Array<{
          id?: string;
          status?: string;
          amount?: { value?: string };
          custom_id?: string;
        }>;
      };
    }>;
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: "POST",
    body: "{}",
  });
  if (!ok) {
    throw new Error(data.message ?? "PayPal 캡처 실패");
  }
  const unit = data.purchase_units?.[0];
  const capture = unit?.payments?.captures?.[0];
  return {
    status: data.status ?? "",
    captureId: capture?.id,
    amountUsd: capture?.amount?.value,
    customId: capture?.custom_id,
    referenceId: unit?.reference_id,
  };
}

export async function refundPaypalCapture(captureId: string, note?: string): Promise<void> {
  const { ok, data } = await paypalFetch<{ message?: string }>(
    `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: "POST",
      body: JSON.stringify({ note_to_payer: (note ?? "Refund").slice(0, 255) }),
    },
  );
  if (!ok) {
    throw new Error(data.message ?? "PayPal 환불 실패");
  }
}

export async function createPaypalMonthlyPlan(params: {
  name: string;
  description: string;
  amountUsd: string;
}): Promise<{ productId: string; planId: string }> {
  const product = await paypalFetch<{ id?: string; message?: string }>("/v1/catalogs/products", {
    method: "POST",
    body: JSON.stringify({
      name: params.name.slice(0, 127),
      description: params.description.slice(0, 256),
      type: "SERVICE",
      category: "SHIPPING",
    }),
  });
  if (!product.ok || !product.data.id) {
    throw new Error(product.data.message ?? "PayPal 상품 생성 실패");
  }
  const plan = await paypalFetch<{ id?: string; message?: string }>("/v1/billing/plans", {
    method: "POST",
    body: JSON.stringify({
      product_id: product.data.id,
      name: params.name.slice(0, 127),
      description: params.description.slice(0, 127),
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: { value: params.amountUsd, currency_code: "USD" },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 3,
      },
    }),
  });
  if (!plan.ok || !plan.data.id) {
    throw new Error(plan.data.message ?? "PayPal 플랜 생성 실패");
  }
  return { productId: product.data.id, planId: plan.data.id };
}

export async function cancelPaypalSubscription(subscriptionId: string, reason: string): Promise<void> {
  const { ok, data } = await paypalFetch<{ message?: string }>(
    `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ reason: reason.slice(0, 128) }),
    },
  );
  if (!ok && data.message) {
    throw new Error(data.message);
  }
}

export async function verifyPaypalWebhook(
  headers: Headers,
  rawBody: string,
): Promise<boolean> {
  const webhookId = (process.env.PAYPAL_WEBHOOK_ID ?? "").trim();
  if (!webhookId) {
    console.warn("[paypal/webhook] PAYPAL_WEBHOOK_ID 미설정 — 서명 검증 생략");
    return true;
  }
  const { ok, data } = await paypalFetch<{ verification_status?: string }>(
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: headers.get("paypal-auth-algo"),
        cert_url: headers.get("paypal-cert-url"),
        transmission_id: headers.get("paypal-transmission-id"),
        transmission_sig: headers.get("paypal-transmission-sig"),
        transmission_time: headers.get("paypal-transmission-time"),
        webhook_id: webhookId,
        webhook_event: JSON.parse(rawBody),
      }),
    },
  );
  return ok && data.verification_status === "SUCCESS";
}
