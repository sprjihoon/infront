"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Package, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PickupParcel {
  id: string;
  status: string;
  pickup_date: string | null;
  pickup_tracking_no: string | null;
  tracking_no: string | null;
  created_at: string;
  pickup_requested_at: string | null;
  inbound_at: string | null;
  sender_name: string | null;
  pre_invoice_items: { name_en?: string; product_name?: string; quantity?: number }[] | null;
  notes: string | null;
}

type FilterKey = "ALL" | "REQUESTED" | "TRANSIT" | "INBOUND" | "DONE";

const FILTER_TABS: { key: FilterKey; label: string; statuses: string[] }[] = [
  { key: "ALL",       label: "전체",       statuses: [] },
  { key: "REQUESTED", label: "신청 완료",   statuses: ["CREATED", "PICKUP_REQUESTED", "PENDING_PICKUP"] },
  { key: "TRANSIT",   label: "이동 중",    statuses: ["PICKED_UP", "IN_TRANSIT"] },
  { key: "INBOUND",   label: "입고 처리 중", statuses: ["INBOUND", "INSPECTING", "INSPECTION"] },
  { key: "DONE",      label: "입고 완료",  statuses: ["SHIPPABLE", "READY", "DONE"] },
];

const ALL_STATUSES = FILTER_TABS.flatMap(t => t.statuses);

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  CREATED:           { label: "신청 완료",   color: "bg-gray-100 text-gray-600" },
  PICKUP_REQUESTED:  { label: "신청 완료",   color: "bg-gray-100 text-gray-600" },
  PENDING_PICKUP:    { label: "신청 완료",   color: "bg-gray-100 text-gray-600" },
  PICKED_UP:         { label: "이동 중",    color: "bg-blue-50 text-blue-600" },
  IN_TRANSIT:        { label: "이동 중",    color: "bg-blue-50 text-blue-600" },
  INBOUND:           { label: "입고 처리 중", color: "bg-brand-50 text-brand-600" },
  INSPECTING:        { label: "입고 처리 중", color: "bg-brand-50 text-brand-600" },
  INSPECTION:        { label: "입고 처리 중", color: "bg-brand-50 text-brand-600" },
  SHIPPABLE:         { label: "입고 완료",  color: "bg-green-50 text-green-600" },
  READY:             { label: "입고 완료",  color: "bg-green-50 text-green-600" },
  DONE:              { label: "입고 완료",  color: "bg-green-50 text-green-600" },
};

function getStepIndex(status: string): number {
  if (["CREATED", "PICKUP_REQUESTED", "PENDING_PICKUP"].includes(status)) return 0;
  if (["PICKED_UP", "IN_TRANSIT"].includes(status)) return 1;
  if (["INBOUND", "INSPECTING", "INSPECTION"].includes(status)) return 2;
  return 3;
}

function fmtDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

const STEPS = ["신청완료", "이동 중", "입고처리중", "입고완료"];

