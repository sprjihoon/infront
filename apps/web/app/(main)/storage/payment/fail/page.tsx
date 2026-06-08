"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { XCircle, ArrowLeft, RotateCcw } from "lucide-react";

function FailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const reason = params.get("reason") ?? "알 수 없는 오류가 발생했습니다.";
  const code = params.get("code");
  const isClosed = reason === "close";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <XCircle size={32} className="text-red-400" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">
          {isClosed ? "결제 취소" : "결제 실패"}
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          {isClosed
            ? "결제창을 닫으셨습니다."
            : "결제 처리 중 문제가 발생했습니다."}
        </p>

        {!isClosed && (
          <div className="bg-red-50 rounded-2xl p-3 mb-5 text-left">
            <p className="text-xs text-red-700">{decodeURIComponent(reason)}</p>
            {code && <p className="text-[10px] text-red-400 mt-1">오류 코드: {code}</p>}
          </div>
        )}

        <p className="text-xs text-gray-400 mb-6">
          문제가 계속되면 고객센터로 문의해 주세요.
          <br />
          <a href="mailto:support@infront.kr" className="text-brand-600 underline">
            support@infront.kr
          </a>
        </p>

        <div className="space-y-2">
          <button
            onClick={() => router.back()}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white text-sm font-bold py-3.5 rounded-2xl"
          >
            <RotateCcw size={15} />
            다시 시도
          </button>
          <button
            onClick={() => router.push("/storage")}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 text-sm font-semibold py-3 rounded-2xl"
          >
            <ArrowLeft size={15} />
            보관 서비스 목록
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoragePaymentFailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">처리 중...</p>
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
