"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { XCircle, Loader2 } from "lucide-react";

function FailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const message = searchParams.get("message") ?? "결제가 취소되었거나 오류가 발생했습니다.";
  const code    = searchParams.get("code");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-3 text-center">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-2">
          <XCircle size={44} className="text-red-400" />
        </div>
        <p className="text-xl font-bold text-gray-900">결제 실패</p>
        <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
        {code && (
          <p className="text-xs text-gray-400">오류코드: {code}</p>
        )}
        <p className="text-xs text-gray-400 mt-1">
          문제가 지속되면 고객센터로 문의해 주세요.
        </p>
        <div className="flex flex-col gap-2 mt-4 w-full">
          <button
            onClick={() => router.back()}
            className="w-full bg-[#de2910] text-white font-bold py-3.5 rounded-2xl text-sm"
          >
            다시 시도
          </button>
          <button
            onClick={() => router.replace("/shop")}
            className="w-full bg-gray-100 text-gray-700 font-bold py-3.5 rounded-2xl text-sm"
          >
            상품 목록으로
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShopPaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#de2910]" />
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
