"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2 } from "lucide-react";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  const orderId = searchParams.get("order_id") ?? searchParams.get("orderId") ?? "-";
  const amount = searchParams.get("amount") ?? "-";

  useEffect(() => {
    const resCd = searchParams.get("res_cd");
    const resMsg = searchParams.get("res_msg");

    if (resCd !== null) {
      /* Eximbay return_url 응답 처리 */
      if (resCd === "0000") {
        setStatus("done");
      } else {
        setErrorMsg(resMsg ?? `결제 실패 (코드: ${resCd})`);
        setStatus("error");
      }
      return;
    }

    /* 구 Toss 파라미터 호환 (paymentKey가 있을 경우) */
    const paymentKey = searchParams.get("paymentKey");
    const productId = searchParams.get("productId");
    const amountStr = searchParams.get("amount");

    if (!paymentKey || !orderId || orderId === "-" || !amountStr || !productId) {
      setErrorMsg("결제 정보가 올바르지 않습니다.");
      setStatus("error");
      return;
    }

    fetch("/api/shop/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: parseInt(amountStr, 10),
        productId,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStatus("done");
        else {
          setErrorMsg(data.error ?? "결제 확인 실패");
          setStatus("error");
        }
      })
      .catch(() => {
        setErrorMsg("서버 오류가 발생했습니다.");
        setStatus("error");
      });
  }, [searchParams, orderId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={40} className="text-[#de2910] animate-spin" />
            <p className="text-sm font-semibold text-gray-700">결제 확인 중...</p>
            <p className="text-xs text-gray-400">잠시만 기다려주세요</p>
          </div>
        )}
        {status === "error" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
              <span className="text-3xl">❌</span>
            </div>
            <p className="text-lg font-bold text-gray-900">결제 실패</p>
            <p className="text-sm text-gray-500">{errorMsg}</p>
            <button
              onClick={() => router.replace("/shop")}
              className="mt-4 bg-gray-800 text-white font-bold px-6 py-3 rounded-2xl text-sm"
            >
              상품 목록으로
            </button>
          </div>
        )}
        {status === "done" && (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-2">
              <CheckCircle size={44} className="text-green-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">결제 완료!</p>
            <p className="text-sm text-gray-500 leading-relaxed">
              포장대행 서비스 결제가 완료되었습니다.<br />
              빠른 시일 내에 처리해 드리겠습니다.
            </p>
            <div className="w-full bg-gray-50 rounded-2xl p-4 mt-2 text-left space-y-1.5">
              {orderId !== "-" && (
                <p className="text-xs text-gray-500">
                  주문번호: <span className="font-medium text-gray-700">{orderId}</span>
                </p>
              )}
              {amount !== "-" && (
                <p className="text-xs text-gray-500">
                  결제금액:{" "}
                  <span className="font-medium text-gray-700">
                    {parseInt(amount).toLocaleString()}원
                  </span>
                </p>
              )}
            </div>
            <button
              onClick={() => router.replace("/shop")}
              className="mt-2 bg-[#de2910] text-white font-bold px-8 py-3.5 rounded-2xl text-sm w-full"
            >
              쇼핑 계속하기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShopPaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#de2910]" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
