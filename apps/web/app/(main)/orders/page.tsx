"use client";

import { useEffect, useMemo, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  FileText, CheckCircle, Loader2, ChevronRight, ChevronLeft,
  Search, Globe, MapPin, Truck, Package,
} from "lucide-react";
import type { OrderSummary } from "@/lib/order-display";
import { COUNTRIES, SHIPPING_METHOD_LABELS } from "@/lib/order-display";
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

// ── 국내 배송 타입 ──────────────────────────────────────────
interface DomesticOrder {
  id: string;
  status: string;
  recipient_name: string;
  recipient_addr1: string;
  recipient_zip: string;
  items_desc: string | null;
  packaging_type: string | null;
  epost_regi_no: string | null;
  epost_price: number | null;
  parcel_ids: string[];
  created_at: string;
  updated_at: string;
}

const DOMESTIC_FILTER_TABS = [
  { key: "ALL",        label: "전체" },
  { key: "PENDING",    label: "접수 대기" },
  { key: "BOOKED",     label: "배송 준비" },
  { key: "IN_TRANSIT", label: "배송 중" },
  { key: "DELIVERED",  label: "배달 완료" },
  { key: "CANCELLED",  label: "취소됨" },
] as const;
type DomesticFilterKey = typeof DOMESTIC_FILTER_TABS[number]["key"];

