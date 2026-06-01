"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import type { OrderDetail } from "@/lib/order-display";
import OrderDetailView from "@/components/orders/OrderDetailView";
import OrderCancelModal from "@/components/orders/OrderCancelModal";

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<OrderDetail | null>(null);
  const [cancelInitialRemoveIds, setCancelInitialRemoveIds] = useState<string[] | undefined>();
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    const res = await fetch(`/api/orders?order_id=${orderId}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (!res.ok) {
      router.replace("/orders");
      return;
    }
    const body = await res.json() as { order: OrderDetail };
    setOrder(body.order);
    setLoading(false);
  }, [orderId, router]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  async function confirmCancel(parcelIdsToRemove: string[] | null) {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          parcelIdsToRemove?.length ? { parcel_ids: parcelIdsToRemove } : {},
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "취소에 실패했습니다.");
      setCancelTarget(null);
      setCancelInitialRemoveIds(undefined);
      if (data.mode === "full") {
        router.replace("/orders");
        return;
      }
      await loadOrder();
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  function openCancelModal(target: OrderDetail, removeParcelId?: string) {
    setCancelError("");
    setCancelTarget(target);
    setCancelInitialRemoveIds(removeParcelId ? [removeParcelId] : undefined);
  }

  if (loading || !order) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 pb-24 space-y-4">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="p-1 -ml-1">
          <ArrowLeft size={22} className="text-gray-700" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">주문 상세</h1>
          <p className="text-xs text-gray-400">{order.order_no}</p>
        </div>
      </div>

      <OrderDetailView
        order={order}
        variant="page"
        onCancelClick={() => openCancelModal(order)}
        onExcludeParcel={(parcelId) => openCancelModal(order, parcelId)}
      />

      {cancelTarget && (
        <OrderCancelModal
          order={cancelTarget}
          error={cancelError}
          cancelling={cancelling}
          initialRemoveIds={cancelInitialRemoveIds}
          onClose={() => {
            setCancelTarget(null);
            setCancelInitialRemoveIds(undefined);
          }}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  );
}
