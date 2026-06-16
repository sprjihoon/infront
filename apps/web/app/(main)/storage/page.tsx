"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Plus, RefreshCw, Archive,
  ChevronRight, X, Check, Loader2, Search,
} from "lucide-react";
import Link from "next/link";
import { CARD_THEME_MAP, CARD_THEME_KEYS } from "./constants";
import { Block1SVG, Block2SVG, Block3SVG, Block4SVG, Block5SVG } from "./BlockSVGs";

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
  card_color: string | null;
  storage_type_id: string | null;
  storage_plan_config: PlanConfig | null;
  storage_types: { code: string; name: string; volume_liter: number | null } | null;
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
  photo_url: string | null;
}

interface LocationSummary {
  slot_count: number;
  total_weekly_fee: number;
  dominant_type: { code: string; name: string; count: number; price_per_week: number } | null;
}

/* ─── 상수 ──────────────────────────────────────── */


const PARCEL_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  // 입고중 그룹
  CREATED:          { label: "입고중", color: "bg-indigo-50 text-indigo-700" },
  PICKUP_REQUESTED: { label: "입고중", color: "bg-indigo-50 text-indigo-700" },
  IN_TRANSIT:       { label: "입고중", color: "bg-indigo-50 text-indigo-700" },
  INBOUND:          { label: "입고중", color: "bg-indigo-50 text-indigo-700" },
  INSPECTING:       { label: "입고중", color: "bg-indigo-50 text-indigo-700" },
  INSPECTION:       { label: "입고중", color: "bg-indigo-50 text-indigo-700" },
  // 출고가능
  SHIPPABLE:        { label: "출고 가능", color: "bg-green-100 text-green-700" },
  READY:            { label: "출고 가능", color: "bg-green-100 text-green-700" },
  // 보류
  HOLD:             { label: "보류", color: "bg-orange-100 text-orange-700" },
  PICKUP_CANCELLED: { label: "보류", color: "bg-orange-100 text-orange-700" },
  // 완료 (표시되지 않음)
  SHIPPED:          { label: "출고 완료", color: "bg-gray-100 text-gray-500" },
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

function shadeColor(hex: string, factor: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const clamp = (n: number) => Math.min(255, Math.max(0, Math.round(n)));
  if (factor >= 1) {
    const t = factor - 1;
    return `#${clamp(r+(255-r)*t).toString(16).padStart(2,"0")}${clamp(g+(255-g)*t).toString(16).padStart(2,"0")}${clamp(b+(255-b)*t).toString(16).padStart(2,"0")}`;
  }
  return `#${clamp(r*factor).toString(16).padStart(2,"0")}${clamp(g*factor).toString(16).padStart(2,"0")}${clamp(b*factor).toString(16).padStart(2,"0")}`;
}

const BLOCK_SVG_MAP: Record<string, React.ComponentType<{ dark: string; medium: string; light: string; size?: number }>> = {
  MINI:     Block1SVG,
  STANDARD: Block2SVG,
  LONG:     Block3SVG,
  XL:       Block4SVG,
  OVERSIZE: Block5SVG,
  DEFAULT:  Block2SVG,
};

/* 타입별 기본 크기 — 큰 블록일수록 실제로 더 크게 표시 */
const BLOCK_BASE_SIZE: Record<string, number> = {
  MINI: 80, STANDARD: 96, LONG: 110, XL: 124, OVERSIZE: 140, DEFAULT: 96,
};

function BrickSVG({ color, typeCode, size }: { color: string; typeCode: string; size?: number }) {
  const medium   = color;
  const light    = shadeColor(color, 1.6);
  const dark     = shadeColor(color, 0.45);
  const Comp     = BLOCK_SVG_MAP[typeCode] ?? Block2SVG;
  const autoSize = size ?? BLOCK_BASE_SIZE[typeCode] ?? 76;
  return <Comp dark={dark} medium={medium} light={light} size={autoSize} />;
}

