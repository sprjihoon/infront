"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Plus, RefreshCw, Archive, Truck, Send,
  CreditCard, ChevronRight, Clock, AlertTriangle,
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

interface MockItem {
  id: string;
  storage_id: string;
  name: string;
  status: "보관 중" | "출고 요청" | "출고 완료";
  image_url: string | null;
}

/* ─── 상수 ──────────────────────────────────────── */
const PLAN_SIZE_LABEL: Record<string, string> = {
  S: "소형", M: "중형", L: "대형", XL: "특대형",
};

const ITEM_STATUS_COLOR: Record<string, string> = {
  "보관 중":  "bg-green-100 text-green-700",
  "출고 요청": "bg-blue-100 text-blue-700",
  "출고 완료": "bg-gray-100 text-gray-500",
};

const MOCK_ITEMS: MockItem[] = [
  { id: "m1", storage_id: "__first__", name: "MOCK-KR-1780542676907-1", status: "보관 중",  image_url: null },
  { id: "m2", storage_id: "__first__", name: "MOCK-JP-1780542676907-1", status: "보관 중",  image_url: null },
  { id: "m3", storage_id: "__first__", name: "MOCK-JP-1780542676907-2", status: "보관 중",  image_url: null },
  { id: "m4", storage_id: "__first__", name: "MOCK-KR-1780542487354-1", status: "보관 중",  image_url: null },
  { id: "m5", storage_id: "__first__", name: "MOCK-JP-1780542487354-1", status: "출고 요청", image_url: null },
  { id: "m6", storage_id: "__first__", name: "MOCK-JP-1780542487354-2", status: "출고 완료", image_url: null },
];

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>("전체");

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

  /* 요약 */
  const totalMonthly = active.reduce((sum, s) => sum + (s.monthly_amount ?? 0), 0);
  const nextBilling = active
    .map((s) => s.next_billing_date ?? s.paid_until_date)
    .filter(Boolean)
    .sort()[0] ?? null;

  /* mock 물품: __first__ → 첫 번째 스토리지 id 치환 */
  const firstId = active[0]?.id ?? "";
  const mockItems = MOCK_ITEMS.map((it) => ({
    ...it,
    storage_id: it.storage_id === "__first__" ? firstId : it.storage_id,
  }));

  const filterTabs = ["전체", ...active.map((s) => s.storage_name)];
  const filteredItems =
    itemFilter === "전체"
      ? mockItems
      : mockItems.filter((it) => {
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

            {/* ── 스토리지 카드 목록 ───────────────── */}
            {active.map((s) => (
              <StorageCard
                key={s.id}
                storage={s}
                itemCount={mockItems.filter((it) => it.storage_id === s.id).length}
                onDetail={() => router.push(`/storage/${s.id}`)}
              />
            ))}

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
                    return (
                      <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                        {/* 썸네일 */}
                        <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={16} className="text-gray-400" />
                          )}
                        </div>
                        {/* 텍스트 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">{storageName}</p>
                        </div>
                        {/* 상태 배지 */}
                        <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${ITEM_STATUS_COLOR[item.status]}`}>
                          {item.status}
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

/* ─── 스토리지 카드 ────────────────────────────── */
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

  const billingDate = s.next_billing_date ?? s.paid_until_date;

  /* 요금 표시 */
  const feeLabel = isShortTerm
    ? freeInfo?.inFreePeriod
      ? `무료 ${freeInfo.freeDaysLeft}일 남음`
      : `${freeInfo!.billableWeeks}주차 · ${((planCfg?.weekly_rate ?? 0) * freeInfo!.billableWeeks).toLocaleString()}원`
    : s.monthly_amount != null
      ? `${s.monthly_amount.toLocaleString()}원/월`
      : "-";

  const isSuspended = s.status === "SUSPENDED";

  return (
    <div className={`bg-white rounded-2xl border overflow-hidden ${isSuspended ? "border-orange-200" : "border-gray-100"}`}>
      {/* 카드 상단 */}
      <button
        onClick={onDetail}
        className="w-full px-4 pt-4 pb-3 text-left flex items-start justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isSuspended ? "bg-orange-50" : "bg-brand-50"
          }`}>
            <Package size={18} className={isSuspended ? "text-orange-400" : "text-brand-600"} />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">{s.storage_name}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {isShortTerm ? "단기보관" : "장기보관"} · {sizeLabel}
            </p>
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300 mt-1 shrink-0" />
      </button>

      {/* 정지 알림 */}
      {isSuspended && (
        <div className="mx-4 mb-3 flex items-center gap-1.5 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-xs text-orange-700 font-medium">
          <AlertTriangle size={12} />
          결제 실패로 서비스가 제한되었습니다.
        </div>
      )}

      {/* 용량 */}
      <div className="px-4 pb-3">
        <div className="flex justify-between text-[11px] text-gray-500 mb-1.5">
          <span>공간 사용량</span>
          <span className="font-semibold">
            {s.used_score}개 / {s.capacity_score ?? "?"}개
            <span className="text-gray-400 ml-1">({Math.round(s.usage_percent ?? 0)}%)</span>
          </span>
        </div>
        <ProgressBar percent={s.usage_percent ?? 0} />
      </div>

      {/* 요금·결제일 */}
      <div className="px-4 pb-3 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1 text-gray-500">
          <CreditCard size={11} />
          <span>{feeLabel}</span>
        </div>
        {billingDate && (
          <div className="flex items-center gap-1 text-gray-400">
            <Clock size={11} />
            <span>
              다음 결제 {new Date(billingDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
            </span>
          </div>
        )}
      </div>

      {/* 보관 물품 수 */}
      <div className="px-4 pb-3">
        <span className="text-[11px] text-gray-400">
          보관 중 <span className="font-bold text-gray-700">{itemCount}</span>개
        </span>
      </div>

      {/* 버튼 3종 */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <ActionButton
          icon={<Truck size={13} />}
          label="추가 수거"
          onClick={() => alert("추가 수거 신청 – 준비 중입니다.")}
        />
        <ActionButton
          icon={<Send size={13} />}
          label="출고 요청"
          onClick={() => alert("출고 요청 – 준비 중입니다.")}
          primary
        />
        <ActionButton
          icon={<CreditCard size={13} />}
          label="요금제 변경"
          onClick={() => alert("요금제 변경 – 준비 중입니다.")}
        />
      </div>
    </div>
  );
}

function ActionButton({
  icon, label, onClick, primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl text-[11px] font-semibold transition-colors ${
        primary
          ? "bg-brand-600 text-white"
          : "bg-gray-50 text-gray-600 hover:bg-gray-100"
      }`}
    >
      {icon}
      {label}
    </button>
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
