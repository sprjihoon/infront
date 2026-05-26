"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function PaymentSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey");
    const orderId    = searchParams.get("orderId");
    const amount     = searchParams.get("amount");

    if (!paymentKey || !orderId || !amount) {
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      setStatus("error");
      return;
    }

    fetch("/api/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount: parseInt(amount, 10) }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus("success");
          setTimeout(() => router.push(`/orders`), 3000);
        } else {
          setErrorMsg(data.error ?? "결제 확인에 실패했습니다.");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("서버 오류가 발생했습니다.");
        setStatus("error");
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      {status === "loading" && (
        <>
          <Loader2 size={48} className="text-brand-500 animate-spin mb-4" />
          <p className="text-base font-bold text-gray-900 mb-1">결제 확인 중...</p>
          <p className="text-sm text-gray-400">잠시만 기다려주세요</p>
        </>
      )}
      {status === "success" && (
        <>
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
            <CheckCircle size={42} className="text-green-500" />
          </div>
          <p className="text-xl font-bold text-gray-900 mb-2">결제 완료!</p>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            결제가 성공적으로 완료되었습니다.<br />배송 준비를 시작합니다.
          </p>
          <button
            onClick={() => router.push("/orders")}
            className="bg-brand-600 text-white font-bold px-8 py-3.5 rounded-2xl text-sm"
          >
            배송현황 보기
          </button>
          <p className="text-xs text-gray-400 mt-4">3초 후 자동으로 이동합니다</p>
        </>
      )}
      {status === "error" && (
        <>
          <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
            <XCircle size={42} className="text-red-400" />
          </div>
          <p className="text-xl font-bold text-gray-900 mb-2">결제 실패</p>
          <p className="text-sm text-gray-500 mb-2">{errorMsg}</p>
          <p className="text-xs text-gray-400 mb-8">
            문제가 지속되면 고객센터로 문의해주세요.
          </p>
          <button
            onClick={() => router.push("/orders")}
            className="bg-gray-700 text-white font-bold px-8 py-3.5 rounded-2xl text-sm"
          >
            주문 목록으로
          </button>
        </>
      )}
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    }>
      <PaymentSuccessContent />
    </Suspense>
  );
}
