"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Search, CheckSquare, Square, Send, Plus, ClipboardList, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface InvoiceItem {
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

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PRE_REGISTERED: { label: "등록 완료",  color: "text-indigo-700 bg-indigo-50 border-indigo-200", dot: "bg-indigo-400" },
  PENDING_PICKUP: { label: "수거 신청", color: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  PICKED_UP:      { label: "수거 완료", color: "text-blue-700 bg-blue-50 border-blue-200",   dot: "bg-blue-400" },
  INBOUND:        { label: "입고 완료", color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-400" },
  INSPECTION:     { label: "검품 중",   color: "text-purple-700 bg-purple-50 border-purple-200", dot: "bg-purple-400" },
  HOLD:           { label: "보류",      color: "text-red-700 bg-red-50 border-red-200",       dot: "bg-red-400" },
  DONE:           { label: "처리 완료", color: "text-gray-600 bg-gray-50 border-gray-200",    dot: "bg-gray-400" },
};

const FILTER_TABS = [
  { key: "ALL",            label: "전체" },
  { key: "PRE_REGISTERED", label: "등록완료" },
  { key: "PENDING_PICKUP", label: "수거신청" },
  { key: "PICKED_UP",      label: "수거완료" },
  { key: "INBOUND",        label: "입고완료" },
  { key: "INSPECTION",     label: "검품중" },
  { key: "HOLD",           label: "보류" },
  { key: "DONE",           label: "처리완료" },
];

// 배송 신청 가능한 상태
const SHIPPABLE_STATUSES = new Set(["INBOUND", "INSPECTION"]);

export default function WarehousePage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadParcels = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("parcels")
      .select("id, tracking_no, status, sender_name, created_at, inbound_at, weight_actual, is_shippable, hold_reason, notes, tracking_status, tracking_last_event, pre_invoice_items")
      .eq("customer_id", user.id)
      .order("created_at", { ascending: false });
    setParcels(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadParcels();
  }, [loadParcels]);

  async function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetch("/api/parcels/sync-tracking", { method: "POST" });
    } catch {}
    await loadParcels();
    setRefreshing(false);
  }

  const filtered = parcels.filter((p) => {
    const matchStatus = filter === "ALL" || p.status === filter;
    const matchSearch =
      !search ||
      p.tracking_no?.includes(search) ||
      p.sender_name?.includes(search);
    return matchStatus && matchSearch;
  });

  function toggleSelect(id: string, shippable: boolean) {
    if (!shippable) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    const eligibleIds = filtered
      .filter((p) => SHIPPABLE_STATUSES.has(p.status) && p.is_shippable !== false)
      .map((p) => p.id);
    const allSelected = eligibleIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        eligibleIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        eligibleIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function handleShippingRequest() {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds).join(",");
    router.push(`/shipping-request?parcels=${ids}`);
  }

  const eligibleInFiltered = filtered.filter(
    (p) => SHIPPABLE_STATUSES.has(p.status) && p.is_shippable !== false
  );
  const allEligibleSelected =
    eligibleInFiltered.length > 0 &&
    eligibleInFiltered.every((p) => selectedIds.has(p.id));

  function handleParcelClick(parcel: Parcel) {
    const isSelectable = SHIPPABLE_STATUSES.has(parcel.status) && parcel.is_shippable !== false;
    // 선택 중인 항목이 있으면 선택 토글, 없으면 상세 페이지로
    if (selectedIds.size > 0 && isSelectable) {
      toggleSelect(parcel.id, isSelectable);
    } else {
      router.push(`/warehouse/${parcel.id}`);
    }
  }

  return (
    <div className="px-4 py-6 pb-36">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">📦 마이창고</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1.5 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50"
            title="추적 정보 새로고침"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => router.push("/register-parcel")}
            className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 px-3 py-1.5 rounded-full shadow-sm shadow-blue-200"
          >
            <Plus size={13} />
            물품 등록
          </button>
          {eligibleInFiltered.length > 0 && (
            <button
              onClick={selectAll}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-600 px-3 py-1.5 bg-blue-50 rounded-full"
            >
              {allEligibleSelected ? <CheckSquare size={13} /> : <Square size={13} />}
              {allEligibleSelected ? "선택 해제" : "전체 선택"}
            </button>
          )}
        </div>
      </div>

      {/* 검색 */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="송장번호 또는 발송인 검색"
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === key
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-500 border border-gray-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 선택 안내 */}
      {eligibleInFiltered.length > 0 && selectedIds.size === 0 && (
        <div className="bg-blue-50 rounded-xl px-4 py-2.5 mb-3 flex items-center gap-2">
          <CheckSquare size={14} className="text-blue-500 shrink-0" />
          <p className="text-xs text-blue-700">
            입고된 물품을 선택해서 해외배송을 신청할 수 있어요
          </p>
        </div>
      )}

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center">
          <Package size={44} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium mb-1">
            {filter === "PRE_REGISTERED" ? "등록된 물품이 없어요" : "입고된 물품이 없어요"}
          </p>
          <p className="text-xs text-gray-400 mb-5">
            쇼핑몰에서 창고 주소로 발송한 물품을<br />미리 등록해두세요
          </p>
          <button
            onClick={() => router.push("/register-parcel")}
            className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
          >
            <ClipboardList size={15} /> 물품 등록하기
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((parcel) => {
            const cfg = STATUS_CONFIG[parcel.status] ?? STATUS_CONFIG.DONE;
            const isSelectable =
              SHIPPABLE_STATUSES.has(parcel.status) && parcel.is_shippable !== false;
            const isSelected = selectedIds.has(parcel.id);

            return (
              <div
                key={parcel.id}
                onClick={() => handleParcelClick(parcel)}
                className={`bg-white rounded-2xl p-4 shadow-sm transition-all cursor-pointer ${
                  isSelected
                    ? "ring-2 ring-blue-500 shadow-blue-100"
                    : isSelectable
                    ? "hover:ring-1 hover:ring-blue-200"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    {/* 체크박스 */}
                    {isSelectable && (
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <CheckSquare size={18} className="text-blue-600" />
                        ) : (
                          <Square size={18} className="text-gray-300" />
                        )}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {parcel.tracking_no ?? "송장번호 미등록"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {parcel.sender_name ?? "발송인 미확인"}
                        {parcel.notes ? ` · ${parcel.notes}` : ""}
                      </p>
                      {parcel.pre_invoice_items && parcel.pre_invoice_items.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {parcel.pre_invoice_items[0].name_en}
                          {parcel.pre_invoice_items.length > 1 && ` 외 ${parcel.pre_invoice_items.length - 1}종`}
                          {" · "}총 {parcel.pre_invoice_items.reduce((s, i) => s + i.quantity, 0)}개
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>

                <div className={`flex items-center gap-4 text-xs text-gray-400 ${isSelectable ? "pl-7" : ""}`}>
                  <span>
                    입고:{" "}
                    {parcel.inbound_at
                      ? new Date(parcel.inbound_at).toLocaleDateString("ko-KR")
                      : "대기중"}
                  </span>
                  {parcel.weight_actual && (
                    <span>무게: {(parcel.weight_actual / 1000).toFixed(2)}kg</span>
                  )}
                </div>

                {parcel.status === "HOLD" && parcel.hold_reason && (
                  <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-red-600">⚠️ {parcel.hold_reason}</p>
                  </div>
                )}
                {parcel.status === "PRE_REGISTERED" && (
                  <div className="mt-2 bg-indigo-50 rounded-lg px-3 py-2">
                    {parcel.tracking_last_event ? (
                      <p className="text-xs text-indigo-700">
                        🚚 {parcel.tracking_last_event.statusLabel || parcel.tracking_last_event.description}
                        {parcel.tracking_last_event.location ? ` · ${parcel.tracking_last_event.location}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs text-indigo-600">📬 센터 도착 대기 중 · 도착 후 입고 처리됩니다</p>
                    )}
                  </div>
                )}
                {parcel.status === "PENDING_PICKUP" && (
                  <div className="mt-2 bg-yellow-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-yellow-700">📦 우체국 수거 예약 완료 · 집배원 방문 예정</p>
                  </div>
                )}
                {parcel.status === "PICKED_UP" && (
                  <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-blue-700">🚛 수거 완료 · 센터로 이동 중</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 해외배송 신청 FAB */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center px-4 z-40">
          <button
            onClick={handleShippingRequest}
            className="flex items-center gap-2.5 bg-blue-600 text-white font-bold px-6 py-4 rounded-2xl shadow-lg shadow-blue-200 text-sm active:scale-95 transition-transform"
          >
            <Send size={16} />
            {selectedIds.size}개 물품 출고신청
          </button>
        </div>
      )}
    </div>
  );
}
