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
  is_shippable: boolean;
  inbound_at: string | null;
}

interface LocationSummary {
  slot_count: number;
  total_weekly_fee: number;
  dominant_type: { code: string; name: string; count: number; price_per_week: number } | null;
}

/* ─── 상수 ──────────────────────────────────────── */

const PARCEL_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  CREATED:          { label: "수거 대기",  color: "bg-gray-100 text-gray-500" },
  PICKUP_REQUESTED: { label: "수거 신청",  color: "bg-gray-100 text-gray-500" },
  IN_TRANSIT:       { label: "이동 중",   color: "bg-purple-100 text-purple-700" },
  INBOUND:          { label: "검수 대기",  color: "bg-yellow-100 text-yellow-700" },
  INSPECTING:       { label: "검수 대기",  color: "bg-yellow-100 text-yellow-700" },
  INSPECTION:       { label: "검수 대기",  color: "bg-yellow-100 text-yellow-700" },
  HOLD:             { label: "보류",      color: "bg-orange-100 text-orange-700" },
  SHIPPABLE:        { label: "출고 가능",  color: "bg-green-100 text-green-700" },
  READY:            { label: "출고 가능",  color: "bg-green-100 text-green-700" },
  SHIPPED:          { label: "출고 완료",  color: "bg-gray-100 text-gray-500" },
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
  const [locationSummary, setLocationSummary] = useState<LocationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>("전체");
  const [releaseSheet, setReleaseSheet] = useState<string[] | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [storageRes, itemsRes, locRes] = await Promise.all([
        fetch("/api/storage"),
        fetch("/api/storage/all-items"),
        fetch("/api/storage/my-locations"),
      ]);
      if (storageRes.status === 401) { router.push("/login"); return; }
      const storageJson = await storageRes.json();
      const itemsJson = itemsRes.ok ? await itemsRes.json() : { items: [] };
      const locJson = locRes.ok ? await locRes.json() : { summary: null };
      setStorages(storageJson.storages ?? []);
      setItems(itemsJson.items ?? []);
      setLocationSummary(locJson.summary ?? null);
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

  const filterTabs = ["전체", "출고 가능", ...active.map((s) => s.storage_name)];
  const filteredItems =
    itemFilter === "전체"
      ? items
      : itemFilter === "출고 가능"
        ? items.filter((it) => it.parcel_status === "SHIPPABLE" || it.parcel_status === "READY" || it.is_shippable)
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
    <>
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
                <SummaryCell
                  label="슬롯"
                  value={locationSummary ? `${locationSummary.slot_count}개` : `${active.length}개`}
                />
                <SummaryCell
                  label="주간 요금"
                  value={locationSummary?.total_weekly_fee
                    ? `${locationSummary.total_weekly_fee.toLocaleString()}원`
                    : totalMonthly > 0 ? `${totalMonthly.toLocaleString()}원` : "-"}
                />
                <SummaryCell
                  label="요금제"
                  value={locationSummary?.dominant_type?.name ?? "-"}
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
                  locationSummary={locationSummary}
                  storageItems={items}
                  onDetail={() => router.push(`/storage/${s.id}`)}
                  onRelease={(parcelIds) => setReleaseSheet(parcelIds)}
                />
              ))}
            </div>

            {/* ── 물품 목록 ────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* 헤더 */}
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">물품 목록</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    전체 {items.length}개
                    {items.filter((it) => it.parcel_status === "SHIPPABLE" || it.parcel_status === "READY" || it.is_shippable).length > 0 && (
                      <span className="ml-2 text-green-600 font-semibold">
                        출고 가능 {items.filter((it) => it.parcel_status === "SHIPPABLE" || it.parcel_status === "READY" || it.is_shippable).length}개
                      </span>
                    )}
                  </p>
                </div>
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

    {/* 출고 유형 선택 시트 */}
    {releaseSheet && (
      <ReleaseTypeSheet
        parcelIds={releaseSheet}
        onClose={() => setReleaseSheet(null)}
        onSelect={(type) => {
          setReleaseSheet(null);
          const ids = releaseSheet.join(",");
          if (type === "overseas") {
            router.push(`/shipping-request?parcels=${ids}`);
          } else {
            router.push(`/domestic-shipping?parcels=${ids}`);
          }
        }}
      />
    )}
    </>
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

