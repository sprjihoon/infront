"use client";

import { FileText } from "lucide-react";

export default function OrdersPage() {
  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">✈️ 배송현황</h1>
      <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
        <FileText size={44} className="text-gray-200 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">진행 중인 배송이 없어요</p>
        <p className="text-gray-400 text-xs mt-1">마이창고에서 해외배송을 신청해보세요</p>
      </div>
    </div>
  );
}
