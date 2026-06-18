"use client";

import { useRouter } from "next/navigation";
import { ChevronRight, Info } from "lucide-react";

export default function InboundPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(60px+var(--sab,0px))]">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-10">
        <h1 className="text-base font-bold text-gray-900">입고신청</h1>
        <p className="text-xs text-gray-400 mt-0.5">보관할 물품을 어떻게 보내시겠어요?</p>
      </div>

      <div className="px-4 py-6 space-y-4 max-w-[600px] mx-auto">

        {/* 카드 1: 수거 신청 */}
        <button
          type="button"
          onClick={() => router.push("/pickup")}
          className="w-full bg-white rounded-2xl border border-gray-100 hover:border-brand-300 active:scale-[0.98] transition-all shadow-sm text-left"
        >
          <div className="flex items-center gap-4 px-5 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/inbound-pickup.png"
              alt="수거 신청"
              className="w-[88px] h-[88px] object-contain shrink-0 drop-shadow-xl"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-lg font-bold text-gray-900">수거 신청</p>
                <ChevronRight size={18} className="text-gray-400 shrink-0" />
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">
                원하는 주소에서<br />물품을 수거해 보관합니다.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">방문 수거</span>
                <span className="text-xs font-semibold text-brand-600 bg-brand-50 px-3 py-1 rounded-full">간편 신청</span>
              </div>
            </div>
          </div>
        </button>

        {/* 카드 2: 직접 보내기 */}
        <button
          type="button"
          onClick={() => router.push("/register-parcel")}
          className="w-full bg-white rounded-2xl border border-gray-100 hover:border-gray-300 active:scale-[0.98] transition-all shadow-sm text-left"
        >
          <div className="flex items-center gap-4 px-5 py-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/inbound-direct.png"
              alt="직접 보내기"
              className="w-[88px] h-[88px] object-contain shrink-0 drop-shadow-xl"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-lg font-bold text-gray-900">직접 보내기</p>
                <ChevronRight size={18} className="text-gray-400 shrink-0" />
              </div>
              <p className="text-sm text-gray-500 leading-relaxed mb-3">
                택배, 퀵, 화물로<br />물품을 보내기 전 미리 등록합니다.
              </p>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">택배 발송</span>
                <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">사전 등록</span>
              </div>
            </div>
          </div>
        </button>

        {/* 하단 안내 */}
        <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 leading-relaxed">
            <p className="font-bold mb-0.5">입고신청이란?</p>
            <p>고객이 물건을 우리 센터에 맡기기 위한 첫 단계입니다.<br />수거 신청 또는 직접 보내기 중 편한 방법을 선택하세요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
