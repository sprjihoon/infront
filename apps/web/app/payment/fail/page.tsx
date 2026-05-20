"use client";

import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";

export default function PaymentFailPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
        <XCircle size={42} className="text-red-400" />
      </div>
      <p className="text-xl font-bold text-gray-900 mb-2">결제 취소</p>
      <p className="text-sm text-gray-500 mb-8 leading-relaxed">
        결제가 취소되었습니다.<br />주문은 유지되며, 나중에 다시 결제할 수 있습니다.
      </p>
      <button
        onClick={() => router.push("/orders")}
        className="bg-gray-700 text-white font-bold px-8 py-3.5 rounded-2xl text-sm"
      >
        주문 목록으로
      </button>
    </div>
  );
}