const DOMESTIC_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:    { label: "접수 대기",  color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  BOOKED:     { label: "배송 준비",  color: "bg-blue-100 text-blue-700 border-blue-200" },
  IN_TRANSIT: { label: "배송 중",    color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  DELIVERED:  { label: "배달 완료",  color: "bg-green-100 text-green-700 border-green-200" },
  CANCELLED:  { label: "취소됨",     color: "bg-gray-100 text-gray-500 border-gray-200" },
};

function matchesDomesticFilter(o: DomesticOrder, key: DomesticFilterKey) {
  if (key === "ALL") return o.status !== "CANCELLED";
  return o.status === key;
}

// ── 메인 ──────────────────────────────────────────────────────
function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOrderNo = searchParams.get("new");
  const expandId   = searchParams.get("expand");

  // 해외/국내 모드
  const [mode, setMode] = useState<"intl" | "domestic">("intl");

  // ── 해외 배송 상태 ────────────────────────────────────────
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loadingIntl, setLoadingIntl] = useState(true);
  const [filter, setFilter] = useState<OrderListFilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [cancelTarget, setCancelTarget] = useState<OrderSummary | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // ── 국내 배송 상태 ────────────────────────────────────────
  const [domesticOrders, setDomesticOrders] = useState<DomesticOrder[]>([]);
  const [loadingDomestic, setLoadingDomestic] = useState(false);
  const [domesticFilter, setDomesticFilter] = useState<DomesticFilterKey>("ALL");
  const [domesticSearch, setDomesticSearch] = useState("");
  const [domesticPage, setDomesticPage] = useState(1);
  const [domesticCancelTarget, setDomesticCancelTarget] = useState<DomesticOrder | null>(null);
  const [domesticCancelling, setDomesticCancelling] = useState(false);
  const [domesticCancelError, setDomesticCancelError] = useState("");

  // ── 데이터 로드 ───────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    const r = await fetch("/api/orders?limit=200", { cache: "no-store" });
    const body = await r.json();
    if (!r.ok) throw new Error(body.error ?? "주문 목록을 불러오지 못했습니다.");
    return body.orders as OrderSummary[] | undefined;
  }, []);

  const loadDomesticOrders = useCallback(async () => {
    setLoadingDomestic(true);
    const r = await fetch("/api/domestic-orders", { cache: "no-store" });
    const body = await r.json();
    setDomesticOrders(body.orders ?? []);
    setLoadingDomestic(false);
  }, []);

  useEffect(() => {
    loadOrders()
      .then((data) => {
        const list = data ?? [];
        setOrders(list);
        setLoadingIntl(false);
        if (newOrderNo) {
          const found = list.find(o => o.order_no === newOrderNo);
          if (found) router.replace(`/orders/${found.id}`);
        } else if (expandId && list.some(o => o.id === expandId)) {
          router.replace(`/orders/${expandId}`);
        }
      })
      .catch(() => setLoadingIntl(false));
  }, [newOrderNo, expandId, router, loadOrders]);

  useEffect(() => {
    if (mode === "domestic" && domesticOrders.length === 0) {
      loadDomesticOrders();
    }
  }, [mode, domesticOrders.length, loadDomesticOrders]);

  // ── 해외 배송 취소 ────────────────────────────────────────
  async function confirmCancel(parcelIdsToRemove: string[] | null) {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await fetch(`/api/orders/${cancelTarget.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parcelIdsToRemove?.length ? { parcel_ids: parcelIdsToRemove } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "취소에 실패했습니다.");
      const targetId = cancelTarget.id;
      const data2 = await loadOrders();
      setOrders(data2 ?? []);
      setCancelTarget(null);
      if (data.mode === "partial") router.push(`/orders/${targetId}`);
      else setFilter("CANCELLED");
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  // ── 국내 배송 취소 ────────────────────────────────────────
  async function confirmDomesticCancel() {
    if (!domesticCancelTarget) return;
    setDomesticCancelling(true);
    setDomesticCancelError("");
    try {
      const res = await fetch(`/api/domestic-orders/${domesticCancelTarget.id}/cancel`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "취소에 실패했습니다.");
      await loadDomesticOrders();
      setDomesticCancelTarget(null);
      setDomesticFilter("CANCELLED");
    } catch (e: unknown) {
      setDomesticCancelError(e instanceof Error ? e.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setDomesticCancelling(false);
    }
  }

  // ── 해외 배송 필터/페이지 ─────────────────────────────────
  const filterCounts = useMemo(() => {
    const counts: Record<OrderListFilterKey, number> = {
      ALL: orders.filter(o => o.status !== "CANCELLED").length,
      DRAFT: 0, PROCESSING: 0, PAYMENT: 0, SHIPPING: 0, DONE: 0, CANCELLED: 0,
    };
    for (const order of orders) {
      for (const tab of ORDER_LIST_FILTER_TABS) {
        if (tab.key !== "ALL" && matchesOrderListFilter(order, tab.key)) counts[tab.key]++;
      }
    }
    return counts;
  }, [orders]);

  const filtered = useMemo(
    () => orders.filter(o => matchesOrderListFilter(o, filter) && matchesOrderSearch(o, search)),
    [orders, filter, search],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ORDERS_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * ORDERS_LIST_PAGE_SIZE, currentPage * ORDERS_LIST_PAGE_SIZE);
  useEffect(() => { setPage(1); }, [filter, search]);

  // ── 국내 배송 필터/페이지 ─────────────────────────────────
  const domesticFilterCounts = useMemo(() => {
    const base = Object.fromEntries(DOMESTIC_FILTER_TABS.map(t => [t.key, 0])) as Record<DomesticFilterKey, number>;
    base.ALL = domesticOrders.filter(o => o.status !== "CANCELLED").length;
    for (const o of domesticOrders) {
      for (const tab of DOMESTIC_FILTER_TABS) {
        if (tab.key !== "ALL" && o.status === tab.key) base[tab.key]++;
      }
    }
    return base;
  }, [domesticOrders]);

  const filteredDomestic = useMemo(() => {
    let list = domesticOrders.filter(o => matchesDomesticFilter(o, domesticFilter));
    if (domesticSearch.trim()) {
      const q = domesticSearch.toLowerCase();
      list = list.filter(o =>
        o.recipient_name.toLowerCase().includes(q) ||
        (o.epost_regi_no ?? "").includes(q) ||
        (o.items_desc ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [domesticOrders, domesticFilter, domesticSearch]);

  const dTotalPages = Math.max(1, Math.ceil(filteredDomestic.length / ORDERS_LIST_PAGE_SIZE));
  const dCurrentPage = Math.min(domesticPage, dTotalPages);
  const dPaginated = filteredDomestic.slice((dCurrentPage - 1) * ORDERS_LIST_PAGE_SIZE, dCurrentPage * ORDERS_LIST_PAGE_SIZE);
  useEffect(() => { setDomesticPage(1); }, [domesticFilter, domesticSearch]);

  const emptyMessage = getOrdersListEmptyMessage(filter);

  return (
    <div className="px-4 py-5 pb-24 max-w-[600px] mx-auto">

      {/* 페이지 제목 */}
      <h1 className="text-xl font-bold text-gray-900 mb-4">배송현황</h1>

      {/* 해외/국내 모드 토글 */}
      <div className="flex bg-white rounded-2xl p-1 shadow-sm mb-4 border border-gray-100">
        <button
          onClick={() => setMode("intl")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            mode === "intl" ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500"
          }`}
        >
          <Globe size={15} /> 해외 배송
        </button>
        <button
          onClick={() => setMode("domestic")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
            mode === "domestic" ? "bg-blue-600 text-white shadow-sm" : "text-gray-500"
          }`}
        >
          <MapPin size={15} /> 국내 배송
        </button>
      </div>

      {/* ═══════════════ 해외 배송 ═══════════════ */}
      {mode === "intl" && (
        <>
          {newOrderNo && loadingIntl && (
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
              onChange={e => setSearch(e.target.value)}
              placeholder="주문번호, 수취인, 국가 검색"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
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
                    filter === key ? "bg-indigo-600 text-white" : "bg-white text-gray-500 border border-gray-200"
                  }`}
                >
                  {label}{key !== "ALL" && count > 0 ? ` ${count}` : ""}
                </button>
              );
            })}
          </div>

          {loadingIntl ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
              <FileText size={44} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium mb-1 whitespace-pre-line">{emptyMessage.title}</p>
              <p className="text-gray-400 text-xs whitespace-pre-line">{emptyMessage.desc}</p>
              {filter === "ALL" && !search.trim() && (
                <button onClick={() => router.push("/warehouse")} className="mt-5 bg-indigo-600 text-white text-sm font-bold px-6 py-3 rounded-2xl">
                  마이창고 가기
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {paginated.map(order => {
                  const country = COUNTRIES[order.recipient_country ?? ""];
                  const isCancelled = order.status === "CANCELLED";
                  return (
                    <div key={order.id} className={`rounded-2xl shadow-sm overflow-hidden ${isCancelled ? "bg-gray-50" : "bg-white"}`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-gray-400 mb-0.5">{order.order_no}</p>
                            <p className={`text-sm font-semibold truncate ${isCancelled ? "text-gray-400" : "text-gray-900"}`}>
                              {country ? `${country.flag} ${country.name}` : order.recipient_country ?? "—"}
                              {order.recipient_name ? ` · ${order.recipient_name}` : ""}
                            </p>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>
                        {isCancelled ? (
                          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                            <span>신청일 {new Date(order.created_at).toLocaleDateString("ko-KR")}</span>
                            {order.updated_at && (<><span>·</span><span>취소일 {new Date(order.updated_at).toLocaleDateString("ko-KR")}</span></>)}
                          </div>
                        ) : (
                          <button type="button" className="w-full text-left" onClick={() => router.push(`/orders/${order.id}`)}>
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
                        )}
                      </div>
                      {!isCancelled && (
                        <div className="px-4 pb-4 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => router.push(`/orders/${order.id}`)}
                            className="w-full flex items-center justify-center gap-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-xs font-semibold bg-gray-50"
                          >
                            상세보기 <ChevronRight size={14} />
                          </button>
                          <OrderListActions order={order} onCancelClick={() => { setCancelError(""); setCancelTarget(order); }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {filtered.length > ORDERS_LIST_PAGE_SIZE && (
                <div className="mt-5 flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-400">{(currentPage - 1) * ORDERS_LIST_PAGE_SIZE + 1}–{Math.min(currentPage * ORDERS_LIST_PAGE_SIZE, filtered.length)} / 총 {filtered.length}건</p>
                  <div className="flex items-center gap-3">
                    <button disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center disabled:opacity-40">
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-semibold text-gray-700 min-w-[4.5rem] text-center">{currentPage} / {totalPages}</span>
                    <button disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center disabled:opacity-40">
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
        </>
      )}

      {/* ═══════════════ 국내 배송 ═══════════════ */}
      {mode === "domestic" && (
        <>
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={domesticSearch}
              onChange={e => setDomesticSearch(e.target.value)}
              placeholder="수취인, 운송장번호 검색"
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
            {DOMESTIC_FILTER_TABS.map(({ key, label }) => {
              const count = domesticFilterCounts[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDomesticFilter(key)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    domesticFilter === key ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200"
                  }`}
                >
                  {label}{key !== "ALL" && count > 0 ? ` ${count}` : ""}
                </button>
              );
            })}
          </div>

          {loadingDomestic ? (
            <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-blue-400" /></div>
          ) : filteredDomestic.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
              <Truck size={44} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500 text-sm font-medium mb-1">
                {domesticFilter === "CANCELLED" ? "취소된 국내 배송이 없습니다" : "국내 배송 신청 내역이 없습니다"}
              </p>
              {domesticFilter === "ALL" && !domesticSearch.trim() && (
                <button onClick={() => router.push("/domestic-shipping")} className="mt-5 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-2xl">
                  국내 배송 신청하기
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {dPaginated.map(order => {
                  const isCancelled = order.status === "CANCELLED";
                  const statusInfo = DOMESTIC_STATUS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-600 border-gray-200" };
                  return (
                    <div key={order.id} className={`rounded-2xl shadow-sm overflow-hidden ${isCancelled ? "bg-gray-50" : "bg-white"}`}>
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <MapPin size={12} className="text-blue-400 shrink-0" />
                              <p className={`text-sm font-semibold truncate ${isCancelled ? "text-gray-400" : "text-gray-900"}`}>
                                {order.recipient_name}
                              </p>
                            </div>
                            <p className="text-xs text-gray-400 truncate">
                              [{order.recipient_zip}] {order.recipient_addr1}
                            </p>
                          </div>
                          <span className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                          <span className="flex items-center gap-1">
                            <Package size={11} /> {order.parcel_ids?.length ?? 0}개
                          </span>
                          <span>·</span>
                          <span>{order.items_desc ?? "의류"}</span>
                          <span>·</span>
                          <span>{new Date(order.created_at).toLocaleDateString("ko-KR")}</span>
                        </div>

                        {order.epost_regi_no && (
                          <p className="text-xs font-mono text-indigo-600 mt-1.5 bg-indigo-50 rounded-lg px-2 py-1 inline-block">
                            운송장 {order.epost_regi_no}
                          </p>
                        )}

                        {isCancelled && order.updated_at && (
                          <p className="text-xs text-gray-400 mt-1">취소일 {new Date(order.updated_at).toLocaleDateString("ko-KR")}</p>
                        )}
                      </div>

                      {/* 취소 버튼 — PENDING만 */}
                      {order.status === "PENDING" && (
                        <div className="px-4 pb-4">
                          <button
                            type="button"
                            onClick={() => { setDomesticCancelError(""); setDomesticCancelTarget(order); }}
                            className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 text-xs font-semibold bg-red-50 hover:bg-red-100 transition-colors"
                          >
                            배송 신청 취소
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {filteredDomestic.length > ORDERS_LIST_PAGE_SIZE && (
                <div className="mt-5 flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-400">{(dCurrentPage - 1) * ORDERS_LIST_PAGE_SIZE + 1}–{Math.min(dCurrentPage * ORDERS_LIST_PAGE_SIZE, filteredDomestic.length)} / 총 {filteredDomestic.length}건</p>
                  <div className="flex items-center gap-3">
                    <button disabled={dCurrentPage <= 1} onClick={() => setDomesticPage(p => Math.max(1, p - 1))} className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center disabled:opacity-40">
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm font-semibold text-gray-700 min-w-[4.5rem] text-center">{dCurrentPage} / {dTotalPages}</span>
                    <button disabled={dCurrentPage >= dTotalPages} onClick={() => setDomesticPage(p => Math.min(dTotalPages, p + 1))} className="w-10 h-10 rounded-xl border border-gray-200 bg-white text-gray-600 flex items-center justify-center disabled:opacity-40">
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 국내 취소 확인 모달 */}
          {domesticCancelTarget && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
              <div className="bg-white rounded-t-3xl w-full max-w-[600px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4">
                <h3 className="text-base font-bold text-gray-900">국내 배송 취소</h3>
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">{domesticCancelTarget.recipient_name}</span> 앞 배송 신청을 취소하시겠습니까?
                </p>
                <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
                  취소 시 선택하신 물품 <span className="font-bold">{domesticCancelTarget.parcel_ids?.length ?? 0}개</span>가 마이창고로 돌아갑니다.
                </div>
                {domesticCancelError && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3">{domesticCancelError}</p>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDomesticCancelTarget(null)}
                    className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-700 font-semibold text-sm"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={confirmDomesticCancel}
                    disabled={domesticCancelling}
                    className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm disabled:opacity-60"
                  >
                    {domesticCancelling ? <Loader2 size={16} className="animate-spin mx-auto" /> : "취소 확인"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><Loader2 size={32} className="animate-spin text-brand-500" /></div>}>
      <OrdersContent />
    </Suspense>
  );
}
