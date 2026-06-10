"use client";

import { useRouter } from "next/navigation";
import { Truck, Package, ChevronRight } from "lucide-react";

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
        {/* 안내 문구 */}
        <p className="text-sm text-gray-500 text-center py-2">
          물품을 맡기는 방법을 선택해주세요
        </p>

        {/* 카드 1: 수거 신청 */}
        <button
          type="button"
          onClick={() => router.push("/pickup")}
          className="w-full bg-white rounded-2xl border-2 border-gray-100 hover:border-brand-300 active:scale-[0.98] transition-all shadow-sm text-left overflow-hidden"
        >
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center shrink-0">
                <Truck size={26} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-base font-bold text-gray-900">수거 신청</p>
                  <ChevronRight size={18} className="text-gray-400 shrink-0" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  원하는 주소에서 물품을 수거해 보관합니다.
                </p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  집, 사무실, 매장 등 원하는 장소에서 수거를 요청할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-brand-50 border-t border-brand-100 px-5 py-3">
            <p className="text-sm font-semibold text-brand-700">수거 신청하기 →</p>
          </div>
        </button>

        {/* 구분선 */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 font-medium">또는</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* 카드 2: 직접 보내기 */}
        <button
          type="button"
          onClick={() => router.push("/register-parcel")}
          className="w-full bg-white rounded-2xl border-2 border-gray-100 hover:border-gray-300 active:scale-[0.98] transition-all shadow-sm text-left overflow-hidden"
        >
          <div className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gray-700 flex items-center justify-center shrink-0">
                <Package size={26} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-base font-bold text-gray-900">직접 보내기</p>
                  <ChevronRight size={18} className="text-gray-400 shrink-0" />
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  택배, 퀵, 직접 방문으로 물품을 보내기 전 미리 등록합니다.
                </p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  센터에 도착한 물품과 등록 정보를 확인해 스토리지에 반영합니다.
                </p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 border-t border-gray-100 px-5 py-3">
            <p className="text-sm font-semibold text-gray-600">물품 등록하기 →</p>
          </div>
        </button>

        {/* 하단 안내 */}
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-2">
          <p className="text-xs text-amber-700 leading-relaxed">
            <span className="font-bold">입고신청</span>이란? 고객이 물건을 우리 센터에 맡기기 위한 첫 단계입니다.
            수거 신청 또는 직접 보내기 중 편한 방법을 선택하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
