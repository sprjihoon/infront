"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { OrderSummary } from "@/lib/order-display";
import {
  formatParcelItemTitle,
  normalizeParcelItems,
  parcelItemDisplayName,
} from "@/lib/parcel-item-display";

interface OrderCancelModalProps {
  order: OrderSummary;
  error: string;
  cancelling: boolean;
  onClose: () => void;
  onConfirm: (parcelIdsToRemove: string[] | null) => void;
  /** 상세에서 특정 물품만 제외할 때 사전 선택 */
  initialRemoveIds?: string[];
}

function parcelLabel(order: OrderSummary, parcelId: string): string {
  const link = order.order_parcels.find((op) => op.parcel_id === parcelId);
  const p = link?.parcels;
  if (!p) return `물품 ${parcelId.slice(0, 8)}…`;
  const title = formatParcelItemTitle(normalizeParcelItems(p.pre_invoice_items));
  if (title) return title;
  if (p.sender_name) return p.sender_name;
  if (p.tracking_no) return p.tracking_no;
  return "물품";
}

export default function OrderCancelModal({
  order,
  error,
  cancelling,
  onClose,
  onConfirm,
  initialRemoveIds,
}: OrderCancelModalProps) {
  const parcelIds = useMemo(
    () => order.order_parcels.map((op) => op.parcel_id),
    [order.order_parcels],
  );
  const multi = parcelIds.length > 1;

  const [mode, setMode] = useState<"full" | "partial">(
    initialRemoveIds?.length ? "partial" : multi ? "partial" : "full",
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialRemoveIds ?? (multi ? [] : parcelIds)),
  );

  useEffect(() => {
    setMode(initialRemoveIds?.length ? "partial" : multi ? "partial" : "full");
    setSelected(new Set(initialRemoveIds ?? (multi ? [] : parcelIds)));
  }, [order.id, initialRemoveIds, multi, parcelIds]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    if (mode === "full" || !multi) {
      onConfirm(null);
      return;
    }
    if (selected.size === 0) return;
    if (selected.size >= parcelIds.length) {
      onConfirm(null);
      return;
    }
    onConfirm(Array.from(selected));
  }

  const partialInvalid = mode === "partial" && multi && selected.size === 0;
  const confirmLabel =
    mode === "full" || !multi
      ? "전체 취소"
      : selected.size >= parcelIds.length
        ? "전체 취소"
        : `${selected.size}개 물품 제외`;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-8 sm:items-center">
      <div className="w-full max-w-[400px] bg-white rounded-2xl p-5 shadow-xl max-h-[85vh] overflow-y-auto">
        <p className="text-base font-bold text-gray-900 mb-1">
          {multi ? "배송 신청 취소 / 물품 제외" : "해외배송 신청을 취소할까요?"}
        </p>
        <p className="text-sm text-gray-500 mb-4">주문번호 {order.order_no}</p>

        {multi && (
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode("full")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                mode === "full"
                  ? "bg-red-50 border-red-200 text-red-700"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}
            >
              전체 취소
            </button>
            <button
              type="button"
              onClick={() => setMode("partial")}
              className={`flex-1 py-2 rounded-xl text-xs font-semibold border ${
                mode === "partial"
                  ? "bg-brand-50 border-brand-200 text-brand-700"
                  : "bg-gray-50 border-gray-200 text-gray-500"
              }`}
            >
              일부만 제외
            </button>
          </div>
        )}

        {mode === "partial" && multi ? (
          <>
            <p className="text-xs text-gray-500 mb-2">
              제외한 물품은 스토리지로 돌아가 다시 출고 신청할 수 있습니다. 남은 물품은 이 주문에 유지됩니다.
            </p>
            <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
              {parcelIds.map((id) => {
                const checked = selected.has(id);
                const link = order.order_parcels.find((op) => op.parcel_id === id);
                const items = normalizeParcelItems(link?.parcels?.pre_invoice_items);
                const sub = items
                  .slice(0, 2)
                  .map((it) => parcelItemDisplayName(it))
                  .filter(Boolean)
                  .join(", ");
                return (
                  <label
                    key={id}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${
                      checked ? "border-brand-300 bg-brand-50" : "border-gray-100 bg-gray-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(id)}
                      className="mt-0.5 accent-brand-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900">{parcelLabel(order, id)}</p>
                      {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 mb-5">
            취소하면 담았던 물품 {parcelIds.length}개가 스토리지에서 다시 출고 신청할 수 있는 상태로 돌아갑니다.
          </p>
        )}

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
            onClick={handleConfirm}
            disabled={cancelling || partialInvalid}
            className="flex-1 py-3 bg-red-500 text-white text-sm font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-1"
          >
            {cancelling ? <Loader2 size={16} className="animate-spin" /> : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
