"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Package, Truck, X, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface PickupParcel {
  id: string;
  status: string;
  pickup_date: string | null;
  pickup_address: string | null;
  pickup_tracking_no: string | null;
  tracking_no: string | null;
  created_at: string;
  pickup_requested_at: string | null;
  pre_invoice_items: { name_en?: string; product_name?: string; quantity?: number }[] | null;
  notes: string | null;
}

const STATUS_GROUPS = {
  before: {
    label: "수거 전",
    icon: Package,
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    statuses: ["CREATED", "PICKUP_REQUESTED", "PENDING_PICKUP"],
    canCancel: true,
  },
  transit: {
    label: "이동 중",
    icon: Truck,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    statuses: ["PICKED_UP", "IN_TRANSIT"],
    canCancel: false,
  },
  inbound: {
    label: "입고 중",
    icon: Package,
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    statuses: ["INBOUND", "INSPECTING", "INSPECTION"],
    canCancel: false,
  },
} as const;

type GroupKey = keyof typeof STATUS_GROUPS;

const STATUS_LABEL: Record<string, string> = {
  CREATED:           "수거 대기",
  PICKUP_REQUESTED:  "수거 신청",
  PENDING_PICKUP:    "수거 예약",
  PICKED_UP:         "수거 완료",
  IN_TRANSIT:        "이동 중",
  INBOUND:           "입고 중",
  INSPECTING:        "검수 중",
  INSPECTION:        "검수 중",
};

export default function PickupHistoryPage() {
  const router = useRouter();
  const [parcels, setParcels] = useState<PickupParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<GroupKey>("before");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const allStatuses = Object.values(STATUS_GROUPS).flatMap(g => g.statuses);
    const { data } = await supabase
      .from("parcels")
      .select("id, status, pickup_date, pickup_address, pickup_tracking_no, tracking_no, created_at, pickup_requested_at, pre_invoice_items, notes")
      .eq("customer_id", user.id)
      .in("status", allStatuses)
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
      const data = await res.json();
      if (!res.ok) { alert(data.error ?? "취소에 실패했습니다."); return; }
      await load();
    } finally {
      setCancelling(null);
    }
  }

  const group = STATUS_GROUPS[tab];
  const filtered = parcels.filter(p => (group.statuses as readonly string[]).includes(p.status));
  const counts = Object.fromEntries(
    Object.entries(STATUS_GROUPS).map(([k, g]) => [
      k,
      parcels.filter(p => (g.statuses as readonly string[]).includes(p.status)).length,
    ])
  ) as Record<GroupKey, number>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 rounded-full hover:bg-gray-100">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-base font-bold text-gray-900">수거 현황</h1>
            <p className="text-xs text-gray-400">수거·입고 진행 중인 물품</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-full hover:bg-gray-100">
          <RefreshCw size={16} className={`text-gray-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-1">
        {(Object.entries(STATUS_GROUPS) as [GroupKey, typeof STATUS_GROUPS[GroupKey]][]).map(([key, g]) => {
          const Icon = g.icon;
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-semibold border-b-2 transition-colors ${
                active ? `${g.color} border-current` : "text-gray-400 border-transparent"
              }`}
            >
              <Icon size={14} />
              {g.label}
              {counts[key] > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active ? `${g.bg} ${g.color}` : "bg-gray-100 text-gray-500"}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 목록 */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-gray-300" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <group.icon size={36} className="text-gray-200 mb-3" />
            <p className="text-sm font-semibold text-gray-400">{group.label} 건이 없습니다</p>
          </div>
        ) : (
          filtered.map(p => {
            const itemNames = (p.pre_invoice_items ?? [])
              .slice(0, 2)
              .map(i => i.product_name || i.name_en || "물품")
              .filter(Boolean)
              .join(", ");
            const extraCount = (p.pre_invoice_items?.length ?? 0) - 2;

            return (
              <div key={p.id} className={`bg-white rounded-2xl border ${group.border} overflow-hidden`}>
                <div className="px-4 py-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {/* 상태 배지 */}
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full mb-1.5 ${group.bg} ${group.color}`}>
                        <group.icon size={10} />
                        {STATUS_LABEL[p.status] ?? p.status}
                      </span>
                      {/* 물품명 */}
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {itemNames || p.notes || "물품"}
                        {extraCount > 0 && <span className="text-gray-400 font-normal"> 외 {extraCount}건</span>}
                      </p>
                      {/* 수거일 */}
                      {p.pickup_date && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          수거 예정일 {new Date(p.pickup_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </p>
                      )}
                      {/* 운송장 */}
                      {(p.pickup_tracking_no || p.tracking_no) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          운송장 {p.pickup_tracking_no ?? p.tracking_no}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {/* 취소 버튼 (수거 전만) */}
                      {group.canCancel && (
                        <button
                          onClick={() => handleCancel(p.id)}
                          disabled={cancelling === p.id}
                          className="flex items-center gap-1 text-[11px] font-semibold text-red-500 border border-red-200 bg-red-50 px-2.5 py-1.5 rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors"
                        >
                          <X size={11} />
                          {cancelling === p.id ? "취소 중..." : "수거 취소"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 수거 신청 버튼 */}
      <div className="px-4 pb-6">
        <button
          onClick={() => router.push("/pickup")}
          className="w-full bg-brand-600 text-white font-bold py-4 rounded-2xl text-sm"
        >
          새 수거 신청
        </button>
      </div>
    </div>
  );
}
