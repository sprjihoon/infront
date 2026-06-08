"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle, Package, ArrowRight, Home } from "lucide-react";

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  PICKUP_FEE:           "수거비",
  SHORT_TERM_STORAGE:   "단기보관 정산",
  RELEASE_FEE:          "출고 처리비",
};

function SuccessContent() {
  const params = useSearchParams();
  const router = useRouter();
  const amount = params.get("amount");
  const storageId = params.get("storage_id");
  const paymentType = params.get("type") ?? "PICKUP_FEE";
  const tid = params.get("tid");

  const isPickup = paymentType === "PICKUP_FEE";
  const isRelease = paymentType === "SHORT_TERM_STORAGE";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
        {/* 성공 아이콘 */}
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={32} className="text-green-500" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-1">결제 완료</h1>
        <p className="text-sm text-gray-500 mb-6">
          {PAYMENT_TYPE_LABELS[paymentType] ?? "결제"} 처리가 완료되었습니다.
        </p>

        {amount && (
          <div className="bg-gray-50 rounded-2xl p-4 mb-5">
            <p className="text-xs text-gray-400 mb-1">결제 금액</p>
            <p className="text-2xl font-black text-brand-600">
              {Number(amount).toLocaleString()}원
            </p>
            {tid && (
              <p className="text-[10px] text-gray-400 mt-2 font-mono">{tid}</p>
            )}
          </div>
        )}

        {/* 다음 단계 안내 */}
        <div className="bg-blue-50 rounded-2xl p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-2">
            <Package size={14} className="text-blue-600" />
            <p className="text-xs font-bold text-blue-700">다음 안내</p>
          </div>
          {isPickup ? (
            <ul className="space-y-1.5">
              {[
                "수거 일정은 영업일 기준 1~2일 내 별도 연락 드립니다.",
                "수거 완료 후 검품·입고 처리 후 앱에서 확인하실 수 있습니다.",
                "추가 검품·사진 촬영 서비스는 수거 후 별도 신청 가능합니다.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span className="text-xs text-blue-700">{t}</span>
                </li>
              ))}
            </ul>
          ) : isRelease ? (
            <ul className="space-y-1.5">
              {[
                "보관료 정산이 완료되었습니다.",
                "출고 처리는 1 영업일 내 진행됩니다.",
                "배송 정보는 별도 안내됩니다.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-1.5">
                  <span className="text-blue-400 mt-0.5">•</span>
                  <span className="text-xs text-blue-700">{t}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-blue-700">결제 관련 문의: support@infront.kr</p>
          )}
        </div>

        <div className="space-y-2">
          {storageId && (
            <button
              onClick={() => router.push(`/storage/${storageId}`)}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 text-white text-sm font-bold py-3.5 rounded-2xl"
            >
              <Package size={16} />
              내 스토리지 확인
              <ArrowRight size={16} />
            </button>
          )}
          <button
            onClick={() => router.push("/storage")}
            className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 text-sm font-semibold py-3 rounded-2xl"
          >
            <Home size={15} />
            보관 서비스 목록
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoragePaymentSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-400">처리 중...</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
