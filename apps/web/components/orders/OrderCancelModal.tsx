"use client";

import { Loader2 } from "lucide-react";
import type { OrderSummary } from "@/lib/order-display";

interface OrderCancelModalProps {
  order: OrderSummary;
  error: string;
  cancelling: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function OrderCancelModal({
  order,
  error,
  cancelling,
  onClose,
  onConfirm,
}: OrderCancelModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
      <div className="w-full max-w-[380px] bg-white rounded-2xl p-5 shadow-xl">
        <p className="text-base font-bold text-gray-900 mb-1">해외배송 신청을 취소할까요?</p>
        <p className="text-sm text-gray-500 mb-1">주문번호 {order.order_no}</p>
        <p className="text-sm text-gray-500 mb-5">
          취소하면 담았던 물품 {order.order_parcels?.length ?? 0}개가 마이창고에서 다시 출고
          신청할 수 있는 상태로 돌아갑니다.
        </p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="flex-1 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            className="flex-1 py-3 bg-red-500 text-white text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-1"
          >
            {cancelling ? <Loader2 size={16} className="animate-spin" /> : "신청 취소"}
          </button>
        </div>
      </div>
    </div>
  );
}
