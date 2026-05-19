"use client";

import { useEffect, useState } from "react";
import { Package, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  PENDING_PICKUP: { label: "수거 신청", color: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  PICKED_UP: { label: "수거 완료", color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-400" },
  INBOUND: { label: "입고 완료", color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-400" },
  INSPECTION: { label: "검품 중", color: "text-purple-700 bg-purple-50 border-purple-200", dot: "bg-purple-400" },
  HOLD: { label: "보류", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-400" },
  DONE: { label: "처리 완료", color: "text-gray-600 bg-gray-50 border-gray-200", dot: "bg-gray-400" },
};

const FILTER_TABS = [
  { key: "ALL", label: "전체" },
  { key: "INBOUND", label: "입고완료" },
  { key: "INSPECTION", label: "검품중" },
  { key: "HOLD", label: "보류" },
  { key: "DONE", label: "처리완료" },
];

export default function WarehousePage() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("parcels")
        .select("*")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => {
          setParcels(data ?? []);
          setLoading(false);
        });
    });
  }, []);

  const filtered = parcels.filter((p) => {
    const matchStatus = filter === "ALL" || p.status === filter;
    const matchSearch =
      !search ||
      p.tracking_no?.includes(search) ||
      p.sender_name?.includes(search);
    return matchStatus && matchSearch;
  });

  return (
    <div className="px-4 py-6">
      {/* 헤더 */}
      <h1 className="text-xl font-bold text-gray-900 mb-4">📦 마이창고</h1>

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
          <p className="text-gray-500 text-sm">입고된 물품이 없어요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((parcel) => {
            const cfg = STATUS_CONFIG[parcel.status] ?? STATUS_CONFIG.DONE;
            return (
              <div key={parcel.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {parcel.tracking_no ?? "송장번호 미등록"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {parcel.sender_name ?? "발송인 미확인"}
                    </p>
                  </div>
                  <span className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>
                    입고: {parcel.inbound_at
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
