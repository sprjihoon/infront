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
          <p className="text-xs text-gray-400 mt-0.5">어떤 방식으로 출고할까요?</p>
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
              우체국 소포로<br />국내 주소에 발송합니다.
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
          className="flex items-center gap-4 bg-white rounded-2xl px-5 py-5 shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all text-left"
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
              EMS · K-Packet으로<br />해외 주소에 발송합니다.
            </p>
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">EMS</span>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">K-Packet</span>
              <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">EMS Premium</span>
            </div>
          </div>
        </Link>

        {/* 안내 */}
        <div className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 leading-relaxed">
            <Link href="/storage" className="font-bold underline">내 블록 보관함</Link>에서
            물품 상태가 <span className="font-bold">출고 가능</span>인지 확인 후 신청해주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
