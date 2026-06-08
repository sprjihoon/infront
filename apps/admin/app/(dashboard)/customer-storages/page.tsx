"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Search, RefreshCw, ChevronRight,
  CheckCircle, AlertTriangle, XCircle, Archive,
  Clock,
} from "lucide-react";

interface CustomerInfo {
  name: string | null;
  email: string;
  customer_code: string;
}

interface StorageRow {
  id: string;
  storage_name: string;
  storage_mode: "short_term" | "long_term";
  plan_type: string | null;
  capacity_score: number | null;
  used_score: number;
  usage_percent: number;
  status: string;
  short_term_started_at: string | null;
  paid_until_date: string | null;
  next_billing_date: string | null;
  created_at: string;
  customers: CustomerInfo | null;
  storage_plan_config: { label_ko: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ACTIVE:    { label: "이용 중",      color: "text-green-700 bg-green-100",   icon: CheckCircle },
  EMPTY:     { label: "비어있음",     color: "text-gray-600 bg-gray-100",     icon: Archive },
  SUSPENDED: { label: "서비스 제한",  color: "text-orange-700 bg-orange-100", icon: AlertTriangle },
  OVERDUE:   { label: "장기 미납",    color: "text-red-700 bg-red-100",       icon: XCircle },
  CANCELLED: { label: "해지",         color: "text-gray-400 bg-gray-100",     icon: XCircle },
};

function calcWeeks(startedAt: string | null) {
  if (!startedAt) return 0;
  return Math.ceil((Date.now() - new Date(startedAt).getTime()) / (7 * 24 * 60 * 60 * 1000));
}

export default function AdminCustomerStoragesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<StorageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterMode, setFilterMode] = useState<string>("ALL");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterMode !== "ALL") params.set("mode", filterMode);
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/admin/customer-storages?${params}`);
      const json = await res.json();
      setRows(json.storages ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterStatus, filterMode, search]);

  useEffect(() => { load(); }, [load]);

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const suspended = rows.filter((r) => r.status === "SUSPENDED" || r.status === "OVERDUE");

  return (
    <div className="p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">고객 보관 서비스</h1>
          <p className="text-sm text-gray-500 mt-0.5">총 {rows.length}개 스토리지</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 rounded-xl px-3 py-2 hover:bg-gray-50"
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* 미납 알림 */}
      {suspended.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-red-600" />
            <p className="text-sm font-bold text-red-700">
              결제 문제 고객 {suspended.length}명 확인 필요
            </p>
          </div>
          <div className="space-y-1">
            {suspended.slice(0, 3).map((r) => (
              <button
                key={r.id}
                onClick={() => router.push(`/customer-storages/${r.id}`)}
                className="flex items-center justify-between w-full text-xs text-red-700 hover:underline"
              >
                <span>
                  {r.customers?.name ?? r.customers?.email ?? "-"} — {r.storage_name}
                </span>
                <span className={STATUS_CONFIG[r.status]?.label}>{STATUS_CONFIG[r.status]?.label}</span>
              </button>
            ))}
            {suspended.length > 3 && (
              <p className="text-xs text-red-500">...외 {suspended.length - 3}건</p>
            )}
          </div>
        </div>
      )}

      {/* 요약 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: "ACTIVE",    label: "이용 중",     color: "text-green-700 bg-green-50" },
          { key: "EMPTY",     label: "비어있음",    color: "text-gray-600 bg-gray-100" },
          { key: "SUSPENDED", label: "서비스 제한", color: "text-orange-700 bg-orange-50" },
          { key: "OVERDUE",   label: "장기 미납",   color: "text-red-700 bg-red-50" },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilterStatus(filterStatus === key ? "ALL" : key)}
            className={`rounded-2xl p-3 border-2 transition-all text-left ${
              filterStatus === key ? "border-brand-400 " : "border-transparent "
            } ${color}`}
          >
            <p className="text-2xl font-black">{statusCounts[key] ?? 0}</p>
            <p className="text-xs font-medium mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Search size={15} className="text-gray-400 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명, 이메일, 고객번호 검색"
            className="flex-1 text-sm outline-none"
          />
        </div>
        <select
          value={filterMode}
          onChange={(e) => setFilterMode(e.target.value)}
          className="bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
        >
          <option value="ALL">전체 방식</option>
          <option value="short_term">단기보관</option>
          <option value="long_term">장기보관</option>
        </select>
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw size={24} className="animate-spin text-gray-300" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Package size={32} className="text-gray-200" />
          <p className="text-sm text-gray-400">조건에 맞는 스토리지가 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_100px_100px_100px_32px] text-xs font-semibold text-gray-500 bg-gray-50 px-4 py-2.5 border-b border-gray-100">
            <span>고객</span>
            <span>스토리지</span>
            <span>방식</span>
            <span>용량</span>
            <span>상태</span>
            <span></span>
          </div>
          <div className="divide-y divide-gray-50">
            {rows.map((r) => {
              const sCfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.ACTIVE;
              const SIcon = sCfg.icon;
              const weeksUsed = calcWeeks(r.short_term_started_at);
              return (
                <button
                  key={r.id}
                  onClick={() => router.push(`/customer-storages/${r.id}`)}
                  className="w-full grid grid-cols-[1fr_1fr_100px_100px_100px_32px] items-center px-4 py-3.5 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {r.customers?.name ?? "-"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{r.customers?.customer_code}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{r.storage_name}</p>
                    <p className="text-xs text-gray-400">
                      {r.storage_plan_config?.label_ko ?? r.plan_type ?? "-"}
                    </p>
                  </div>
                  <div>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                      r.storage_mode === "short_term"
                        ? "bg-sky-100 text-sky-700"
                        : "bg-violet-100 text-violet-700"
                    }`}>
                      {r.storage_mode === "short_term" ? "단기" : "장기"}
                    </span>
                    {r.storage_mode === "short_term" && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{weeksUsed}주 경과</p>
                    )}
                    {r.storage_mode === "long_term" && r.paid_until_date && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        <Clock size={9} className="text-gray-400" />
                        <span className="text-[10px] text-gray-400">
                          {new Date(r.paid_until_date).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    {r.capacity_score != null ? (
                      <>
                        <div className="flex items-center gap-1">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${
                                (r.usage_percent ?? 0) >= 90
                                  ? "bg-red-500"
                                  : (r.usage_percent ?? 0) >= 70
                                  ? "bg-orange-400"
                                  : "bg-brand-500"
                              }`}
                              style={{ width: `${Math.min(r.usage_percent ?? 0, 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 shrink-0">
                            {Math.round(r.usage_percent ?? 0)}%
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {r.used_score}/{r.capacity_score}점
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${sCfg.color}`}>
                    <SIcon size={10} />
                    {sCfg.label}
                  </span>
                  <ChevronRight size={14} className="text-gray-300" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