export default function PickupHistoryPage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<PickupParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data } = await supabase
      .from("parcels")
      .select("id, status, pickup_date, pickup_tracking_no, tracking_no, created_at, pickup_requested_at, inbound_at, sender_name, pre_invoice_items, notes")
      .eq("customer_id", user.id)
      .in("status", ALL_STATUSES)
      .order("created_at", { ascending: false });

    setParcels(data ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(parcelId: string) {
    if (!confirm("수거 신청을 취소하시겠습니까?")) return;
    setCancelling(parcelId);
    try {
      const res = await fetch(`/api/pickup/${parcelId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) { alert(body.error ?? "취소에 실패했습니다."); return; }
      await load();
    } finally {
      setCancelling(null);
    }
  }

  const filterTab = FILTER_TABS.find(t => t.key === filter)!;

  const filtered = parcels.filter(p => {
    if (filter !== "ALL" && !filterTab.statuses.includes(p.status)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const names = (p.pre_invoice_items ?? [])
        .map(i => i.product_name || i.name_en || "").join(" ").toLowerCase();
      if (!names.includes(q) && !(p.sender_name ?? "").toLowerCase().includes(q) && !(p.tracking_no ?? "").includes(q)) {
        return false;
      }
    }
    return true;
  });

  const counts = Object.fromEntries(
    FILTER_TABS.map(t => [
      t.key,
      t.key === "ALL"
        ? parcels.length
        : parcels.filter(p => t.statuses.includes(p.status)).length,
    ]),
  ) as Record<FilterKey, number>;

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
            <h1 className="text-base font-bold text-gray-900">입고 진행현황</h1>
            <p className="text-xs text-gray-400 mt-0.5">입고되는 물품의 진행 상태입니다.</p>
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
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="쇼핑몰명, 운송장번호 검색"
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>
        )}

        {/* ── 필터 탭 ── */}
        <div className="flex gap-2 px-4 pb-2.5 overflow-x-auto scrollbar-none">
          {FILTER_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === t.key
                  ? "bg-brand-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className={`ml-1 ${filter === t.key ? "text-white/70" : "text-gray-400"}`}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 목록 ── */}
      <div className="px-4 py-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 size={28} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Package size={40} className="text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-400">진행 중인 입고가 없습니다</p>
            <p className="text-xs text-gray-300 mt-1">수거 신청 후 여기서 확인할 수 있습니다</p>
          </div>
        ) : (
          filtered.map(p => {
            const stepIdx = getStepIndex(p.status);
            const statusInfo = STATUS_INFO[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-500" };
            const canCancel = ["CREATED", "PICKUP_REQUESTED", "PENDING_PICKUP"].includes(p.status);

            const totalItems = (p.pre_invoice_items ?? []).reduce((s, i) => s + (i.quantity ?? 1), 0);
            const shopName = p.sender_name || p.notes || "수거 물품";
            const dateStr = new Date(p.created_at).toLocaleDateString("ko-KR", {
              year: "numeric", month: "numeric", day: "numeric",
            });

            // 각 단계별 날짜
            const stepDates: (string | null)[] = [
              fmtDate(p.created_at),
              fmtDate(p.pickup_date ?? p.pickup_requested_at),
              fmtDate(p.inbound_at),
              stepIdx >= 3 ? fmtDate(p.inbound_at) : null,
            ];

            const displayId = p.tracking_no
              ? p.tracking_no
              : `PKG-${p.id.slice(0, 8).toUpperCase()}`;

            return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-3">

                  {/* 주문번호 + 상태 */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-mono text-gray-400 tracking-wide">
                      {displayId}
                    </p>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* 쇼핑몰명 */}
                  <p className="text-sm font-semibold text-gray-900 truncate mb-0.5">
                    {shopName}
                  </p>

                  {/* 배송 정보 */}
                  <p className="text-xs text-gray-400 mb-3">
                    택배 · {totalItems > 0 ? `${totalItems}개` : "1개"} · {dateStr}
                  </p>

                  {/* ── 진행 단계 트래커 ── */}
                  <div className="flex items-start">
                    {STEPS.map((label, i) => {
                      const done = stepIdx > i;
                      const active = stepIdx === i;
                      return (
                        <Fragment key={i}>
                          {/* 연결선 (첫 번째 제외) */}
                          {i > 0 && (
                            <div
                              className={`flex-1 h-0.5 mt-[7px] self-start transition-colors ${
                                done || active ? "bg-brand-500" : "bg-gray-200"
                              }`}
                            />
                          )}
                          <div className="flex flex-col items-center shrink-0">
                            {/* 점 */}
                            <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                              active  ? "border-brand-600 bg-brand-600 scale-125" :
                              done    ? "border-brand-400 bg-brand-400" :
                                        "border-gray-200 bg-white"
                            }`} />
                            {/* 레이블 */}
                            <p className={`text-[9px] font-medium mt-1 text-center leading-tight whitespace-nowrap ${
                              active ? "text-brand-600 font-bold" :
                              done   ? "text-gray-500" :
                                       "text-gray-300"
                            }`}>
                              {label}
                            </p>
                            {/* 날짜 */}
                            {stepDates[i] ? (
                              <p className="text-[9px] text-gray-400 mt-0.5">
                                {stepDates[i]}
                              </p>
                            ) : (
                              <p className="text-[9px] text-transparent mt-0.5">-</p>
                            )}
                          </div>
                        </Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* 취소 버튼 */}
                {canCancel && (
                  <div className="px-4 pb-3 pt-2 border-t border-gray-50">
                    <button
                      onClick={() => handleCancel(p.id)}
                      disabled={cancelling === p.id}
                      className="flex items-center gap-1 text-[11px] font-semibold text-red-500 border border-red-200 bg-red-50 px-3 py-1.5 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
                    >
                      <X size={11} />
                      {cancelling === p.id ? "취소 중..." : "수거 취소"}
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="px-4 pb-8 pt-2">
        <button
          onClick={() => router.push("/pickup")}
          className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl text-sm active:scale-[0.98] transition-transform"
        >
          새 수거 신청
        </button>
      </div>
    </div>
  );
}
