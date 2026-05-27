"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileText,
  CheckCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Search,
} from "lucide-react";
import type { OrderSummary } from "@/lib/order-display";
import {
  COUNTRIES,
  SHIPPING_METHOD_LABELS,
} from "@/lib/order-display";
import {
  getOrdersListEmptyMessage,
  matchesOrderListFilter,
  matchesOrderSearch,
  ORDER_LIST_FILTER_TABS,
  ORDERS_LIST_PAGE_SIZE,
  type OrderListFilterKey,
} from "@/lib/order-list-display";
import { OrderListActions, StatusBadge } from "@/components/orders/OrderDetailView";
import OrderCancelModal from "@/components/orders/OrderCancelModal";

function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOrderNo = searchParams.get("new");
  const expandId = searchParams.get("expand");

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderListFilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<OrderSummary | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  async function loadOrders() {
    const r = await fetch("/api/orders?limit=200", { cache: "no-store" });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "주문 목록을 불러오지 못했습니다.");
    return body.orders as OrderSummary[] | undefined;
  }

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
      const targetId = cancelTarget.id;
      const data2 = await loadOrders();
      setOrders(data2 ?? []);
      setCancelTarget(null);
      if (data.mode === "partial") {
        router.push(`/orders/${targetId}`);
      }
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

        const hasInTransit = list.some(
          (o) => o.status === "IN_TRANSIT" || o.status === "CUSTOMS_FILING",
        );
        if (hasInTransit) {
          fetch("/api/orders/sync-intl-tracking", { method: "POST" })
            .then(() => loadOrders())
            .then((refreshed) => {
              if (refreshed) setOrders(refreshed);
            })
            .catch(() => {});
        }

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

  const filterCounts = useMemo(() => {
    const counts: Record<OrderListFilterKey, number> = {
      ALL: orders.length,
      DRAFT: 0,
      PROCESSING: 0,
      PAYMENT: 0,
      SHIPPING: 0,
      DONE: 0,
      CANCELLED: 0,
    };
    for (const order of orders) {
      for (const tab of ORDER_LIST_FILTER_TABS) {
        if (tab.key !== "ALL" && matchesOrderListFilter(order, tab.key)) {
          counts[tab.key] += 1;
        }
      }
    }
    return counts;
  }, [orders]);

  const filtered = useMemo(() => {
    return orders.filter(
      (o) => matchesOrderListFilter(o, filter) && matchesOrderSearch(o, search),
    );
  }, [orders, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ORDERS_LIST_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + ORDERS_LIST_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const emptyMessage = getOrdersListEmptyMessage(filter);

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

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="주문번호, 수취인, 국가 검색"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {ORDER_LIST_FILTER_TABS.map(({ key, label }) => {
          const count = filterCounts[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter === key
                  ? "bg-brand-600 text-white"
                  : "bg-white text-gray-500 border border-gray-200"
              }`}
            >
              {label}
              {key !== "ALL" && count > 0 ? ` ${count}` : ""}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-brand-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
          <FileText size={44} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium mb-1 whitespace-pre-line">
            {emptyMessage.title}
          </p>
          <p className="text-gray-400 text-xs whitespace-pre-line">{emptyMessage.desc}</p>
          {filter === "ALL" && !search.trim() && (
            <button
              type="button"
              onClick={() => router.push("/warehouse")}
              className="mt-5 bg-brand-600 text-white text-sm font-bold px-6 py-3 rounded-2xl"
            >
              마이창고 가기
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((order) => {
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

                  <div className="px-4 pb-4 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(`/orders/${order.id}`)}
                      className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold bg-gray-50"
                    >
                      상세보기
                      <ChevronRight size={14} />
                    </button>
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

          {filtered.length > ORDERS_LIST_PAGE_SIZE && (
            <div className="mt-5 flex flex-col items-center gap-2">
              <p className="text-xs text-gray-400">
                {pageStart + 1}–{Math.min(pageStart + ORDERS_LIST_PAGE_SIZE, filtered.length)} / 총{" "}
                {filtered.length}건
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-transform"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-semibold text-gray-700 min-w-[4.5rem] text-center">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="flex items-center justify-center w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-40 disabled:pointer-events-none active:scale-95 transition-transform"
                  aria-label="다음 페이지"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}
        </>
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
