"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { useLanguage } from "../../useLanguage";
import { t } from "../../translations";

type Status = "loading" | "done" | "error";

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { lang } = useLanguage();
  const tx = t[lang];

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string | null>(null);

  useEffect(() => {
    const pId = searchParams.get("paymentId");
    const amt = searchParams.get("amount");
    const code = searchParams.get("code"); // PortOne 에러 코드 (실패 시)
    const message = searchParams.get("message");

    /* PortOne 결제 실패 리다이렉트 */
    if (code) {
      setErrorMsg(message ?? `결제 실패 (${code})`);
      setStatus("error");
      return;
    }

    if (!pId) {
      setErrorMsg(tx.invalidPayment);
      setStatus("error");
      return;
    }

    setPaymentId(pId);
    setAmount(amt);

    /* 서버에서 결제 검증 */
    (async () => {
      try {
        const res = await fetch("/api/portone/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: pId, expectedAmount: amt ? Number(amt) : undefined }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setErrorMsg(data.error ?? tx.payFail);
          setStatus("error");
        } else {
          setStatus("done");
        }
      } catch {
        setErrorMsg(tx.payError);
        setStatus("error");
      }
    })();
  }, [searchParams, tx.invalidPayment, tx.payFail, tx.payError]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
          <XCircle size={36} className="text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-gray-900">{tx.payFail}</h1>
        <p className="text-sm text-gray-500 text-center">{errorMsg}</p>
        <button
          onClick={() => router.replace("/shop")}
          className="mt-2 px-6 py-3 bg-[#de2910] text-white text-sm font-bold rounded-xl"
        >
          {tx.goBack}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 gap-4">
      <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
        <CheckCircle size={36} className="text-green-500" />
      </div>
      <h1 className="text-lg font-bold text-gray-900">{tx.paySuccess}</h1>
      {amount && (
        <p className="text-2xl font-bold text-[#de2910]">
          {Number(amount).toLocaleString()}원
        </p>
      )}
      {paymentId && (
        <p className="text-xs text-gray-400">{tx.orderNo} {paymentId}</p>
      )}
      <p className="text-sm text-gray-500 text-center">{tx.successMsg}</p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={() => router.replace("/shop")}
          className="px-6 py-3 bg-[#de2910] text-white text-sm font-bold rounded-xl"
        >
          {tx.goBack}
        </button>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
