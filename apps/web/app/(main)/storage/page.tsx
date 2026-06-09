"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Plus, ChevronRight, Clock, CheckCircle,
  AlertTriangle, XCircle, RefreshCw, Archive,
} from "lucide-react";
import Link from "next/link";

interface PlanConfig {
  label_ko: string;
  label_en: string;
  weekly_rate: number | null;
}

interface Storage {
  id: string;
  storage_name: string;
  storage_mode: "short_term" | "long_term";
  plan_type: string | null;
  current_plan_type: string | null;
  monthly_amount: number | null;
  capacity_score: number | null;
  used_score: number;
  usage_percent: number;
  status: string;
  short_term_started_at: string | null;
  paid_until_date: string | null;
  next_billing_date: string | null;
  created_at: string;
  storage_plan_config: PlanConfig | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ACTIVE:    { label: "이용 중",      color: "text-green-600 bg-green-50",   icon: CheckCircle },
  EMPTY:     { label: "비어있음",     color: "text-gray-500 bg-gray-100",    icon: Archive },
  SUSPENDED: { label: "서비스 제한",  color: "text-orange-600 bg-orange-50", icon: AlertTriangle },
  OVERDUE:   { label: "장기 미납",    color: "text-red-600 bg-red-50",       icon: XCircle },
  CANCELLED: { label: "해지됨",       color: "text-gray-400 bg-gray-100",    icon: XCircle },
};

function calcWeeksUsed(startedAt: string | null): number {
  if (!startedAt) return 0;
  const diff = Date.now() - new Date(startedAt).getTime();
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

function CapacityBar({ percent }: { percent: number }) {
  const p = Math.min(Math.max(percent, 0), 100);
  const color = p >= 90 ? "bg-red-500" : p >= 70 ? "bg-orange-400" : "bg-brand-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${p}%` }} />
    </div>
  );
}

export default function StoragePage() {
  const router = useRouter();
  const [storages, setStorages] = useState<Storage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch("/api/storage");
      if (res.status === 401) { router.push("/login"); return; }
      const json = await res.json();
      setStorages(json.storages ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const active = storages.filter((s) => s.status !== "CANCELLED");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-base font-bold text-gray-900">보관 서비스</h1>
          <p className="text-xs text-gray-400 mt-0.5">물품을 안전하게 보관해 드립니다</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <RefreshCw size={16} className={`text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/storage/new"
            className="flex items-center gap-1 bg-brand-600 text-white text-xs font-semibold px-3 py-2 rounded-xl"
          >
            <Plus size={14} />
            신청
          </Link>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <RefreshCw size={24} className="animate-spin text-gray-300" />
            <p className="text-sm text-gray-400">불러오는 중...</p>
          </div>
        ) : active.length === 0 ? (
          <EmptyState />
        ) : (
          active.map((s) => (
            <StorageCard
              key={s.id}
              storage={s}
              onClick={() => router.push(`/storage/${s.id}`)}
            />
          ))
        )}
      </div>

      {/* 안내 배너 */}
      {!loading && (
        <div className="mx-4 mb-6 bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-bold text-blue-700 mb-1.5">📦 보관 서비스 안내</p>
          <ul className="space-y-1">
            {[
              "수거 후 당일~1 영업일 내 입고 완료",
              "단기보관: 출고 시 주 단위 정산",
              "장기보관: 월정액 자동결제 (최초 1개월 선납)",
              "물품 검품/사진촬영 서비스 별도 제공",
            ].map((t) => (
              <li key={t} className="flex items-start gap-1.5">
                <span className="text-blue-400 mt-0.5">•</span>
                <span className="text-xs text-blue-700">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StorageCard({ storage: s, onClick }: { storage: Storage; onClick: () => void }) {
  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.ACTIVE;
  const StatusIcon = cfg.icon;
  const planLabel = s.storage_plan_config?.label_ko ?? s.plan_type ?? "-";
  const weeksUsed = calcWeeksUsed(s.short_term_started_at);

  return (
    <button
      onClick={onClick}
      className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center">
            <Package size={18} className="text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900 leading-tight">{s.storage_name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {s.storage_mode === "short_term" ? "단기보관" : "장기보관"}
              {planLabel !== "-" && ` · ${planLabel}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full ${cfg.color}`}>
            <StatusIcon size={10} />
            {cfg.label}
          </span>
          <ChevronRight size={16} className="text-gray-300" />
        </div>
      </div>

      {/* 용량 바 */}
      {s.capacity_score != null && (
        <div className="mb-3">
          <div className="flex justify-between text-[11px] text-gray-500 mb-1">
            <span>보관 용량</span>
            <span className="font-medium">
              {s.used_score}개 / 최대 {s.capacity_score}개
              <span className="text-gray-400 ml-1">({Math.round(s.usage_percent ?? 0)}%)</span>
            </span>
          </div>
          <CapacityBar percent={s.usage_percent ?? 0} />
        </div>
      )}

      {/* 요금 정보 */}
      <div className="flex gap-4 text-[11px]">
        {s.storage_mode === "short_term" ? (
          <>
            <div>
              <span className="text-gray-400">보관 기간</span>
              <span className="ml-1 font-semibold text-gray-700">{weeksUsed}주</span>
            </div>
            {s.storage_plan_config?.weekly_rate != null && (
              <div>
                <span className="text-gray-400">주간 요금</span>
                <span className="ml-1 font-semibold text-gray-700">
                  {s.storage_plan_config.weekly_rate.toLocaleString()}원
                </span>
              </div>
            )}
          </>
        ) : (
          <>
            {s.paid_until_date && (
              <div className="flex items-center gap-1">
                <Clock size={11} className="text-gray-400" />
                <span className="text-gray-400">만료</span>
                <span className="ml-0.5 font-semibold text-gray-700">
                  {new Date(s.paid_until_date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                </span>
              </div>
            )}
            {s.monthly_amount != null && (
              <div>
                <span className="text-gray-400">월 요금</span>
                <span className="ml-1 font-semibold text-gray-700">
                  {s.monthly_amount.toLocaleString()}원
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {s.status === "SUSPENDED" && (
        <div className="mt-2 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-xs text-orange-700 font-medium">
          결제 실패로 서비스가 제한되었습니다. 결제 정보를 확인해 주세요.
        </div>
      )}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Archive size={28} className="text-gray-300" />
      </div>
      <p className="text-sm font-bold text-gray-700 mb-1">보관 중인 물품이 없습니다</p>
      <p className="text-xs text-gray-400 text-center mb-5">
        계절 옷, 이사 짐, 유학 준비물 등<br />
        무엇이든 안전하게 보관해 드립니다
      </p>
      <Link
        href="/storage/new"
        className="flex items-center gap-2 bg-brand-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl"
      >
        <Plus size={16} />
        보관 서비스 신청하기
      </Link>
    </div>
  );
}
