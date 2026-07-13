"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle, Loader2, CreditCard } from "lucide-react";
import { Suspense } from "react";

function CompleteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const subId  = params.get("id") ?? "";

  const [charging, setCharging]     = useState(false);
  const [chargeResult, setChargeResult] = useState<"success" | "error" | null>(null);
  const [chargeMsg, setChargeMsg]   = useState("");

  async function handleCharge() {
    if (!subId || charging) return;
    setCharging(true);
    setChargeResult(null);
    try {
      const res = await fetch("/api/shop/billing/charge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sub_id: subId }),
      });
      const data = await res.json() as { ok?: boolean; error?: string; amount?: number };
      if (res.ok && data.ok) {
        setChargeResult("success");
        setChargeMsg(`${(data.amount ?? 9900).toLocaleString()}원 결제가 완료되었습니다.`);
      } else {
        setChargeResult("error");
        setChargeMsg(data.error ?? "결제에 실패했습니다.");
      }
    } catch {
      setChargeResult("error");
      setChargeMsg("결제 중 오류가 발생했습니다.");
    } finally {
      setCharging(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-base font-bold text-gray-900">구독 완료</h1>
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-4">
        {/* 성공 아이콘 */}
        <div className="flex flex-col items-center gap-3 py-6">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle size={40} className="text-green-500" />
          </div>
          <p className="text-xl font-bold text-gray-900">카드 등록 완료!</p>
          <p className="text-sm text-gray-500 text-center leading-relaxed">
            자동결제 카드가 성공적으로 등록되었습니다.<br />
            매월 1일에 구독료가 자동으로 청구됩니다.
          </p>
        </div>

        {/* 구독 정보 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
          <p className="text-xs font-bold text-gray-500 mb-3">구독 정보</p>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
            <span className="text-sm text-gray-600">플랜</span>
            <span className="text-sm font-semibold text-gray-900">보관함 기본 구독</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
            <span className="text-sm text-gray-600">월 구독료</span>
            <span className="text-sm font-bold text-[#de2910]">9,900원</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
            <span className="text-sm text-gray-600">결제일</span>
            <span className="text-sm text-gray-900">매월 1일</span>
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-gray-600">해지 방법</span>
            <span className="text-sm text-gray-900">고객센터 문의</span>
          </div>
        </div>

        {/* 유의사항 */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 space-y-1">
          <p className="text-xs font-bold text-gray-600">구독 유의사항</p>
          <ul className="text-xs text-gray-500 space-y-0.5 list-disc list-inside leading-relaxed">
            <li>구독 해지는 고객센터(010-2723-9490) 또는 서비스 내 해지 메뉴에서 가능합니다.</li>
            <li>결제일 기준 7일 이내 해지 시 전액 환불됩니다.</li>
            <li>이후 해지 시 잔여 일수 비례 환불됩니다.</li>
            <li>결제 실패 시 3일 이내 재청구되며, 반복 실패 시 구독이 일시 중단됩니다.</li>
          </ul>
        </div>

        {/* 첫 결제 테스트 */}
        {subId && chargeResult !== "success" && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500">첫 달 결제</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              등록한 카드로 첫 달 구독료를 지금 바로 결제할 수 있습니다.
            </p>
            {chargeResult === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <p className="text-xs text-red-600">{chargeMsg}</p>
              </div>
            )}
            <button
              onClick={handleCharge}
              disabled={charging}
              className="w-full bg-gray-900 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition-opacity"
            >
              {charging ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
              {charging ? "결제 중..." : "9,900원 첫 달 결제하기"}
            </button>
          </div>
        )}

        {/* 결제 성공 메시지 */}
        {chargeResult === "success" && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-4 flex items-center gap-3">
            <CheckCircle size={20} className="text-green-500 shrink-0" />
            <p className="text-sm text-green-700 font-semibold">{chargeMsg}</p>
          </div>
        )}

        {/* 버튼 */}
        <button
          onClick={() => router.push("/shop")}
          className="w-full bg-[#de2910] text-white font-bold py-4 rounded-2xl text-sm active:opacity-80 transition-opacity"
        >
          쇼핑 계속하기
        </button>

        <button
          onClick={() => router.push("/home")}
          className="w-full text-sm text-gray-500 underline text-center"
        >
          내 서비스 바로가기
        </button>
      </div>
    </div>
  );
}

export default function ShopBillingCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-300" />
      </div>
    }>
      <CompleteContent />
    </Suspense>
  );
}
