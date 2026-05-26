"use client";

import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { OrderSummary } from "@/lib/order-display";

export default function PaymentButton({ order }: { order: OrderSummary }) {
  const [loading, setLoading] = useState(false);

  async function handlePayment() {
    setLoading(true);
    try {
      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        alert("결제 설정이 완료되지 않았습니다. 관리자에게 문의하세요.");
        return;
      }
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: user.id });

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: order.total_amount },
        orderId: order.order_no,
        orderName: `인프론트 해외배송 ${order.order_no}`,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
      });
    } catch (e) {
      console.error(e);
      alert("결제 초기화에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePayment}
      disabled={loading}
      className="flex items-center gap-1.5 bg-brand-600 text-white text-xs font-bold px-3.5 py-2 rounded-xl disabled:opacity-60"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
      결제하기
    </button>
  );
}
