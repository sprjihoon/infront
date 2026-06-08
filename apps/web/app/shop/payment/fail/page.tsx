"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { XCircle, Loader2 } from "lucide-react";
import { useLanguage } from "../../useLanguage";
import { t } from "../../translations";

function FailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useLanguage();
  const tx = t[lang];

  /* PortOne v2 리다이렉트 파라미터 */
  const code = searchParams.get("code");
  const message = searchParams.get("message");

  const displayMsg = message ?? (
    lang === "en"
      ? "Payment was cancelled or an error occurred."
      : "결제가 취소되었거나 오류가 발생했습니다."
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
        <XCircle size={36} className="text-red-400" />
      </div>
      <h1 className="text-lg font-bold text-gray-900">{tx.payFail}</h1>
      <p className="text-sm text-gray-500 text-center">{displayMsg}</p>
      {code && (
        <p className="text-xs text-gray-400">코드: {code}</p>
      )}
      <button
        onClick={() => router.replace("/shop")}
        className="mt-2 px-6 py-3 bg-[#de2910] text-white text-sm font-bold rounded-xl"
      >
        {tx.goBack}
      </button>
    </div>
  );
}

export default function FailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    }>
      <FailContent />
    </Suspense>
  );
}
