"use client";

import { useEffect, useMemo, useState, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle, Loader2, ChevronRight,
  Search, MapPin, Package, Truck,
} from "lucide-react";
import type { OrderSummary } from "@/lib/order-display";
import { COUNTRIES, SHIPPING_METHOD_LABELS, ORDER_STATUS_CONFIG } from "@/lib/order-display";
import { OrderListActions } from "@/components/orders/OrderDetailView";
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

// ── 필터 정의 ────────────────────────────────────────────────

type ModeKey = "ALL" | "INTL" | "DOMESTIC";

const MODE_TABS: { key: ModeKey; label: string }[] = [
  { key: "ALL",      label: "전체" },
  { key: "INTL",     label: "해외" },
  { key: "DOMESTIC", label: "국내" },
];

type IntlFilterKey = "ALL" | "DRAFT" | "PAYMENT" | "PREPARE" | "SHIPPING" | "DONE";

const INTL_FILTER_TABS: { key: IntlFilterKey; label: string; statuses: string[] }[] = [
  { key: "ALL",      label: "전체",    statuses: [] },
  { key: "DRAFT",    label: "신청 완료", statuses: ["DRAFT"] },
  { key: "PAYMENT",  label: "결제 대기", statuses: ["QUOTE_SENT", "PENDING_PAYMENT"] },
  { key: "PREPARE",  label: "배송 준비", statuses: ["PACKAGING_REQUESTED", "PACKAGING_DONE", "PAID", "CUSTOMS_FILING"] },
  { key: "SHIPPING", label: "배송 중",  statuses: ["IN_TRANSIT"] },
  { key: "DONE",     label: "완료",    statuses: ["DELIVERED"] },
];

const DOMESTIC_STATUS: Record<string, { label: string; color: string }> = {
  PENDING:    { label: "접수 대기",  color: "bg-yellow-50 text-yellow-700" },
  BOOKED:     { label: "배송 준비",  color: "bg-blue-50 text-blue-600" },
  IN_TRANSIT: { label: "배송 중",   color: "bg-sky-50 text-sky-600" },
  DELIVERED:  { label: "배달 완료",  color: "bg-green-50 text-green-600" },
  CANCELLED:  { label: "취소됨",    color: "bg-gray-100 text-gray-500" },
};

type DomesticFilterKey = "ALL" | "PENDING" | "BOOKED" | "IN_TRANSIT" | "DELIVERED" | "CANCELLED";

const DOMESTIC_FILTER_TABS: { key: DomesticFilterKey; label: string }[] = [
  { key: "ALL",        label: "전체" },
  { key: "PENDING",    label: "접수 대기" },
  { key: "BOOKED",     label: "배송 준비" },
  { key: "IN_TRANSIT", label: "배송 중" },
  { key: "DELIVERED",  label: "배달 완료" },
  { key: "CANCELLED",  label: "취소됨" },
];

// ── 유틸 ────────────────────────────────────────────────────

function getCarrierLabel(method: string): string {
  if (method === "EMS" || method === "EMS_PREMIUM") return "우체국 EMS";
  if (method === "KPACKET") return "우체국 K-Packet";
  return SHIPPING_METHOD_LABELS[method] ?? method;
}

function matchesIntlFilter(order: OrderSummary, key: IntlFilterKey): boolean {
  if (order.status === "CANCELLED") return key === "ALL" ? false : false;
  if (key === "ALL") return true;
  const tab = INTL_FILTER_TABS.find(t => t.key === key);
  return tab ? tab.statuses.includes(order.status) : false;
}

function matchesDomesticFilter(o: DomesticOrder, key: DomesticFilterKey): boolean {
  if (key === "ALL") return o.status !== "CANCELLED";
  return o.status === key;
}

