"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Plus, RefreshCw, Archive,
  Clock, ChevronRight,
} from "lucide-react";
import Link from "next/link";

/* ─── 타입 ──────────────────────────────────────── */
interface PlanConfig {
  label_ko: string;
  weekly_rate: number | null;
  monthly_amount?: number | null;
}

interface Storage {
  id: string;
  storage_name: string;
  storage_mode: "short_term" | "long_term";
  plan_type: string | null;
  monthly_amount: number | null;
  capacity_score: number | null;
  used_score: number;
  usage_percent: number;
  status: string;
  short_term_started_at: string | null;
  next_billing_date: string | null;
  paid_until_date: string | null;
  created_at: string;
  storage_plan_config: PlanConfig | null;
}

interface ProductItem {
  id: string;
  parcel_id: string;
  tracking_no: string | null;
  storage_id: string | null;
  name: string;
  quantity: number;
  parcel_status: string;
  inbound_at: string | null;
}

/* ─── 상수 ──────────────────────────────────────── */
const PLAN_SIZE_LABEL: Record<string, string> = {
  S: "소형", M: "중형", L: "대형", XL: "특대형",
};

const PARCEL_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  CREATED:          { label: "수거 대기",  color: "bg-yellow-100 text-yellow-700" },
  PICKUP_REQUESTED: { label: "수거 신청",  color: "bg-blue-100 text-blue-700" },
  IN_TRANSIT:       { label: "이동 중",   color: "bg-purple-100 text-purple-700" },
  INBOUND:          { label: "보관 중",   color: "bg-green-100 text-green-700" },
  INSPECTING:       { label: "검수 중",   color: "bg-blue-100 text-blue-700" },
  HOLD:             { label: "보류",      color: "bg-orange-100 text-orange-700" },
  READY:            { label: "출고 가능",  color: "bg-teal-100 text-teal-700" },
};

/* ─── 유틸 ──────────────────────────────────────── */
const FREE_DAYS = 3;

function calcFreeInfo(startedAt: string | null) {
  if (!startedAt) return { inFreePeriod: true, freeDaysLeft: FREE_DAYS, billableWeeks: 0 };
  const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86400000);
  const inFreePeriod = days < FREE_DAYS;
  return {
    inFreePeriod,
    freeDaysLeft: Math.max(0, FREE_DAYS - days),
    billableWeeks: inFreePeriod ? 0 : Math.ceil((days - FREE_DAYS + 1) / 7),
  };
}

