"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { XCircle } from "lucide-react";
import { Suspense } from "react";

function FailContent() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get("reason") ?? "카드 등록에 실패했습니다.";

  const isClose = reason === "close";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-base font-bold text-gray-900">카드 등록 실패</h1>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 gap-4">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
          <XCircle size={40} className="text-red-400" />
        </div>
        <p className="text-lg font-bold text-gray-900">
          {isClose ? "카드 등록이 취소되었습니다" : "카드 등록에 실패했습니다"}
        </p>
        {!isClose && (
          <p className="text-sm text-gray-500 text-center max-w-xs leading-relaxed">
            {decodeURIComponent(reason)}
          </p>
        )}
        <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
          <button
            onClick={() => router.push("/shop/billing/register")}
            className="w-full bg-[#de2910] text-white font-bold py-3 rounded-2xl text-sm"
          >
            다시 시도하기
          </button>
          <button
            onClick={() => router.push("/shop")}
            className="w-full text-sm text-gray-500 underline text-center"
          >
            쇼핑으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShopBillingFailPage() {
  return (
    <Suspense fallback={null}>
      <FailContent />
    </Suspense>
  );
}
