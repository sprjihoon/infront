"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Search,
  CheckSquare,
  Square,
  Send,
  Plus,
  ClipboardList,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parcelIdsInActiveOrders } from "@/lib/order-reservation";
import { formatParcelItemTitle } from "@/lib/parcel-item-display";
import { isParcelShippable } from "@/lib/parcel-shippable";
import {
  getParcelDisplaySummary,
  getWarehouseEmptyMessage,
  matchesWarehouseFilter,
  WAREHOUSE_FILTER_TABS,
  type WarehouseFilterKey,
} from "@/lib/parcel-display";
import { isParcelVisibleInWarehouse } from "@/lib/parcel-lifecycle";

interface InvoiceItem {
  product_name?: string;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
}

interface Parcel {
  id: string;
  tracking_no: string | null;
  status: string;
  sender_name: string | null;
  created_at: string;
  inbound_at: string | null;
  weight_actual: number | null;
  is_shippable: boolean | null;
  hold_reason: string | null;
  notes: string | null;
  tracking_status: string | null;
  tracking_last_event: { statusLabel: string; description: string; location: string; time: string } | null;
  pre_invoice_items: InvoiceItem[] | null;
}

const WAREHOUSE_PAGE_SIZE = 15;

export default function WarehousePage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [filter, setFilter] = useState<WarehouseFilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reservedParcelIds, setReservedParcelIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const loadParcels = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data }, { data: reservedLinks }] = await Promise.all([
      supabase
        .from("parcels")
        .select("id, tracking_no, status, sender_name, created_at, inbound_at, weight_actual, is_shippable, hold_reason, notes, tracking_status, tracking_last_event, pre_invoice_items")
        .eq("customer_id", user.id)
        .neq("status", "DONE")
        .order("created_at", { ascending: false }),
      supabase
        .from("order_parcels")
        .select("parcel_id, orders!inner(status, customer_id)")
        .eq("orders.customer_id", user.id),
    ]);
    setReservedParcelIds(parcelIdsInActiveOrders(reservedLinks, user.id));
    setParcels((data ?? []).filter(isParcelVisibleInWarehouse));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadParcels();
  }, [loadParcels]);

  const shippableParcels = useMemo(
    () => parcels.filter((p) => isParcelShippable(p) && !reservedParcelIds.has(p.id)),
    [parcels, reservedParcelIds],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<WarehouseFilterKey, number> = {
      ALL: parcels.length,
      IN_TRANSIT: 0,
      AT_WAREHOUSE: 0,
      READY_TO_SHIP: 0,
      ATTENTION: 0,
    };
    for (const parcel of parcels) {
      for (const tab of WAREHOUSE_FILTER_TABS) {
        if (tab.key !== "ALL" && matchesWarehouseFilter(parcel, tab.key)) {
          counts[tab.key] += 1;
        }
      }
    }
    return counts;
  }, [parcels]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/parcels/sync-tracking", { method: "POST" });
    } catch {}
    await loadParcels();
    setRefreshing(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parcels.filter((p) => {
      if (selectMode && !isParcelShippable(p)) return false;
      if (selectMode && reservedParcelIds.has(p.id)) return false;
      if (!matchesWarehouseFilter(p, filter)) return false;
      if (!q) return true;
      return (
        p.tracking_no?.includes(q) ||
        p.sender_name?.includes(q) ||
        (p.pre_invoice_items?.some(
          (item) =>
            item.product_name?.toLowerCase().includes(q) ||
            item.name_en?.toLowerCase().includes(q),
        ) ?? false)
      );
    });
  }, [parcels, selectMode, reservedParcelIds, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / WAREHOUSE_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * WAREHOUSE_PAGE_SIZE;
  const paginated = filtered.slice(pageStart, pageStart + WAREHOUSE_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [filter, search, selectMode]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const eligibleIds = filtered.map((p) => p.id);
    const allSelected = eligibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) eligibleIds.forEach((id) => next.delete(id));
      else eligibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  function enterSelectMode() {
    setSelectMode(true);
    setFilter("READY_TO_SHIP");
    setSelectedIds(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function handleShippingRequest() {
    if (selectedIds.size === 0) return;
    router.push(`/shipping-request?parcels=${Array.from(selectedIds).join(",")}`);
  }

  const allEligibleSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));

  function handleParcelClick(parcel: Parcel) {
    if (selectMode) {
      toggleSelect(parcel.id);
      return;
    }
    router.push(`/warehouse/${parcel.id}`);
  }

  const emptyMessage = getWarehouseEmptyMessage(filter);

  return (
    <div className="px-4 py-6 pb-36">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {selectMode ? "출고 물품 선택" : "📦 마이창고"}
          </h1>
          {selectMode && (
            <p className="text-xs text-gray-500 mt-0.5">출고할 물품을 선택하세요</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <button
              onClick={exitSelectMode}
              className="flex items-center gap-1 text-xs font-medium text-gray-600 px-3 py-1.5 bg-gray-100 rounded-full"
            >
              <X size={13} />
              취소
            </button>
          ) : (
            <>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-1.5 rounded-full text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50"
                title="추적 정보 새로고침"
              >
                <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => router.push("/register-parcel")}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-brand-600 px-3 py-1.5 rounded-full shadow-sm shadow-brand-200"
              >
                <Plus size={13} />
                물품 등록
              </button>
              {shippableParcels.length > 0 && (
                <button
                  onClick={enterSelectMode}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand-700 px-3 py-1.5 bg-brand-50 rounded-full"
                >
                  <Send size={13} />
                  출고 신청
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="송장번호, 발송인, 제품명 검색"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {!selectMode && (
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          {WAREHOUSE_FILTER_TABS.map(({ key, label }) => {
            const count = filterCounts[key];
            return (
              <button
                key={key}
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
      )}

      {selectMode && filtered.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-brand-700">
            출고 가능 {filtered.length}건
          </p>
          <button
            onClick={selectAll}
            className="flex items-center gap-1 text-xs font-medium text-brand-600"
          >
            {allEligibleSelected ? <CheckSquare size={13} /> : <Square size={13} />}
            {allEligibleSelected ? "전체 해제" : "전체 선택"}
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center">
          <Package size={44} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium mb-1 whitespace-pre-line">
            {emptyMessage.title}
          </p>
          <p className="text-xs text-gray-400 mb-5 whitespace-pre-line">
            {emptyMessage.desc}
          </p>
          {!selectMode && (
            <button
              onClick={() => router.push("/register-parcel")}
              className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
            >
              <ClipboardList size={15} /> 물품 등록하기
            </button>
          )}
        </div>
      ) : (
        <>
        <div className="space-y-3">
          {paginated.map((parcel) => {
            const itemTitle = formatParcelItemTitle(parcel.pre_invoice_items);
            const isReserved = reservedParcelIds.has(parcel.id);
            const isSelected = selectedIds.has(parcel.id);
            const summary = getParcelDisplaySummary(parcel, { isReserved });
            const title = itemTitle || parcel.tracking_no || "물품 미등록";
            const secondary =
              itemTitle && parcel.tracking_no
                ? parcel.tracking_no
                : parcel.sender_name ?? null;

            return (
              <div
                key={parcel.id}
                onClick={() => handleParcelClick(parcel)}
                className={`bg-white rounded-2xl p-4 shadow-sm transition-all cursor-pointer ${
                  isSelected
                    ? "ring-2 ring-brand-500 shadow-brand-100"
                    : selectMode
                    ? "hover:ring-1 hover:ring-brand-200"
                    : "active:scale-[0.99]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {selectMode && (
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckSquare size={18} className="text-brand-600" />
                        ) : (
                          <Square size={18} className="text-gray-300" />
                        )}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate" title={title}>
                        {title}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{summary.subtitle}</p>
                      {(secondary || summary.meta) && (
                        <p className="text-xs text-gray-400 mt-1 truncate">
                          {[secondary, summary.meta].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${summary.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${summary.dotClass}`} />
                    {summary.badgeLabel}
                  </span>
                </div>

                {summary.alert && (
                  <p className="text-xs text-red-600 mt-2 pl-0">{summary.alert}</p>
                )}
              </div>
            );
          })}
        </div>

        {filtered.length > WAREHOUSE_PAGE_SIZE && (
          <div className="mt-5 flex flex-col items-center gap-2">
            <p className="text-xs text-gray-400">
              {pageStart + 1}–{Math.min(pageStart + WAREHOUSE_PAGE_SIZE, filtered.length)} / 총 {filtered.length}건
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

      {selectMode && selectedIds.size > 0 && (
        <div
          className="fixed left-0 right-0 flex justify-center px-4 z-40"
          style={{ bottom: "calc(60px + var(--sab, 0px) + 12px)" }}
        >
          <button
            onClick={handleShippingRequest}
            className="flex items-center gap-2.5 bg-brand-600 text-white font-bold px-6 py-4 rounded-2xl shadow-lg shadow-brand-200 text-sm active:scale-95 transition-transform"
          >
            <Send size={16} />
            {selectedIds.size}개 물품 출고신청
          </button>
        </div>
      )}
    </div>
  );
}
