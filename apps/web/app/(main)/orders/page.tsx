"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { FileText, CheckCircle, Loader2, ChevronRight } from "lucide-react";
import type { OrderSummary } from "@/lib/order-display";
import {
  COUNTRIES,
  SHIPPING_METHOD_LABELS,
} from "@/lib/order-display";
import { OrderListActions, StatusBadge } from "@/components/orders/OrderDetailView";
import OrderCancelModal from "@/components/orders/OrderCancelModal";

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOrderNo = searchParams.get("new");
  const expandId = searchParams.get("expand");

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<OrderSummary | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function loadOrders() {
    const r = await fetch("/api/orders", { cache: "no-store" });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "주문 목록을 불러오지 못했습니다.");
    return body.orders as OrderSummary[] | undefined;
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/orders/${cancelTarget.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "취소에 실패했습니다.");
      const data2 = await loadOrders();
      setOrders(data2 ?? []);
      setCancelTarget(null);
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  useEffect(() => {
    loadOrders()
      .then((data) => {
        const list = data ?? [];
        setOrders(list);
        setLoading(false);

        if (newOrderNo) {
          const found = list.find((o) => o.order_no === newOrderNo);
          if (found) router.replace(`/orders/${found.id}`);
        } else if (expandId && list.some((o) => o.id === expandId)) {
          router.replace(`/orders/${expandId}`);
        }
      })
      .catch((err: unknown) => {
        console.error("[orders]", err);
        setLoading(false);
      });
  }, [newOrderNo, expandId, router]);

  return (
    <div className="px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-gray-900 mb-4">✈️ 배송현황</h1>

      {newOrderNo && loading && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 mb-4 flex items-start gap-2">
          <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-800">해외배송 신청 완료!</p>
            <p className="text-xs text-green-600 mt-0.5">주문 상세로 이동 중…</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-brand-400" />
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <FileText size={44} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">진행 중인 배송이 없어요</p>
          <p className="text-gray-400 text-xs mt-1">마이창고에서 해외배송을 신청해보세요</p>
          <button
            type="button"
            onClick={() => router.push("/warehouse")}
            className="mt-5 bg-brand-600 text-white text-sm font-bold px-6 py-3 rounded-2xl"
          >
            마이창고 가기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const country = COUNTRIES[order.recipient_country ?? ""];

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  className="w-full p-4 text-left active:bg-gray-50 transition-colors"
                  onClick={() => router.push(`/orders/${order.id}`)}
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-400 mb-0.5">{order.order_no}</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {country ? `${country.flag} ${country.name}` : order.recipient_country ?? "—"}
                        {order.recipient_name ? ` · ${order.recipient_name}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{SHIPPING_METHOD_LABELS[order.shipping_method] ?? order.shipping_method}</span>
                      <span>·</span>
                      <span>물품 {order.order_parcels?.length ?? 0}개</span>
                      <span>·</span>
                      <span>{new Date(order.created_at).toLocaleDateString("ko-KR")}</span>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 shrink-0" />
                  </div>
                </button>

                <div className="px-4 pb-4">
                  <OrderListActions
                    order={order}
                    onCancelClick={() => {
                      setCancelError("");
                      setCancelTarget(order);
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {cancelTarget && (
        <OrderCancelModal
          order={cancelTarget}
          error={cancelError}
          cancelling={cancelling}
          onClose={() => setCancelTarget(null)}
          onConfirm={confirmCancel}
        />
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center items-center min-h-screen">
          <Loader2 size={32} className="animate-spin text-brand-500" />
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