function ProgressBar({ percent }: { percent: number }) {
  const p = Math.min(Math.max(percent, 0), 100);
  const color = p >= 90 ? "bg-red-500" : p >= 70 ? "bg-orange-400" : "bg-brand-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${p}%` }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   메인 페이지
══════════════════════════════════════════════════ */
export default function StoragePage() {
  const router = useRouter();
  const [storages, setStorages] = useState<Storage[]>([]);
  const [items, setItems] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>("전체");

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [storageRes, itemsRes] = await Promise.all([
        fetch("/api/storage"),
        fetch("/api/storage/all-items"),
      ]);
      if (storageRes.status === 401) { router.push("/login"); return; }
      const storageJson = await storageRes.json();
      const itemsJson = itemsRes.ok ? await itemsRes.json() : { items: [] };
      setStorages(storageJson.storages ?? []);
      setItems(itemsJson.items ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const active = storages.filter((s) => s.status !== "CANCELLED");

  /* 요약 */
  const totalMonthly = active.reduce((sum, s) => sum + (s.monthly_amount ?? 0), 0);
  const nextBilling = active
    .map((s) => s.next_billing_date ?? s.paid_until_date)
    .filter(Boolean)
    .sort()[0] ?? null;

  const filterTabs = ["전체", ...active.map((s) => s.storage_name)];
  const filteredItems =
    itemFilter === "전체"
      ? items
      : items.filter((it) => {
          const s = active.find((st) => st.id === it.storage_id);
          return s?.storage_name === itemFilter;
        });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-[calc(60px+var(--sab,0px))]">

      {/* ── 헤더 ─────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="text-base font-bold text-gray-900">내 스토리지</h1>
          <p className="text-xs text-gray-400 mt-0.5">물품을 안전하게 보관해 드립니다</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-gray-100"
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

      <div className="px-4 py-4 space-y-4">

        {active.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── 전체 요약 카드 ───────────────────── */}
            <div className="bg-brand-600 rounded-2xl p-4 text-white">
              <p className="text-xs font-semibold text-brand-200 mb-3">전체 요약</p>
              <div className="grid grid-cols-3 gap-2">
                <SummaryCell label="이용 중" value={`${active.length}개`} />
                <SummaryCell
                  label="월 이용료"
                  value={totalMonthly > 0 ? `${totalMonthly.toLocaleString()}원` : "-"}
                />
                <SummaryCell
                  label="다음 결제일"
                  value={
                    nextBilling
                      ? new Date(nextBilling).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
                      : "-"
                  }
                />
              </div>
            </div>

            {/* ── 스토리지 카드 목록 (2열) ─────────── */}
            <div className="grid grid-cols-2 gap-3">
              {active.map((s) => (
                <StorageCard
                  key={s.id}
                  storage={s}
                  itemCount={items.filter((it) => it.storage_id === s.id).length}
                  onDetail={() => router.push(`/storage/${s.id}`)}
                />
              ))}
            </div>

            {/* ── 물품 목록 ────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* 헤더 */}
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <p className="text-sm font-bold text-gray-900">물품 목록</p>
                <span className="text-xs text-gray-400">{filteredItems.length}개</span>
              </div>

              {/* 필터 탭 */}
              <div className="flex overflow-x-auto border-b border-gray-50 px-2 gap-0.5">
                {filterTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setItemFilter(tab)}
                    className={`shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      itemFilter === tab
                        ? "border-brand-600 text-brand-600"
                        : "border-transparent text-gray-400"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* 물품 행 */}
              {filteredItems.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2">
                  <Package size={24} className="text-gray-200" />
                  <p className="text-xs text-gray-400">물품이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredItems.map((item) => {
                    const storageName =
                      active.find((s) => s.id === item.storage_id)?.storage_name ?? "-";
                    const statusCfg =
                      PARCEL_STATUS_DISPLAY[item.parcel_status] ?? { label: "보관 중", color: "bg-green-100 text-green-700" };
                    return (
                      <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                        {/* 아이콘 */}
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
                          <Package size={16} className="text-gray-400" />
                        </div>
                        {/* 텍스트 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {item.name}
                            {item.quantity > 1 && (
                              <span className="ml-1.5 text-xs text-gray-400 font-normal">{item.quantity}개</span>
                            )}
                          </p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{storageName}</p>
                        </div>
                        {/* 상태 배지 */}
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── 요약 셀 ──────────────────────────────────── */
function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-brand-200 mb-1">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

/* ─── 스토리지 카드 (다크 · 2열 컴팩트) ────────── */
function StorageCard({
  storage: s,
  itemCount,
  onDetail,
}: {
  storage: Storage;
  itemCount: number;
  onDetail: () => void;
}) {
  const sizeLabel = PLAN_SIZE_LABEL[s.plan_type ?? ""] ?? s.plan_type ?? "-";
  const planCfg   = s.storage_plan_config;
  const freeInfo  = s.storage_mode === "short_term" ? calcFreeInfo(s.short_term_started_at) : null;
  const isShortTerm = s.storage_mode === "short_term";

  const feeLabel = isShortTerm
    ? (freeInfo?.inFreePeriod
        ? `무료 ${freeInfo.freeDaysLeft}일`
        : `${freeInfo!.billableWeeks}주 · ${((planCfg?.weekly_rate ?? 0) * freeInfo!.billableWeeks).toLocaleString()}원`)
    : s.monthly_amount != null
      ? `${s.monthly_amount.toLocaleString()}원/월`
      : "-";

  const usagePct = Math.round(s.usage_percent ?? 0);
  const barColor = usagePct >= 90 ? "#ef4444" : usagePct >= 70 ? "#f97316" : "#a78bfa";

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
      }}
    >
      {/* 상단 텍스처 + 이름 */}
      <button
        onClick={onDetail}
        className="w-full text-left px-3.5 pt-3.5 pb-2"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 8px)",
        }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="w-6 h-6 bg-white/10 rounded-md flex items-center justify-center">
            <Package size={13} className="text-white/80" />
          </div>
          <span className="text-[10px] text-white/50 font-medium">{sizeLabel}</span>
        </div>
        <p className="text-xs font-bold text-white truncate mt-2 leading-tight">{s.storage_name}</p>
        <p className="text-[10px] text-white/50 mt-0.5">
          {isShortTerm ? "단기보관" : "장기보관"}
        </p>
      </button>

      {/* 사용량 바 */}
      <div className="px-3.5 pb-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-white/50">공간 사용량</span>
          <span className="text-white/80 font-semibold">{usagePct}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${usagePct}%`, backgroundColor: barColor }}
          />
        </div>
      </div>

      {/* 요금 + 보관 수량 */}
      <div className="px-3.5 pb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-white/90">{feeLabel}</span>
        <span className="text-[10px] text-white/50">
          {itemCount}개 보관
        </span>
      </div>

      {/* 무료기간 뱃지 (단기보관) */}
      {freeInfo?.inFreePeriod && (
        <div className="mx-3.5 mb-2.5 px-2 py-1 rounded-lg bg-green-500/20 border border-green-400/30">
          <p className="text-[10px] text-green-300 font-semibold">
            무료 기간 {freeInfo.freeDaysLeft}일 남음
          </p>
        </div>
      )}

      {/* 버튼 2종 */}
      <div className="px-3 pb-3 grid grid-cols-2 gap-1.5 mt-auto">
        <button
          type="button"
          onClick={() => alert("출고 요청 – 준비 중입니다.")}
          className="py-2 rounded-xl text-[11px] font-bold text-white bg-violet-500/80 hover:bg-violet-500 transition-colors"
        >
          출고 요청
        </button>
        <button
          type="button"
          onClick={() => alert("요금제 변경 – 준비 중입니다.")}
          className="py-2 rounded-xl text-[11px] font-bold text-white/70 bg-white/10 hover:bg-white/20 transition-colors"
        >
          요금제 변경
        </button>
      </div>
    </div>
  );
}

/* ─── 빈 상태 ──────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
        <Archive size={28} className="text-gray-300" />
      </div>
      <p className="text-sm font-bold text-gray-700 mb-1">보관 중인 스토리지가 없습니다</p>
      <p className="text-xs text-gray-400 text-center mb-6">
        계절 옷, 이사 짐, 유학 준비물 등<br />
        무엇이든 안전하게 보관해 드립니다
      </p>
      <Link
        href="/storage/new"
        className="flex items-center gap-2 bg-brand-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl"
      >
        <Plus size={16} />
        스토리지 신청하기
      </Link>
    </div>
  );
}
