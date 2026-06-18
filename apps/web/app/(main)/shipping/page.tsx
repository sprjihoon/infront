"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Info } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ShippingHubPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900">출고 신청</h1>
          <p className="text-xs text-gray-400 mt-0.5">어디로 출고하시겠어요?</p>
        </div>
      </div>

      <div className="px-4 py-6 max-w-[600px] mx-auto space-y-4">

        {/* 국내 배송 */}
        <Link
          href="/domestic-shipping"
          className="flex items-center gap-4 bg-white rounded-2xl px-5 py-5 shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/shipping-domestic.png"
            alt="국내 배송"
            className="w-[88px] h-[88px] object-contain shrink-0 drop-shadow-xl"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-lg font-bold text-gray-900">국내 배송</p>
              <ChevronRight size={18} className="text-gray-400 shrink-0" />
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-3">
              보관 중인 물품을<br />국내 주소로 발송합니다.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">우체국 소포</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">빠른 처리</span>
            </div>
          </div>
        </Link>

        {/* 해외 배송 */}
        <Link
          href="/shipping-request"
          className="flex items-center gap-4 bg-white rounded-2xl px-5 py-5 shadow-sm border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/shipping-overseas.png"
            alt="해외 배송"
            className="w-[88px] h-[88px] object-contain shrink-0 drop-shadow-xl"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-lg font-bold text-gray-900">해외 배송</p>
              <ChevronRight size={18} className="text-gray-400 shrink-0" />
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-3">
              보관 중인 물품을<br />해외 주소로 발송합니다.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">EMS</span>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">K-Packet</span>
              <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1 rounded-full">EMS Premium</span>
            </div>
          </div>
        </Link>

        {/* 안내 */}
        <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-700 leading-relaxed">
            <p className="font-bold mb-0.5">출고 전 확인사항</p>
            <p>내 스토리지에서 출고 가능한 물품을<br />먼저 선택해 주세요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