/* ─── 스토리지 카드 (주식 위젯 스타일) ─────────── */
function StorageCard({
  storage: s,
  itemCount,
  locationSummary,
  storageItems,
  onDetail,
  onRelease,
}: {
  storage: Storage;
  itemCount: number;
  locationSummary: LocationSummary | null;
  storageItems: ProductItem[];
  onDetail: () => void;
  onRelease: (parcelIds: string[]) => void;
}) {
  const freeInfo    = s.storage_mode === "short_term" ? calcFreeInfo(s.short_term_started_at) : null;
  const isShortTerm = s.storage_mode === "short_term";
  const weeklyFee   = locationSummary?.total_weekly_fee ?? s.storage_plan_config?.weekly_rate ?? 0;
  const planName    = locationSummary?.dominant_type?.name ?? s.plan_type ?? "-";
  const usagePct    = Math.round(s.usage_percent ?? 0);

  // 중앙 큰 숫자: 요금
  const mainFee = isShortTerm
    ? (freeInfo?.inFreePeriod ? 0 : weeklyFee)
    : s.monthly_amount ?? weeklyFee;
  const mainFeeLabel = isShortTerm
    ? (freeInfo?.inFreePeriod ? "FREE" : `${mainFee.toLocaleString()}`)
    : mainFee > 0 ? mainFee.toLocaleString() : "-";
  const mainUnit = isShortTerm
    ? (freeInfo?.inFreePeriod ? "" : "/주")
    : "/월";

  // 뱃지: 무료기간이면 GREEN, 사용률 기반
  const badgeColor   = freeInfo?.inFreePeriod ? "#22c55e" : usagePct >= 80 ? "#ef4444" : "#a78bfa";
  const badgeText    = freeInfo?.inFreePeriod
    ? `+${freeInfo.freeDaysLeft}일 무료`
    : `${usagePct}%`;

  // 미니 그래프 (사용률 세그먼트)
  const segments = 12;
  const filled   = Math.round((usagePct / 100) * segments);

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col relative"
      style={{
        background: "linear-gradient(160deg, #1c1c2e 0%, #12122a 100%)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minHeight: 190,
      }}
    >
      {/* ── 상단: 아이콘 + 이름 + 점3개 ── */}
      <button onClick={onDetail} className="w-full text-left px-3.5 pt-3.5 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
        >
          <Package size={13} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold text-white truncate leading-tight">{s.storage_name}</p>
          <p className="text-[9px] text-white/40 mt-0.5">{isShortTerm ? "단기" : "장기"} · {planName}</p>
        </div>
        <span className="text-white/30 text-base leading-none tracking-widest shrink-0">···</span>
      </button>

      {/* ── 중앙: 큰 요금 숫자 + 뱃지 ── */}
      <div className="px-3.5 mt-2.5 flex items-end gap-2">
        <p className="text-[22px] font-black text-white leading-none tracking-tight">
          {mainFeeLabel === "FREE" ? "FREE" : `₩${mainFeeLabel}`}
        </p>
        <div className="mb-0.5 flex items-center gap-1">
          {mainFeeLabel !== "FREE" && mainUnit && (
            <span className="text-[10px] text-white/40 mb-0.5">{mainUnit}</span>
          )}
          <span
            className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: `${badgeColor}22`, color: badgeColor }}
          >
            {badgeText}
          </span>
        </div>
      </div>

      {/* ── 미니 바 그래프 (사용률) ── */}
      <div className="px-3.5 mt-3 flex items-end gap-[2px]" style={{ height: 28 }}>
        {Array.from({ length: segments }).map((_, i) => {
          const isFilled = i < filled;
          const heightPct = 40 + Math.sin((i / segments) * Math.PI) * 60;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${heightPct}%`,
                backgroundColor: isFilled
                  ? usagePct >= 80 ? "#ef4444" : "#7c3aed"
                  : "rgba(255,255,255,0.08)",
              }}
            />
          );
        })}
      </div>

      {/* ── 하단 스탯 행 ── */}
      <div className="px-3.5 pt-2 pb-2.5 flex items-center justify-between border-t border-white/5 mt-2">
        <StatChip label="보관" value={`${itemCount}개`} />
        <StatChip label="용량" value={`${usagePct}%`} />
        <StatChip label={isShortTerm ? "주요금" : "월요금"} value={weeklyFee > 0 ? `${(weeklyFee/1000).toFixed(1)}k` : "-"} />
      </div>

      {/* ── 버튼 2종 ── */}
      <div className="px-3 pb-3 grid grid-cols-2 gap-1.5">
        <button
          type="button"
          onClick={() => {
            const parcelIds = [...new Set(
              storageItems
                .filter((it) => it.storage_id === s.id && it.parcel_id)
                .map((it) => it.parcel_id)
            )];
            if (parcelIds.length === 0) {
              alert("출고 가능한 물품이 없습니다.");
              return;
            }
            onRelease(parcelIds as string[]);
          }}
          className="py-1.5 rounded-xl text-[11px] font-bold text-white transition-colors"
          style={{ background: "linear-gradient(90deg,#7c3aed,#6d28d9)" }}
        >
          출고 요청
        </button>
        <button
          type="button"
          onClick={() => alert("요금제 변경 – 준비 중입니다.")}
          className="py-1.5 rounded-xl text-[11px] font-bold text-white/60 bg-white/8 hover:bg-white/15 transition-colors border border-white/10"
        >
          요금제 변경
        </button>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[9px] text-white/30 mb-0.5">{label}</p>
      <p className="text-[11px] font-semibold text-white/70">{value}</p>
    </div>
  );
}

/* ─── 출고 유형 선택 시트 ─────────────────────── */
function ReleaseTypeSheet({
  parcelIds,
  onClose,
  onSelect,
}: {
  parcelIds: string[];
  onClose: () => void;
  onSelect: (type: "overseas" | "domestic") => void;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl pb-safe">
        <div className="px-4 pt-5 pb-2 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">출고 요청</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {parcelIds.length}개 운송장 · 배송 유형을 선택하세요
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-400"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-4 grid grid-cols-2 gap-3">
          {/* 해외 배송 */}
          <button
            onClick={() => onSelect("overseas")}
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-brand-200 bg-brand-50 hover:border-brand-400 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-brand-600 flex items-center justify-center">
              <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">해외 배송</p>
              <p className="text-[11px] text-gray-500 mt-0.5">EMS · EMS프리미엄 · K-패킷</p>
            </div>
          </button>

          {/* 국내 배송 */}
          <button
            onClick={() => onSelect("domestic")}
            className="flex flex-col items-center gap-3 p-5 rounded-2xl border-2 border-gray-200 bg-gray-50 hover:border-gray-400 transition-colors"
          >
            <div className="w-12 h-12 rounded-2xl bg-gray-700 flex items-center justify-center">
              <svg width="22" height="22" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <rect x="1" y="3" width="15" height="13" rx="2" />
                <path d="M16 8h4l3 5v3h-7V8zM5.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM18.5 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">국내 배송</p>
              <p className="text-[11px] text-gray-500 mt-0.5">CJ대한통운 · 우편 택배</p>
            </div>
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-400 pb-6">
          선택한 스토리지의 전체 물품이 한 번에 출고 신청됩니다
        </p>
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
