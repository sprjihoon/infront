"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    paypal?: {
      Buttons: (opts: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void> };
    };
  }
}

type OrderProps = {
  mode: "order";
  disabled?: boolean;
  createPayload: Record<string, unknown>;
  onPaid: (result: { oid: string; amountKrw: number; kind: string }) => void;
  onError: (message: string) => void;
};

type SubProps = {
  mode: "subscription";
  disabled?: boolean;
  createPayload: Record<string, unknown>;
  onPaid: (result: { subId?: string; profileId?: string; kind: string }) => void;
  onError: (message: string) => void;
};

type Props = OrderProps | SubProps;

function sdkSrc(intent: "capture" | "subscription"): string {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID ?? "";
  const vault = intent === "subscription" ? "&vault=true" : "";
  return `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=${intent}${vault}`;
}

export function PayPalCheckoutButtons(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID) {
      setMissing(true);
      return;
    }
    const intent = props.mode === "subscription" ? "subscription" : "capture";
    const src = sdkSrc(intent);
    const existing = document.querySelector<HTMLScriptElement>(`script[data-paypal-intent="${intent}"]`);

    function mount() {
      const el = hostRef.current;
      const paypal = window.paypal;
      if (!el || !paypal) return;
      el.innerHTML = "";
      const p = propsRef.current;
      if (p.mode === "order") {
        paypal.Buttons({
          onClick: (_data: unknown, actions: { reject: () => Promise<void> }) => {
            if (p.disabled) return actions.reject();
            return undefined;
          },
          createOrder: async () => {
            const res = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(p.createPayload),
            });
            const data = await res.json();
            if (!res.ok || !data.paypalOrderId) {
              throw new Error(data.error ?? "PayPal 주문 생성 실패");
            }
            return data.paypalOrderId as string;
          },
          onApprove: async (data: { orderID: string }) => {
            const res = await fetch("/api/paypal/capture", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ paypalOrderId: data.orderID }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
              throw new Error(json.error ?? "PayPal 결제 확정 실패");
            }
            p.onPaid({ oid: json.oid, amountKrw: json.amountKrw, kind: json.kind });
          },
          onError: (err: Error) => {
            p.onError(err?.message ?? "PayPal 오류");
          },
        }).render(el).then(() => setReady(true));
        return;
      }

      paypal.Buttons({
        onClick: (_data: unknown, actions: { reject: () => Promise<void> }) => {
          if (p.disabled) return actions.reject();
          return undefined;
        },
        createSubscription: async (_data: unknown, actions: { subscription: { create: (o: { plan_id: string }) => Promise<string> } }) => {
          const res = await fetch("/api/paypal/create-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(p.createPayload),
          });
          const json = await res.json();
          if (!res.ok || !json.planId) {
            throw new Error(json.error ?? "PayPal 구독 생성 실패");
          }
          (el as HTMLDivElement & { _subMeta?: { subId?: string; profileId?: string; kind: string } })._subMeta = {
            subId: json.subId,
            profileId: json.profileId,
            kind: json.kind,
          };
          return actions.subscription.create({ plan_id: json.planId });
        },
        onApprove: async (data: { subscriptionID: string }) => {
          const meta = (el as HTMLDivElement & { _subMeta?: { subId?: string; profileId?: string; kind: string } })._subMeta;
          const res = await fetch("/api/paypal/activate-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              kind: meta?.kind ?? p.createPayload.kind ?? "shop",
              subscriptionId: data.subscriptionID,
              subId: meta?.subId,
              profileId: meta?.profileId,
            }),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            throw new Error(json.error ?? "PayPal 구독 활성화 실패");
          }
          p.onPaid({ subId: meta?.subId, profileId: meta?.profileId, kind: json.kind });
        },
        onError: (err: Error) => {
          p.onError(err?.message ?? "PayPal 오류");
        },
      }).render(el).then(() => setReady(true));
    }

    if (existing && window.paypal) {
      mount();
      return;
    }
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.paypalIntent = intent;
    script.onload = mount;
    script.onerror = () => propsRef.current.onError("PayPal SDK 로드 실패");
    if (!existing) document.head.appendChild(script);
  }, [props.mode]);

  if (missing) {
    return (
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
        PayPal client ID가 설정되지 않았습니다. Vercel에 NEXT_PUBLIC_PAYPAL_CLIENT_ID를 추가하세요.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!ready && (
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400 py-3">
          <Loader2 size={14} className="animate-spin" />
          PayPal 로딩 중...
        </div>
      )}
      <div ref={hostRef} />
    </div>
  );
}
