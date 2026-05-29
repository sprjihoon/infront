"use client";

import Link from "next/link";
import { ArrowLeft, Globe, MapPin, ChevronRight, Package } from "lucide-react";
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
        <h1 className="text-base font-bold text-gray-900">출고 신청</h1>
      </div>

      <div className="px-4 py-6 max-w-[600px] mx-auto space-y-4">
        <p className="text-sm text-gray-500">어떤 방식으로 출고할까요?</p>

        {/* 국내 배송 */}
        <Link
          href="/domestic-shipping"
          className="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
            <MapPin size={28} className="text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base">국내 배송</p>
            <p className="text-sm text-gray-500 mt-0.5">우체국 소포로 국내 주소에 발송</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">우체국 소포</span>
              <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">빠른 처리</span>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
        </Link>

        {/* 해외 배송 */}
        <Link
          href="/shipping-request"
          className="flex items-center gap-4 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all group"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
            <Globe size={28} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-base">해외 배송</p>
            <p className="text-sm text-gray-500 mt-0.5">EMS · K-Packet으로 해외 주소에 발송</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">EMS</span>
              <span className="text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">K-Packet</span>
              <span className="text-[11px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">EMS Premium</span>
            </div>
          </div>
          <ChevronRight size={20} className="text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
        </Link>

        {/* 안내 */}
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex items-start gap-3">
          <Package size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-semibold">출고 신청 전 확인사항</p>
            <p>마이창고에서 물품 상태가 <span className="font-semibold">출고 가능</span>인지 확인해주세요.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