function matchesIntlSearch(order: OrderSummary, q: string): boolean {
  if (!q.trim()) return true;
  const lower = q.toLowerCase();
  return (
    order.order_no.toLowerCase().includes(lower) ||
    (order.recipient_name ?? "").toLowerCase().includes(lower) ||
    (COUNTRIES[order.recipient_country ?? ""]?.name ?? "").toLowerCase().includes(lower)
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────
function OrdersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newOrderNo = searchParams.get("new");
  const expandId   = searchParams.get("expand");

  const [mode, setMode] = useState<ModeKey>("ALL");

  // 해외 배송 상태
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loadingIntl, setLoadingIntl] = useState(true);
  const [intlFilter, setIntlFilter] = useState<IntlFilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<OrderSummary | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // 국내 배송 상태
  const [domesticOrders, setDomesticOrders] = useState<DomesticOrder[]>([]);
  const [loadingDomestic, setLoadingDomestic] = useState(false);
  const [domesticFilter, setDomesticFilter] = useState<DomesticFilterKey>("ALL");
  const [domesticSearch, setDomesticSearch] = useState("");
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
      .then(data => {
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

  // 국내 배송은 해당 모드 선택 시 또는 전체 모드일 때 로드
  useEffect(() => {
    if ((mode === "DOMESTIC" || mode === "ALL") && domesticOrders.length === 0) {
      loadDomesticOrders();
    }
  }, [mode, domesticOrders.length, loadDomesticOrders]);

  // ── 해외 취소 ──────────────────────────────────────────────
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
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  // ── 국내 취소 ──────────────────────────────────────────────
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
    } catch (e: unknown) {
      setDomesticCancelError(e instanceof Error ? e.message : "취소 중 오류가 발생했습니다.");
    } finally {
      setDomesticCancelling(false);
    }
  }

  // ── 필터 카운트 ───────────────────────────────────────────
  const intlCounts = useMemo(() => {
    const base = Object.fromEntries(INTL_FILTER_TABS.map(t => [t.key, 0])) as Record<IntlFilterKey, number>;
    base.ALL = orders.filter(o => o.status !== "CANCELLED").length;
    for (const o of orders) {
      for (const t of INTL_FILTER_TABS) {
        if (t.key !== "ALL" && t.statuses.includes(o.status)) base[t.key]++;
      }
    }
    return base;
  }, [orders]);

  const domesticCounts = useMemo(() => {
    const base = Object.fromEntries(DOMESTIC_FILTER_TABS.map(t => [t.key, 0])) as Record<DomesticFilterKey, number>;
    base.ALL = domesticOrders.filter(o => o.status !== "CANCELLED").length;
    for (const o of domesticOrders) {
      if (o.status !== "CANCELLED") base[o.status as DomesticFilterKey]++;
    }
    if (domesticOrders.some(o => o.status === "CANCELLED")) {
      base.CANCELLED = domesticOrders.filter(o => o.status === "CANCELLED").length;
    }
    return base;
  }, [domesticOrders]);

  // ── 필터링된 목록 ─────────────────────────────────────────
  const filteredIntl = useMemo(
    () => orders.filter(o => matchesIntlFilter(o, intlFilter) && matchesIntlSearch(o, search)),
    [orders, intlFilter, search],
  );

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

  // 표시 여부
  const showIntl     = mode === "ALL" || mode === "INTL";
  const showDomestic = mode === "ALL" || mode === "DOMESTIC";

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── 헤더 ── */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 -ml-1 rounded-xl hover:bg-gray-100"
          >
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900">출고·배송현황</h1>
            <p className="text-xs text-gray-400 mt-0.5">출고 및 배송의 진행 상태입니다.</p>
          </div>
          <button
            onClick={() => setShowSearch(s => !s)}
            className="p-2 rounded-xl hover:bg-gray-100"
          >
            <Search size={18} className="text-gray-500" />
          </button>
        </div>

        {/* 검색창 */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={mode === "DOMESTIC" ? domesticSearch : search}
                onChange={e =>
                  mode === "DOMESTIC" ? setDomesticSearch(e.target.value) : setSearch(e.target.value)
                }
                placeholder={mode === "DOMESTIC" ? "수취인, 운송장번호 검색" : "주문번호, 수취인, 국가 검색"}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
        )}

        {/* ── Row 1: 전체/해외/국내 ── */}
        <div className="flex gap-2 px-4 pb-2 overflow-x-auto scrollbar-none">
          {MODE_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                mode === t.key
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Row 2: 상태 필터 ── */}
        {showIntl && mode !== "DOMESTIC" && (
          <div className="flex gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
            {INTL_FILTER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setIntlFilter(t.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  intlFilter === t.key
                    ? "bg-sky-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {t.label}
                {intlCounts[t.key] > 0 && (
                  <span className={`ml-1 ${intlFilter === t.key ? "text-white/70" : "text-gray-400"}`}>
                    {intlCounts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {mode === "DOMESTIC" && (
          <div className="flex gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
            {DOMESTIC_FILTER_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setDomesticFilter(t.key)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  domesticFilter === t.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {t.label}
                {domesticCounts[t.key] > 0 && (
                  <span className={`ml-1 ${domesticFilter === t.key ? "text-white/70" : "text-gray-400"}`}>
                    {domesticCounts[t.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 내용 ── */}
      <div className="px-4 py-3 space-y-4 pb-24">

        {/* 신규 주문 알림 */}
        {newOrderNo && loadingIntl && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 flex items-start gap-2">
            <CheckCircle size={16} className="text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-800">해외배송 신청 완료!</p>
              <p className="text-xs text-green-600 mt-0.5">주문 상세로 이동 중…</p>
            </div>
          </div>
        )}

        {/* ══ 해외 배송 목록 ══ */}
        {showIntl && (
          <div className="space-y-3">
            {mode === "ALL" && (
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gray-200" />
                <p className="text-xs font-semibold text-gray-400 shrink-0">해외 배송</p>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            )}

            {loadingIntl ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-gray-300" />
              </div>
            ) : filteredIntl.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
                <Package size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400 mb-1">해외 배송 내역이 없습니다</p>
                {intlFilter === "ALL" && !search.trim() && (
                  <button
                    onClick={() => router.push("/storage")}
                    className="mt-4 bg-sky-600 text-white text-sm font-bold px-6 py-3 rounded-2xl"
                  >
                    스토리지에서 출고 신청
                  </button>
                )}
              </div>
            ) : (
              filteredIntl.map(order => {
                const country = COUNTRIES[order.recipient_country ?? ""];
                const isCancelled = order.status === "CANCELLED";
                const statusCfg = ORDER_STATUS_CONFIG[order.status];
                const dateStr = new Date(order.created_at).toLocaleDateString("ko-KR", {
                  year: "numeric", month: "numeric", day: "numeric",
                });
                const carrier = getCarrierLabel(order.shipping_method);

                return (
                  <div key={order.id} className={`rounded-2xl shadow-sm overflow-hidden ${isCancelled ? "bg-gray-50 opacity-70" : "bg-white"}`}>
                    <button
                      type="button"
                      className="w-full p-4 text-left active:bg-gray-50 transition-colors"
                      onClick={() => !isCancelled && router.push(`/orders/${order.id}`)}
                    >
                      {/* 주문번호 + 상태 */}
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] font-mono text-gray-400 tracking-wide">
                          {order.order_no}
                        </p>
                        {statusCfg && (
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        )}
                      </div>

                      {/* 수취인 */}
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-semibold text-gray-900 truncate flex-1 mr-2">
                          {country ? `${country.flag} ${country.name}` : (order.recipient_country ?? "")}
                          {order.recipient_name ? ` · ${order.recipient_name}` : ""}
                        </p>
                        {!isCancelled && <ChevronRight size={16} className="text-gray-300 shrink-0" />}
                      </div>

                      {/* 배송 정보 */}
                      <p className="text-xs text-gray-400 mb-3">
                        {SHIPPING_METHOD_LABELS[order.shipping_method] ?? order.shipping_method}
                        {" · "}{order.order_parcels?.length ?? 0}개
                        {" · "}{dateStr}
                      </p>

                      {/* 하단 정보 행 */}
                      {!isCancelled && (
                        <div className="grid grid-cols-3 gap-1.5 pt-2.5 border-t border-gray-50">
                          <div>
                            <p className="text-[10px] text-gray-400 mb-0.5">예상 도착일</p>
                            <p className="text-xs font-semibold text-gray-700">
                              {order.delivered_at
                                ? new Date(order.delivered_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })
                                : "—"}
                            </p>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] text-gray-400 mb-0.5">운송장 번호</p>
                            <p className="text-xs font-semibold text-gray-700 truncate">
                              {order.intl_tracking_no ?? "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-400 mb-0.5">배송사</p>
                            <p className="text-xs font-semibold text-gray-700">{carrier}</p>
                          </div>
                        </div>
                      )}

                      {isCancelled && (
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>신청일 {dateStr}</span>
                          {order.updated_at && (
                            <><span>·</span><span>취소일 {new Date(order.updated_at).toLocaleDateString("ko-KR")}</span></>
                          )}
                        </div>
                      )}
                    </button>

                    {/* 취소 액션 */}
                    {!isCancelled && (
                      <div className="px-4 pb-3 border-t border-gray-50 pt-1">
                        <OrderListActions
                          order={order}
                          onCancelClick={() => { setCancelError(""); setCancelTarget(order); }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ══ 국내 배송 목록 ══ */}
        {showDomestic && (
          <div className="space-y-3">
            {mode === "ALL" && (
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-gray-200" />
                <p className="text-xs font-semibold text-gray-400 shrink-0">국내 배송</p>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            )}

            {mode === "DOMESTIC" && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" />
            )}

            {loadingDomestic ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-gray-300" />
              </div>
            ) : filteredDomestic.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
                <Truck size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-400 mb-1">국내 배송 내역이 없습니다</p>
                {domesticFilter === "ALL" && !domesticSearch.trim() && (
                  <button
                    onClick={() => router.push("/domestic-shipping")}
                    className="mt-4 bg-blue-600 text-white text-sm font-bold px-6 py-3 rounded-2xl"
                  >
                    국내 배송 신청하기
                  </button>
                )}
              </div>
            ) : (
              filteredDomestic.map(order => {
                const isCancelled = order.status === "CANCELLED";
                const statusInfo = DOMESTIC_STATUS[order.status] ?? { label: order.status, color: "bg-gray-100 text-gray-500" };
                const dateStr = new Date(order.created_at).toLocaleDateString("ko-KR", {
                  year: "numeric", month: "numeric", day: "numeric",
                });

                return (
                  <div key={order.id} className={`rounded-2xl shadow-sm overflow-hidden ${isCancelled ? "bg-gray-50 opacity-70" : "bg-white"}`}>
                    <div className="p-4">
                      {/* 주소번호 + 상태 */}
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[11px] text-gray-400">{order.created_at.slice(0, 10)}</p>
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>

                      {/* 수취인 */}
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <MapPin size={13} className="text-blue-400 shrink-0" />
                        <p className={`text-sm font-semibold truncate ${isCancelled ? "text-gray-400" : "text-gray-900"}`}>
                          {order.recipient_name}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400 truncate mb-2">
                        [{order.recipient_zip}] {order.recipient_addr1}
                      </p>

                      {/* 정보 행 */}
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <span className="flex items-center gap-1">
                          <Package size={11} /> {order.parcel_ids?.length ?? 0}개
                        </span>
                        <span>·</span>
                        <span>{order.items_desc ?? "물품"}</span>
                        <span>·</span>
                        <span>{dateStr}</span>
                      </div>

                      {order.epost_regi_no && (
                        <div className="pt-2 border-t border-gray-50">
                          <p className="text-[10px] text-gray-400 mb-0.5">운송장 번호</p>
                          <p className="text-xs font-semibold font-mono text-indigo-600">
                            {order.epost_regi_no}
                          </p>
                        </div>
                      )}
                    </div>

                    {order.status === "PENDING" && (
                      <div className="px-4 pb-3 border-t border-gray-50 pt-2">
                        <button
                          type="button"
                          onClick={() => { setDomesticCancelError(""); setDomesticCancelTarget(order); }}
                          className="text-[11px] font-semibold text-red-500 border border-red-200 bg-red-50 px-3 py-1.5 rounded-xl hover:bg-red-100 transition-colors"
                        >
                          배송 신청 취소
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── 해외 취소 모달 ── */}
      {cancelTarget && (
        <OrderCancelModal
          order={cancelTarget}
          error={cancelError}
          cancelling={cancelling}
          onClose={() => setCancelTarget(null)}
          onConfirm={confirmCancel}
        />
      )}

      {/* ── 국내 취소 확인 모달 ── */}
      {domesticCancelTarget && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl w-full max-w-[600px] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4">
            <h3 className="text-base font-bold text-gray-900">국내 배송 취소</h3>
            <p className="text-sm text-gray-600">
              <span className="font-semibold">{domesticCancelTarget.recipient_name}</span> 앞 배송 신청을 취소하시겠습니까?
            </p>
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800">
              취소 시 선택하신 물품 <span className="font-bold">{domesticCancelTarget.parcel_ids?.length ?? 0}개</span>가 스토리지로 돌아갑니다.
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
                {domesticCancelling
                  ? <Loader2 size={16} className="animate-spin mx-auto" />
                  : "취소 확인"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    }>
      <OrdersContent />
    </Suspense>
  );
}