function SummaryTile({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "green" | "blue" | "orange" | "purple";
}) {
  const bg = { green: "bg-green-50", blue: "bg-blue-50", orange: "bg-orange-50", purple: "bg-purple-50" }[color];
  return (
    <div className="flex flex-col items-center text-center gap-1.5">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>{icon}</div>
      <p className="text-sm font-black text-gray-900 leading-none">{value}</p>
      <p className="text-[9px] text-gray-400 leading-tight">{label}</p>
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
  const [storageTypes, setStorageTypes] = useState<StorageType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [itemFilter, setItemFilter] = useState<string>("전체");
  const [pageSize, setPageSize] = useState<number>(6);
  const [page, setPage] = useState<number>(1);

  const [releaseSheet, setReleaseSheet] = useState<string[] | null>(null);
  const [capacitySheet, setCapacitySheet] = useState<Storage | null>(null);
  const [renameSheet, setRenameSheet] = useState<Storage | null>(null);
  const [mergeSheet, setMergeSheet] = useState(false);
  const [hoverPhoto, setHoverPhoto] = useState<{ url: string; x: number; y: number } | null>(null);
  const [activeIdx, setActiveIdx] = useState(1);
  const [dragOffset, setDragOffset] = useState(0);
  const isDraggingRef = useRef(false);
  const dragStartX = useRef(0);
  const lastWheelTime = useRef(0);
  const pointerDownIdx = useRef(-1);
  const carouselRef = useRef<HTMLDivElement>(null);

  // non-passive wheel: 캐러셀 영역 휠 시 페이지 스크롤 차단
  // loading이 끝난 뒤 carouselRef가 실제 DOM에 붙으므로 loading을 deps에 포함
  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(delta) <= 20) return;
      e.preventDefault();
      const now = Date.now();
      if (now - lastWheelTime.current < 350) return;
      lastWheelTime.current = now;
      if (delta > 0) setActiveIdx(prev => Math.min(prev + 1, 999));
      else setActiveIdx(prev => Math.max(prev - 1, 0));
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [loading]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [storageRes, itemsRes, locRes, typesRes] = await Promise.all([
        fetch("/api/storage"),
        fetch("/api/storage/all-items"),
        fetch("/api/storage/my-locations"),
        fetch("/api/storage/types"),
      ]);
      if (storageRes.status === 401) { router.push("/login"); return; }
      const storageJson = await storageRes.json();
      const itemsJson = itemsRes.ok ? await itemsRes.json() : { items: [] };
      const locJson = locRes.ok ? await locRes.json() : { summary: null };
      const typesJson = typesRes.ok ? await typesRes.json() : { types: [] };
      setStorages(storageJson.storages ?? []);
      setItems(itemsJson.items ?? []);
      setLocationSummary(locJson.summary ?? null);
      setStorageTypes(typesJson.types ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  // 탭이 다시 활성화될 때 조용히 새로고침
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  const active = storages.filter((s) => s.status !== "CANCELLED");

  /* 요약 */
  const totalMonthlyFee = active
    .filter((s) => s.storage_mode === "long_term")
    .reduce((sum, s) => sum + (s.monthly_amount ?? 0), 0);
  const nextBilling = active
    .map((s) => s.next_billing_date ?? s.paid_until_date)
    .filter(Boolean)
    .sort()[0] ?? null;

  const shippableCount = items.filter(
    (it) => it.parcel_status === "SHIPPABLE" || it.parcel_status === "READY" || it.is_shippable === true
  ).length;
  const avgUsage = active.length > 0
    ? Math.round(active.reduce((sum, s) => sum + (s.usage_percent ?? 0), 0) / active.length)
    : 0;

  const filterTabs = ["전체", "출고 가능", ...active.map((s) => s.storage_name)];
  const filteredItems =
    itemFilter === "전체"
      ? items
      : itemFilter === "출고 가능"
        ? items.filter((it) => it.parcel_status === "SHIPPABLE" || it.parcel_status === "READY" || it.is_shippable === true)
        : items.filter((it) => {
            const s = active.find((st) => st.id === it.storage_id);
            return s?.storage_name === itemFilter;
          });

  const pagedItems = pageSize === 0 ? filteredItems : filteredItems.slice(0, pageSize);

  /* ── 블록 통합 추천 카드 조건 계산 ───────────────────── */
  const mergeRecommendation = (() => {
    if (active.length < 2 || storageTypes.length === 0) return null;

    const totalUsedLiters = active.reduce((sum, s) => sum + (s.used_score ?? 0), 0);
    const currentTotalMonthly = active.reduce((sum, s) => sum + (s.monthly_amount ?? 0), 0);
    if (currentTotalMonthly === 0) return null;

    // 조건 2a: 각 블록의 사용률이 낮은지 (모두 50% 미만)
    const allLowUsage = active.every((s) => (s.usage_percent ?? 0) < 50);

    // 조건 2b: 합산 사용량을 담을 수 있는 가장 저렴한 단일 블록 타입 탐색
    const fittingType = storageTypes
      .filter((t) => (t.volume_liter ?? 0) >= totalUsedLiters && (t.price_per_month ?? 0) > 0)
      .sort((a, b) => (a.price_per_month ?? 0) - (b.price_per_month ?? 0))[0] ?? null;

    // 조건 2: allLowUsage OR fitsInOneBlock — 단, 가격 비교를 위해 fittingType 필수
    if (!fittingType || (!allLowUsage && !fittingType)) return null;

    const mergedMonthly = fittingType.price_per_month ?? 0;
    const saving = currentTotalMonthly - mergedMonthly;
    if (saving <= 0) return null;

    return { saving, mergedMonthly, typeName: fittingType.name, currentTotalMonthly };
  })();

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
            href="/inbound"
            className="flex items-center gap-1 bg-brand-600 text-white text-xs font-semibold px-3 py-2 rounded-xl"
          >
            <Plus size={14} />
            입고신청
          </Link>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {active.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── 이번 달 요약 ─────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 mb-3">이번 달 요약</p>
              <div className="grid grid-cols-4 gap-1.5">
                <SummaryTile
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" fill="#10B981" />
                      <rect x="14" y="3" width="7" height="7" rx="1.5" fill="#10B981" opacity="0.45" />
                      <rect x="3" y="14" width="7" height="7" rx="1.5" fill="#10B981" opacity="0.45" />
                    </svg>
                  }
                  label="사용 중인 블록"
                  value={`${active.length}개`}
                  color="green"
                />
                <SummaryTile
                  icon={<Package size={18} className="text-blue-500" />}
                  label="보관 물품"
                  value={`${items.length}개`}
                  color="blue"
                />
                <SummaryTile
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F97316" strokeWidth="2">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  }
                  label="출고 가능"
                  value={shippableCount > 0 ? `${shippableCount}개` : "-"}
                  color="orange"
                />
                <SummaryTile
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
                      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
                    </svg>
                  }
                  label="월 보관료"
                  value={totalMonthlyFee > 0 ? `${totalMonthlyFee.toLocaleString()}원` : "-"}
                  color="purple"
                />
              </div>
              {active.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2">
                  <span className="text-[10px] text-gray-400">평균 공간 사용률</span>
                  <div className="flex gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-3 h-3 rounded-full transition-colors"
                        style={{
                          background: i < Math.round(avgUsage / 20)
                            ? avgUsage >= 90 ? "#EF4444" : avgUsage >= 70 ? "#F97316" : "#10B981"
                            : "#E5E7EB",
                        }}
                      />
                    ))}
                  </div>
                  <span className={`text-[11px] font-bold ml-0.5 ${avgUsage >= 90 ? "text-red-500" : avgUsage >= 70 ? "text-orange-500" : "text-gray-600"}`}>
                    {avgUsage}%
                  </span>
                </div>
              )}
            </div>

            {/* ── 3D 드래그 캐러셀 ─────────── */}
            {(() => {
              const allCards: (Storage | null)[] = [null, ...active, null];
              const safeIdx = Math.min(Math.max(activeIdx, 0), allCards.length - 1);
              const goNext = () => setActiveIdx(prev => Math.min(prev + 1, allCards.length - 1));
              const goPrev = () => setActiveIdx(prev => Math.max(prev - 1, 0));
              const activeStorage = allCards[safeIdx] as Storage | null;

              return (
                <div className="space-y-3">
                  {/* ── 캐러셀 윈도우 ── */}
                  <div
                    ref={carouselRef}
                    className="relative overflow-hidden select-none"
                    style={{ height: "288px", touchAction: "none" }}
                    onPointerDown={e => {
                      // 버튼 / 링크 클릭은 캡처 제외 — 드래그 없이 바로 이동 허용
                      if ((e.target as HTMLElement).closest("button,a")) return;
                      isDraggingRef.current = true;
                      dragStartX.current = e.clientX;
                      const cardEl = (e.target as HTMLElement).closest("[data-card-idx]");
                      pointerDownIdx.current = cardEl ? Number((cardEl as HTMLElement).dataset.cardIdx) : -1;
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    }}
                    onPointerMove={e => {
                      if (!isDraggingRef.current) return;
                      setDragOffset(e.clientX - dragStartX.current);
                    }}
                    onPointerUp={e => {
                      if (!isDraggingRef.current) return;
                      isDraggingRef.current = false;
                      const delta = e.clientX - dragStartX.current;
                      if (Math.abs(delta) < 8) {
                        // 클릭: 비활성 카드면 활성 위치로 이동
                        if (pointerDownIdx.current >= 0 && pointerDownIdx.current !== safeIdx) {
                          setActiveIdx(pointerDownIdx.current);
                        }
                        // delta가 작으면 Link 클릭 허용 (preventDefault 없음)
                      } else {
                        // 드래그: Link 이동 방지는 setPointerCapture가 처리
                        if (delta < -40) goNext();
                        else if (delta > 40) goPrev();
                      }
                      setDragOffset(0);
                    }}
                    onPointerCancel={() => { isDraggingRef.current = false; setDragOffset(0); }}
                  >
                    {allCards.map((card, i) => {
                      const offset = i - safeIdx;
                      if (Math.abs(offset) > 2) return null;
                      const abs = Math.abs(offset);
                      const themeKey = (card && card.card_color && CARD_THEME_MAP[card.card_color])
                        ? card.card_color
                        : CARD_THEME_KEYS[i % CARD_THEME_KEYS.length];
                      const theme = CARD_THEME_MAP[themeKey];
                      return (
                        <div
                          key={i}
                          data-card-idx={i}
                          className="absolute"
                          style={{
                            top: 0,
                            bottom: 0,
                            left: "24%",
                            right: "24%",
                            transform: `translateX(calc(${offset * 75}% + ${dragOffset}px)) scale(${1 - abs * 0.06})`,
                            zIndex: 10 - abs,
                            opacity: abs === 0 ? 1 : abs === 1 ? 0.82 : 0,
                            transition: dragOffset !== 0 ? "none" : "transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.4s",
                            cursor: abs > 0 ? "pointer" : "default",
                          }}
                          onClick={abs > 0 ? () => {
                            if (isDraggingRef.current) return;
                            if (!card) { router.push("/storage/new"); return; }
                            setActiveIdx(i);
                          } : undefined}
                        >
                          {card ? (
                            <StorageCard
                              storage={card}
                              itemCount={items.filter(it => it.storage_id === card.id).length}
                              locationSummary={locationSummary}
                              storageItems={items}
                              theme={theme}
                              onDetail={() => router.push(`/storage/${card.id}`)}
                              onRelease={parcelIds => setReleaseSheet(parcelIds)}
                              onCapacity={() => setCapacitySheet(card)}
                              onRename={() => setRenameSheet(card)}
                            />
                          ) : (
                            <Link
                              href="/storage/new"
                              className="flex flex-col items-center justify-center gap-3 h-full rounded-2xl border-2 border-dashed border-gray-200 hover:border-brand-300 bg-white/70 transition-colors"
                            >
                              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                <Plus size={18} className="text-gray-400" />
                              </div>
                              <p className="text-[12px] font-semibold text-gray-400">블록 추가</p>
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* ── 도트 인디케이터 ── */}
                </div>
              );
            })()}

            {/* ── 블록 통합 추천 카드 ─────────────────── */}
            {mergeRecommendation && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
                    <Archive size={16} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-amber-900">보관료를 줄일 수 있어요</p>
                    <p className="text-xs text-amber-700 mt-0.5 leading-snug">
                      현재 {active.length}개 블록을 {mergeRecommendation.typeName} 1개로 합치면{" "}
                      <span className="font-bold">월 {mergeRecommendation.saving.toLocaleString()}원</span> 절약돼요.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMergeSheet(true)}
                    className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
                  >
                    블록 합치기
                  </button>
                </div>
              </div>
            )}

            {/* ── 보관 물품 ────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* 헤더 */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">보관 물품</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    전체 {items.length}개
                    {shippableCount > 0 && (
                      <span className="ml-2 text-green-600 font-semibold">출고 가능 {shippableCount}개</span>
                    )}
                  </p>
                </div>
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <Search size={15} className="text-gray-400" />
                </button>
              </div>

              {/* 필터 탭 */}
              <div className="flex overflow-x-auto border-b border-gray-50 px-2 gap-0.5">
                {filterTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setItemFilter(tab); setPageSize(6); }}
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

              {/* 그리드 */}
              {filteredItems.length === 0 ? (
                <div className="py-10 flex flex-col items-center gap-2">
                  <Package size={24} className="text-gray-200" />
                  <p className="text-xs text-gray-400">물품이 없습니다</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 p-3">
                    {pagedItems.map((item) => {
                      const storage = active.find((s) => s.id === item.storage_id);
                      const storageName = storage?.storage_name ?? "-";
                      const themeKey = (storage?.card_color && CARD_THEME_MAP[storage.card_color])
                        ? storage.card_color
                        : CARD_THEME_KEYS[parseInt((storage?.id ?? "0").replace(/-/g, "").slice(0, 8), 16) % CARD_THEME_KEYS.length];
                      const blockAccent = CARD_THEME_MAP[themeKey]?.accent ?? "#6366f1";
                      const typeCode = storage?.storage_types?.code ?? storage?.plan_type ?? "DEFAULT";
                      const TYPE_KO: Record<string, string> = { MINI: "파인트블록", STANDARD: "싱글블록", LONG: "더블블록", XL: "패밀리블록", OVERSIZE: "하프블록", S: "파인트블록", M: "싱글블록", L: "더블블록" };
                      const blockLabel = TYPE_KO[typeCode] ?? storageName;
                      const isShippable = item.is_shippable;
                      const statusLabel = isShippable ? "출고 가능" : (PARCEL_STATUS_DISPLAY[item.parcel_status]?.label ?? "보관 중");
                      return (
                        <div key={item.id} className="flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100" style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.07)" }}>
                          {/* 이미지 */}
                          <div className="relative aspect-square bg-gray-50 overflow-hidden">
                            {item.photo_url ? (
                              <img
                                src={item.photo_url}
                                alt={item.name}
                                className="w-full h-full object-cover cursor-pointer"
                                onMouseEnter={(e) => {
                                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                                  setHoverPhoto({ url: item.photo_url!, x: rect.left, y: rect.top });
                                }}
                                onMouseLeave={() => setHoverPhoto(null)}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package size={20} className="text-gray-300" />
                              </div>
                            )}
                            {/* 수량 뱃지 */}
                            {item.quantity > 1 && (
                              <span className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/60 text-white">
                                {item.quantity}개
                              </span>
                            )}
                            {/* 상태 뱃지 */}
                            <span className={`absolute bottom-1.5 right-1.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full ${isShippable ? "bg-green-500 text-white" : "bg-black/50 text-white"}`}>
                              {statusLabel}
                            </span>
                          </div>

                          {/* 정보 영역 */}
                          <div className="px-2 pt-1.5 pb-2 flex flex-col gap-1 flex-1">
                            {/* 보관함 이름 */}
                            <p className="text-[9px] text-gray-400 truncate leading-none">{storageName}</p>
                            {/* 물품명 */}
                            <p className="text-[11px] font-bold text-gray-800 line-clamp-2 leading-snug">{item.name || "-"}</p>
                            {/* 블록 타입 배지 */}
                            <span
                              className="self-start text-[8px] font-bold px-1.5 py-0.5 rounded-full truncate max-w-full mt-auto"
                              style={{ background: `${blockAccent}18`, color: blockAccent, border: `1px solid ${blockAccent}30` }}
                            >
                              {blockLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 더 많은 물품 보기 */}
                  {pageSize > 0 && filteredItems.length > pageSize && (
                    <button
                      onClick={() => setPageSize((p) => p + 6)}
                      className="w-full py-3.5 text-xs font-semibold text-gray-500 border-t border-gray-50 hover:bg-gray-50 transition-colors"
                    >
                      더 많은 물품 보기
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>

    {/* 사진 hover 확대 오버레이 */}
    {hoverPhoto && (
      <div
        className="fixed z-[9999] pointer-events-none"
        style={{
          left: Math.min(hoverPhoto.x + 48, window.innerWidth - 224),
          top: Math.max(hoverPhoto.y - 200, 12),
        }}
      >
        <img
          src={hoverPhoto.url}
          alt=""
          className="w-52 h-52 rounded-2xl object-cover shadow-2xl border-2 border-white"
        />
      </div>
    )}

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

    {/* 용량 변경 시트 */}
    {capacitySheet && (
      <CapacityChangeSheet
        storage={capacitySheet}
        currentTypeName={locationSummary?.dominant_type?.name ?? null}
        onClose={() => setCapacitySheet(null)}
        onDone={() => { setCapacitySheet(null); load(true); }}
      />
    )}

    {/* 블록 합치기 시트 */}
    {mergeSheet && active.length >= 2 && (
      <MergeSlotSheet
        storages={active}
        onClose={() => setMergeSheet(false)}
        onDone={() => { setMergeSheet(false); load(true); }}
      />
    )}

    {/* 이름 변경 시트 */}
    {renameSheet && (
      <RenameSheet
        storage={renameSheet}
        onClose={() => setRenameSheet(null)}
        onSaved={(newName, colorKey) => {
          setStorages((prev) =>
            prev.map((s) => s.id === renameSheet.id
              ? { ...s, storage_name: newName, ...(colorKey ? { card_color: colorKey } : {}) }
              : s)
          );
          setRenameSheet(null);
        }}
      />
    )}
    </>
  );
}

/* ─── 카드 테마 타입 ────────────────────────── */
type CardTheme = { bg: string; accent: string };

/* ─── 스토리지 카드 (밝은 블록 카드 스타일) ── */
function StorageCard({
  storage: s,
  itemCount,
  locationSummary,
  storageItems,
  theme,
  onDetail,
  onRelease,
  onCapacity: _onCapacity,
  onRename,
}: {
  storage: Storage;
  itemCount: number;
  locationSummary: LocationSummary | null;
  storageItems: ProductItem[];
  theme: CardTheme;
  onDetail: () => void;
  onRelease: (ids: string[]) => void;
  onCapacity: () => void;
  onRename: () => void;
}) {
  const freeInfo    = s.storage_mode === "short_term" ? calcFreeInfo(s.short_term_started_at) : null;
  const isShortTerm = s.storage_mode === "short_term";
  const weeklyFee   = locationSummary?.total_weekly_fee ?? s.storage_plan_config?.weekly_rate ?? 0;
  const usagePct    = Math.round(s.usage_percent ?? 0);
  const typeCode    = s.storage_types?.code ?? "DEFAULT";
  const typeName    = s.storage_types?.name ?? s.plan_type ?? "-";

  const mainFee = isShortTerm
    ? (freeInfo?.inFreePeriod ? 0 : weeklyFee)
    : s.monthly_amount ?? weeklyFee;
  const mainFeeLabel = isShortTerm
    ? (freeInfo?.inFreePeriod ? "FREE" : mainFee.toLocaleString())
    : mainFee > 0 ? mainFee.toLocaleString() : "-";
  const mainUnit = isShortTerm
    ? (freeInfo?.inFreePeriod ? "" : "/주")
    : "/월";
  const freeBadge = freeInfo?.inFreePeriod ? `+${freeInfo.freeDaysLeft}일 무료` : null;

  const accentColor = theme.accent;

  return (
    <div
      className="rounded-2xl overflow-hidden relative select-none h-full bg-white border border-gray-100"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}
    >
      <div className="flex flex-col h-full px-3 pt-3 pb-2">

        {/* 상단: 블록 이미지 — 남은 공간 채움 */}
        <div className="flex items-center justify-center flex-1 min-h-0">
          <div style={{ filter: "drop-shadow(10px 12px 4px rgba(0,0,0,0.42))" }}>
            <BrickSVG color={accentColor} typeCode={typeCode} />
          </div>
        </div>

        {/* 구분선 */}
        <div className="border-t border-gray-100 my-2" />

        {/* 하단 정보 가로 배치 */}
        <div className="flex items-center justify-between gap-1 mb-1.5">
          {/* 이름 + 타입 */}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1">
              <p className="text-[11px] font-bold text-gray-900 truncate">{s.storage_name}</p>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onRename(); }}
                className="shrink-0 opacity-40 hover:opacity-80 transition-opacity"
              >
                <svg width="8" height="8" fill="none" stroke={accentColor} strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </div>
            <p className="text-[9px] text-gray-400 truncate">
              {typeName}{s.storage_types?.volume_liter ? ` · ${s.storage_types.volume_liter}L` : ""}
            </p>
          </div>

          {/* 가격 */}
          <div className="text-center shrink-0">
            <p className="text-[14px] font-black text-gray-900 leading-none">
              {mainFeeLabel === "FREE" ? "FREE" : `₩${mainFeeLabel}`}
            </p>
            {mainUnit && mainFeeLabel !== "FREE" && (
              <p className="text-[8px] text-gray-400">{mainUnit}</p>
            )}
          </div>

          {/* 보관 물품 수 */}
          <div className="text-center shrink-0">
            <p className="text-[11px] font-black text-gray-800 leading-none">{itemCount}</p>
            <p className="text-[8px] text-gray-400 mt-0.5">개</p>
          </div>
        </div>

        {/* 사용률 바 — 독립 시각 요소 */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-400">사용률</span>
            <span
              className="text-[10px] font-bold"
              style={{ color: freeBadge ? accentColor : usagePct >= 90 ? "#EF4444" : usagePct >= 70 ? "#F97316" : accentColor }}
            >
              {freeBadge ?? `${usagePct}%`}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{
                width: `${Math.min(usagePct, 100)}%`,
                background: freeBadge ? accentColor : usagePct >= 90 ? "#EF4444" : usagePct >= 70 ? "#F97316" : accentColor,
              }}
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            className="py-1.5 rounded-xl text-white font-bold text-[11px] transition-colors"
            style={{ background: accentColor }}
            onClick={e => {
              e.stopPropagation();
              const parcelIds = [...new Set(
                storageItems.filter(it => it.storage_id === s.id && it.parcel_id).map(it => it.parcel_id)
              )];
              if (parcelIds.length === 0) { alert("출고 가능한 물품이 없습니다."); return; }
              onRelease(parcelIds as string[]);
            }}
          >
            출고하기
          </button>
          <button
            type="button"
            className="py-1.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 text-[11px] transition-colors"
            onClick={e => { e.stopPropagation(); onDetail(); }}
          >
            상세보기
          </button>
        </div>

      </div>
    </div>
  );
}

/* ─── 용량 변경 시트 ──────────────────────────── */
type StorageType = {
  id: string;
  code: string;
  name: string;
  price_per_week: number;
  price_per_month: number | null;
  max_parcels: number | null;
  volume_liter: number | null;
};

const TYPE_SIZE_KO: Record<string, string> = {
  MINI:     "파인트블록",
  STANDARD: "싱글블록",
  LONG:     "더블블록",
  XL:       "패밀리블록",
  OVERSIZE: "하프블록",
};

function CapacityChangeSheet({
  storage,
  currentTypeName,
  onClose,
  onDone,
}: {
  storage: Storage;
  currentTypeName: string | null;
  onClose: () => void;
  onDone?: () => void;
}) {
  const resolvedTypeName = currentTypeName ?? storage.storage_types?.name ?? storage.plan_type;
  const [types, setTypes] = useState<StorageType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [reqError, setReqError] = useState("");

  const currentVolume = Number(storage.capacity_score ?? 0);
  const usedVolume    = Number(storage.used_score ?? 0);

  useEffect(() => {
    fetch("/api/storage/types")
      .then((r) => r.json())
      .then((j) => setTypes(j.types ?? []))
      .finally(() => setLoading(false));
  }, []);

  // 현재 용량과 다른 타입 전체
  const otherTypes     = types.filter(t => Number(t.volume_liter ?? 0) !== currentVolume);
  const upgradeTypes   = otherTypes.filter(t => (t.volume_liter ?? 0) > currentVolume);
  const downgradeTypes = otherTypes.filter(t => (t.volume_liter ?? 0) < currentVolume);
  const isAlreadyMax   = !loading && types.length > 0 && upgradeTypes.length === 0;

  // 선택한 타입이 다운그레이드인데 용량 초과인지
  const selectedType    = types.find(t => t.id === selected);
  const selectedVol     = Number(selectedType?.volume_liter ?? 0);
  const isSelDowngrade  = selected ? selectedVol < currentVolume : false;
  const canSubmit       = !!selected && (!isSelDowngrade || usedVolume <= selectedVol);

  async function handleRequest() {
    if (!canSubmit) return;
    setSubmitting(true);
    setReqError("");
    const type = types.find((t) => t.id === selected);
    try {
      const res = await fetch(`/api/storage/${storage.id}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type:        "CAPACITY_CHANGE",
          requested_type_id:   selected,
          requested_type_code: type?.code,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setReqError(json.error ?? "요청 접수에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setReqError("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddSlot() {
    setSubmitting(true);
    setReqError("");
    try {
      const res = await fetch(`/api/storage/${storage.id}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_type: "ADD_SLOT" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setReqError(json.error ?? "요청 접수에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      setReqError("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  function TypeButton({ t }: { t: StorageType }) {
    const vol        = Number(t.volume_liter ?? 0);
    const isUp       = vol > currentVolume;
    const isDown     = vol < currentVolume;
    const canFit     = isDown ? usedVolume <= vol : true;
    const isSelected = selected === t.id;
    const diff       = isUp ? `+${(vol - currentVolume).toFixed(1)}L` : `-${(currentVolume - vol).toFixed(1)}L`;

    // 단기 보관 = 주단위 요금, 장기 보관 = 월단위 요금
    const isShortTerm = storage.storage_mode === "short_term";
    const fee         = isShortTerm ? t.price_per_week : (t.price_per_month ?? t.price_per_week);
    const feeUnit     = isShortTerm ? "/주" : (t.price_per_month != null ? "/월" : "/주");

    return (
      <button
        key={t.id}
        onClick={() => { if (canFit) setSelected(t.id); }}
        disabled={!canFit}
        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
          !canFit
            ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
            : isSelected
            ? "border-brand-500 bg-brand-50"
            : "border-gray-100 bg-white hover:border-gray-300"
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
          !canFit ? "bg-gray-200 text-gray-400" :
          isSelected ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500"
        }`}>
          {(TYPE_SIZE_KO[t.code] ?? t.code).slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isSelected ? "text-brand-700" : "text-gray-800"}`}>
            {TYPE_SIZE_KO[t.code] ?? t.name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {t.volume_liter != null && `${t.volume_liter}L`}
            {t.max_parcels != null && ` · 최대 ${t.max_parcels}개`}
            {currentVolume > 0 && (
              <span className={`font-semibold ml-1 ${isUp ? "text-brand-600" : canFit ? "text-orange-500" : "text-red-400"}`}>
                ({diff})
              </span>
            )}
          </p>
          {isDown && !canFit && (
            <p className="text-[10px] text-red-500 mt-0.5">
              현재 사용 {usedVolume}L — {(usedVolume - vol).toFixed(1)}L 비워야 함
            </p>
          )}
          {isDown && canFit && (
            <p className="text-[10px] text-emerald-600 mt-0.5">
              현재 사용 {usedVolume}L — 다운그레이드 가능 ✓
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className={`text-sm font-bold ${isSelected ? "text-brand-600" : "text-gray-700"}`}>
            {fee != null ? `${fee.toLocaleString()}원` : "-"}
          </p>
          <p className="text-[10px] text-gray-400">
            {feeUnit}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-white rounded-3xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <div>
            <p className="text-base font-bold text-gray-900">용량 변경</p>
            <p className="text-xs text-gray-400 mt-0.5">사용 중인 블록 변경 — 즉시 적용</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="px-4 py-10 flex flex-col items-center gap-3 overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <svg width="24" height="24" fill="none" stroke="#16a34a" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="text-sm font-bold text-gray-900">변경이 적용되었습니다</p>
            <p className="text-xs text-gray-500 text-center">
              관리자가 물리적 로케이션을 재배정합니다.
            </p>
            <button onClick={() => { onDone ? onDone() : onClose(); }} className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl">
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">

              {/* 현재 사용 중 블록 표시 */}
              {!loading && resolvedTypeName && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border-2 border-brand-200 bg-brand-50 mb-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs bg-brand-600 text-white">
                    {resolvedTypeName.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-brand-700">{resolvedTypeName}</p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-200 text-brand-800">현재 사용 중</span>
                    </div>
                    <p className="text-xs text-brand-500 mt-0.5">
                      {currentVolume}L
                      {usedVolume > 0 && ` · 사용 ${usedVolume}L (${Math.round((usedVolume / currentVolume) * 100)}%)`}
                    </p>
                  </div>
                </div>
              )}

              {/* 최대 사이즈 안내 (업그레이드 없음, 다운그레이드만 남음) */}
              {isAlreadyMax && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-2">
                  <p className="text-xs font-bold text-amber-800">최대 사이즈 — 업그레이드 불가</p>
                  <p className="text-xs text-amber-700 mt-0.5">더 큰 용량이 필요하면 블록을 추가해 주세요.</p>
                  <button
                    onClick={handleAddSlot}
                    disabled={submitting}
                    className="mt-2 w-full bg-amber-600 text-white text-xs font-bold py-2.5 rounded-xl disabled:opacity-40"
                  >
                    블록 추가 신청
                  </button>
                </div>
              )}

              {loading ? (
                <div className="py-10 flex justify-center">
                  <svg className="animate-spin w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                </div>
              ) : (
                <>
                  {/* 업그레이드 섹션 */}
                  {upgradeTypes.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1">업그레이드</p>
                      {upgradeTypes.map(t => <TypeButton key={t.id} t={t} />)}
                    </>
                  )}

                  {/* 다운그레이드 섹션 */}
                  {downgradeTypes.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mt-3">
                        다운그레이드 (사용량이 맞을 때만 가능)
                      </p>
                      {downgradeTypes.map(t => <TypeButton key={t.id} t={t} />)}
                    </>
                  )}
                </>
              )}

              {reqError && (
                <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{reqError}</p>
              )}
            </div>

            {/* 하단 버튼 */}
            <div className="px-4 pt-3 pb-5 border-t border-gray-100 bg-white shrink-0 rounded-b-3xl">
              <button
                onClick={handleRequest}
                disabled={!canSubmit || submitting}
                className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                    </svg>
                    처리 중...
                  </>
                ) : isSelDowngrade ? "용량 줄이기" : "용량 변경하기"}
              </button>
            </div>
          </>
        )}
      </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[400px] bg-white rounded-3xl shadow-2xl">
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
              <p className="text-[11px] text-gray-500 mt-0.5">우체국택배</p>
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

/* ─── 이름 변경 시트 ──────────────────────────── */
function RenameSheet({
  storage,
  onClose,
  onSaved,
}: {
  storage: Storage;
  onClose: () => void;
  onSaved: (newName: string, colorKey?: string) => void;
}) {
  const [name, setName] = useState(storage.storage_name);
  const [selectedColor, setSelectedColor] = useState<string>(storage.card_color ?? "");
  const [saving, setSaving] = useState(false);
  const typeCode = storage.storage_types?.code ?? "DEFAULT";

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const body: Record<string, string> = { storage_name: trimmed };
    if (selectedColor) body.card_color = selectedColor;
    const res = await fetch(`/api/storage/${storage.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) onSaved(trimmed, selectedColor || undefined);
    else alert("저장에 실패했습니다.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-white rounded-3xl shadow-2xl">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <p className="text-base font-bold text-gray-900">스토리지 설정</p>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-5 space-y-4">
          {/* 이름 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1.5">스토리지 이름</p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              placeholder="스토리지 이름 입력"
              maxLength={30}
              autoFocus
              className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-sm outline-none focus:border-brand-400"
            />
            <p className="text-xs text-gray-400 mt-1">최대 30자 · 예: 겨울옷 보관함, 유학 짐</p>
          </div>
          {/* 카드 색상 */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">카드 색상</p>
            <div className="flex gap-2">
              {CARD_THEME_KEYS.map(key => {
                const t = CARD_THEME_MAP[key];
                const active = selectedColor === key;
                const LABEL: Record<string, string> = { red: "레드", green: "그린", yellow: "옐로", blue: "블루", black: "블랙" };
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedColor(active ? "" : key)}
                    className="flex-1 flex flex-col items-center gap-1.5 py-2 rounded-2xl transition-all border-2"
                    style={{
                      borderColor: active ? t.accent : "transparent",
                      background: "#f9fafb",
                      boxShadow: active ? `0 0 0 3px ${t.accent}30` : "none",
                    }}
                  >
                    <BrickSVG color={t.accent} typeCode={typeCode} size={Math.round((BLOCK_BASE_SIZE[typeCode] ?? 76) * 0.48)} />
                    <span className="text-[10px] font-semibold" style={{ color: active ? t.accent : "#9ca3af" }}>
                      {LABEL[key] ?? key}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
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

/* ─────────────────────────────────────────────
   블록 합치기 시트 (단순화: 남길 블록만 선택)
───────────────────────────────────────────── */
function MergeSlotSheet({
  storages,
  onClose,
  onDone,
}: {
  storages: Storage[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const [targetId, setTargetId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const [suggestedType, setSuggestedType] = useState<{ name: string; code: string; volume_liter: number; price_per_month?: number } | null>(null);

  const totalUsed = storages.reduce((a, s) => a + (s.used_score ?? 0), 0);

  function getCapInfo(target: Storage) {
    const others = storages.filter(s => s.id !== target.id);
    const free = (target.capacity_score ?? 0) - (target.used_score ?? 0);
    const srcUsed = others.reduce((a, s) => a + (s.used_score ?? 0), 0);
    const fits = (target.capacity_score ?? 0) === 0 || srcUsed <= free;
    return { fits, overBy: srcUsed - free, srcUsed, count: others.length };
  }

  const anyFits = storages.some(s => getCapInfo(s).fits);

  useEffect(() => {
    if (!anyFits && totalUsed > 0) {
      fetch("/api/storage/types")
        .then(r => r.json())
        .then(j => {
          const types: { id: string; code: string; name: string; volume_liter: number; price_per_month?: number }[] = j.types ?? [];
          const sorted = types.filter(t => t.volume_liter >= totalUsed).sort((a, b) => a.volume_liter - b.volume_liter);
          setSuggestedType(sorted[0] ?? null);
        });
    }
  }, [anyFits, totalUsed]);

  async function handleSubmit() {
    if (!targetId) return;
    setSubmitting(true);
    setServerError("");
    const sourceIds = storages.filter(s => s.id !== targetId).map(s => s.id);
    try {
      const res = await fetch(`/api/storage/${targetId}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_type: "MERGE_SLOTS", source_storage_ids: sourceIds, customer_note: note.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) { setServerError(json.error ?? "요청 접수에 실패했습니다."); return; }
      setDone(true);
    } catch {
      setServerError("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-white rounded-3xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">블록 합치기</p>
            <p className="text-xs text-gray-400 mt-0.5">남길 블록을 선택하면 나머지가 자동으로 합쳐집니다</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {done ? (
          <div className="px-4 py-10 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={24} className="text-green-600" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-bold text-gray-900">블록이 합쳐졌습니다</p>
            <p className="text-xs text-gray-500 text-center">관리자가 물품을 선택한 블록으로 이전합니다.</p>
            <button onClick={() => { onDone ? onDone() : onClose(); }} className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl">확인</button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
              {storages.map(s => {
                const { fits, overBy, count, srcUsed } = getCapInfo(s);
                const isSel = targetId === s.id;
                const tc = s.storage_types?.code ?? s.plan_type ?? "DEFAULT";
                const col = isSel ? "#6366f1" : fits ? "#6b7280" : "#d1d5db";
                return (
                  <button
                    key={s.id}
                    onClick={() => fits && setTargetId(s.id)}
                    disabled={!fits}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                      isSel ? "border-brand-500 bg-brand-50" :
                      fits ? "border-gray-100 bg-white hover:border-gray-300" :
                      "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <div className="w-10 h-10 flex items-center justify-center shrink-0">
                      <BrickSVG color={col} typeCode={tc} size={40} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isSel ? "text-brand-700" : fits ? "text-gray-800" : "text-gray-400"}`}>
                        {s.storage_name}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {s.storage_types?.name ?? tc} · {s.capacity_score ?? 0}L · 사용 {s.used_score ?? 0}L
                      </p>
                      {fits ? (
                        <p className="text-[10px] text-brand-500 mt-0.5">
                          이 블록에 나머지 {count}개 블록({srcUsed}L)이 합쳐집니다
                        </p>
                      ) : (
                        <p className="text-[10px] text-red-500 font-semibold mt-0.5">용량 부족 ({overBy}L 초과)</p>
                      )}
                    </div>
                    {isSel && <Check size={15} className="text-brand-600 shrink-0" />}
                  </button>
                );
              })}

              {/* 모든 블록이 합치기 불가능할 때 추천 */}
              {!anyFits && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                  <p className="text-sm font-bold text-amber-800">현재 블록들을 합칠 수 없어요</p>
                  <p className="text-xs text-amber-700">
                    전체 물품 사용량이 <span className="font-bold">{totalUsed}L</span>입니다.
                    기존 블록 중 이를 담을 수 있는 여유 공간이 없습니다.
                  </p>
                  {suggestedType ? (
                    <div className="bg-white rounded-xl p-3 flex items-center gap-3 border border-amber-100">
                      <BrickSVG color="#f59e0b" typeCode={suggestedType.code} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-gray-800">
                          {suggestedType.name} 으로 용량 변경 후 합치기
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {suggestedType.volume_liter}L
                          {suggestedType.price_per_month != null && ` · ${suggestedType.price_per_month.toLocaleString()}원/월`}
                        </p>
                      </div>
                      <button
                        onClick={onClose}
                        className="text-[11px] font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg whitespace-nowrap"
                      >
                        용량 변경
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600">현재 최대 용량 블록도 부족합니다. 새 블록을 추가해 주세요.</p>
                  )}
                </div>
              )}

              {serverError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{serverError}</p>}

              <div className="pt-1">
                <label className="text-xs font-bold text-gray-700 mb-1 block">요청 메모 <span className="font-normal text-gray-400">(선택)</span></label>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="특이사항을 입력해 주세요." rows={2} maxLength={200}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 resize-none" />
              </div>
            </div>

            <div className="px-4 pt-3 pb-5 border-t border-gray-100 bg-white shrink-0 rounded-b-3xl">
              <button onClick={handleSubmit} disabled={!targetId || submitting}
                className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> 처리 중...</> : "이 블록에 합치기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
