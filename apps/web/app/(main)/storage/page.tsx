"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package, Plus, RefreshCw, Archive,
  ChevronRight, X, Check, Loader2,
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
  card_color: string | null;
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
  photo_url: string | null;
}

interface LocationSummary {
  slot_count: number;
  total_weekly_fee: number;
  dominant_type: { code: string; name: string; count: number; price_per_week: number } | null;
}

/* ─── 상수 ──────────────────────────────────────── */

export const CARD_THEME_MAP: Record<string, { bg: string; accent: string }> = {
  green:  { bg: "linear-gradient(160deg,#0d2b18 0%,#1a4d2e 60%,#0a1f12 100%)", accent: "#4ade80" },
  purple: { bg: "linear-gradient(160deg,#1c1240 0%,#2d1b69 60%,#110b30 100%)", accent: "#a78bfa" },
  red:    { bg: "linear-gradient(160deg,#3a0e0e 0%,#5c1a1a 60%,#280a0a 100%)", accent: "#f87171" },
  blue:   { bg: "linear-gradient(160deg,#0c253d 0%,#1a3f60 60%,#071928 100%)", accent: "#38bdf8" },
  pink:   { bg: "linear-gradient(160deg,#1c0a30 0%,#2e1065 60%,#110520 100%)", accent: "#e879f9" },
};
const CARD_THEME_KEYS = Object.keys(CARD_THEME_MAP) as (keyof typeof CARD_THEME_MAP)[];

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
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [itemListOpen, setItemListOpen] = useState(true);
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

  const PAGE_SIZE_OPTIONS = [10, 30, 50, 0] as const; // 0 = 전체
  const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredItems.length / pageSize);
  const pagedItems = pageSize === 0 ? filteredItems : filteredItems.slice((page - 1) * pageSize, page * pageSize);

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
            {/* ── 전체 요약 카드 ───────────────────── */}
            <div className="bg-brand-600 rounded-2xl p-4 text-white">
              <p className="text-xs font-semibold text-brand-200 mb-3">전체 요약</p>
              {/* 1행: 물품·상태 */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <SummaryCell label="이용 중" value={`${active.length}개`} />
                <SummaryCell label="총 물품" value={`${items.length}개`} />
                <SummaryCell
                  label="출고 가능"
                  value={shippableCount > 0 ? `${shippableCount}개` : "-"}
                  accent={shippableCount > 0 ? "text-green-300" : undefined}
                />
              </div>
              {/* 구분선 */}
              <div className="border-t border-brand-500/50 mb-3" />
              {/* 2행: 요금·결제 */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <SummaryCell
                  label="주간 요금"
                  value={locationSummary?.total_weekly_fee
                    ? `${locationSummary.total_weekly_fee.toLocaleString()}원`
                    : totalMonthly > 0 ? `${totalMonthly.toLocaleString()}원` : "-"}
                />
                <SummaryCell
                  label="월 요금"
                  value={totalMonthlyFee > 0 ? `${totalMonthlyFee.toLocaleString()}원` : "-"}
                />
                <SummaryCell
                  label="다음 결제일"
                  value={nextBilling
                    ? new Date(nextBilling).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })
                    : "-"}
                />
              </div>
              {/* 3행: 용량 바 */}
              {active.length > 0 && (
                <>
                  <div className="border-t border-brand-500/50 mb-3" />
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] text-brand-200">평균 용량 사용률</span>
                      <span className={`text-[11px] font-bold ${avgUsage >= 90 ? "text-red-300" : avgUsage >= 70 ? "text-orange-300" : "text-brand-200"}`}>
                        {avgUsage}%
                      </span>
                    </div>
                    <div className="w-full bg-brand-700/60 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${avgUsage >= 90 ? "bg-red-400" : avgUsage >= 70 ? "bg-orange-400" : "bg-brand-300"}`}
                        style={{ width: `${Math.min(avgUsage, 100)}%` }}
                      />
                    </div>
                    {active.length > 1 && (
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {active.map((s) => (
                          <span key={s.id} className="text-[9px] text-brand-300 flex items-center gap-0.5">
                            <span>{s.storage_name}</span>
                            <span className={`font-bold ${(s.usage_percent ?? 0) >= 90 ? "text-red-300" : "text-brand-200"}`}>
                              {Math.round(s.usage_percent ?? 0)}%
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </>
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
                    style={{ height: 0, paddingBottom: "30.6%", touchAction: "none" }}
                    onPointerDown={e => {
                      // 버튼만 캡처 제외 (버튼 클릭은 정상 동작), <a>는 드래그 시 preventDefault로 이동 차단
                      if ((e.target as HTMLElement).closest("button")) return;
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
                          onClick={abs > 0 ? () => { if (!isDraggingRef.current) setActiveIdx(i); } : undefined}
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
                              className="flex flex-col items-center justify-center gap-3 h-full rounded-3xl border-2 border-dashed border-white/20 hover:border-white/40 transition-colors"
                              style={{ background: "linear-gradient(160deg,#1c1c2e 0%,#12122a 100%)" }}
                            >
                              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                <Plus size={18} className="text-white/50" />
                              </div>
                              <p className="text-[12px] font-semibold text-white/40">스토리지 추가</p>
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

            {/* ── 슬롯 합치기 버튼 (2개 이상일 때) ── */}
            {active.length >= 2 && (
              <button
                type="button"
                onClick={() => setMergeSheet(true)}
                className="w-full flex items-center justify-center gap-2 bg-white border-2 border-gray-200 text-gray-700 text-sm font-bold px-4 py-3.5 rounded-2xl hover:bg-gray-50 transition-colors"
              >
                <Archive size={16} />
                슬롯 합치기 (용량 통합 신청)
              </button>
            )}

            {/* ── 물품 목록 ────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {/* 헤더 — 클릭으로 아코디언 토글 */}
              <button
                type="button"
                onClick={() => setItemListOpen((o) => !o)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div>
                  <p className="text-sm font-bold text-gray-900">물품 목록</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    전체 {items.length}개
                    {items.filter((it) => it.parcel_status === "SHIPPABLE" || it.parcel_status === "READY" || it.is_shippable === true).length > 0 && (
                      <span className="ml-2 text-green-600 font-semibold">
                        출고 가능 {items.filter((it) => it.parcel_status === "SHIPPABLE" || it.parcel_status === "READY" || it.is_shippable === true).length}개
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {itemListOpen && (
                    <select
                      value={pageSize}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                      className="text-xs text-gray-500 border border-gray-200 rounded-lg px-2 py-1 outline-none bg-white"
                    >
                      <option value={10}>10개</option>
                      <option value={30}>30개</option>
                      <option value={50}>50개</option>
                      <option value={0}>전체</option>
                    </select>
                  )}
                  <ChevronRight
                    size={16}
                    className={`text-gray-400 transition-transform duration-200 ${itemListOpen ? "rotate-90" : ""}`}
                  />
                </div>
              </button>

              {itemListOpen && (
                <>
              {/* 필터 탭 */}
              <div className="flex overflow-x-auto border-b border-gray-50 px-2 gap-0.5">
                {filterTabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => { setItemFilter(tab); setPage(1); }}
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
                <>
                  <div className="divide-y divide-gray-50">
                    {pagedItems.map((item) => {
                      const storageName =
                        active.find((s) => s.id === item.storage_id)?.storage_name ?? "-";
                      const statusCfg =
                        item.is_shippable
                          ? { label: "출고 가능", color: "bg-green-100 text-green-700" }
                          : (PARCEL_STATUS_DISPLAY[item.parcel_status] ?? { label: "보관 중", color: "bg-gray-100 text-gray-500" });
                      return (
                        <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                          {/* 썸네일 */}
                          <div className="shrink-0">
                            {item.photo_url ? (
                              <img
                                src={item.photo_url}
                                alt={item.name}
                                className="w-10 h-10 rounded-xl object-cover cursor-pointer"
                                onMouseEnter={(e) => {
                                  const rect = (e.target as HTMLElement).getBoundingClientRect();
                                  setHoverPhoto({ url: item.photo_url!, x: rect.left, y: rect.top });
                                }}
                                onMouseLeave={() => setHoverPhoto(null)}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                                <Package size={16} className="text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {item.name}
                              {item.quantity > 1 && (
                                <span className="ml-1.5 text-xs text-gray-400 font-normal">{item.quantity}개</span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{storageName}</p>
                          </div>
                          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* 페이지네이션 */}
                  {totalPages > 1 && (
                    <div className="px-4 py-3 flex items-center justify-between border-t border-gray-50">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg disabled:opacity-30"
                      >
                        이전
                      </button>
                      <span className="text-xs text-gray-400">
                        {page} / {totalPages}
                        <span className="ml-1 text-gray-300">({filteredItems.length}개)</span>
                      </span>
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg disabled:opacity-30"
                      >
                        다음
                      </button>
                    </div>
                  )}
                </>
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
      />
    )}

    {/* 슬롯 합치기 시트 */}
    {mergeSheet && active.length >= 2 && (
      <MergeSlotSheet
        storages={active}
        onClose={() => setMergeSheet(false)}
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

/* ─── 요약 셀 ──────────────────────────────────── */
function SummaryCell({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-brand-200 mb-1">{label}</p>
      <p className={`text-sm font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}

/* ─── 카드 테마 타입 ────────────────────────── */
type CardTheme = { bg: string; accent: string };

/* ─── 스토리지 카드 (로열티 카드 스타일) ─────── */
function StorageCard({
  storage: s,
  itemCount,
  locationSummary,
  storageItems,
  theme,
  onDetail,
  onRelease,
  onCapacity,
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
  const cardRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setZoom(Math.min(1, w / 295));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const freeInfo    = s.storage_mode === "short_term" ? calcFreeInfo(s.short_term_started_at) : null;
  const isShortTerm = s.storage_mode === "short_term";
  const weeklyFee   = locationSummary?.total_weekly_fee ?? s.storage_plan_config?.weekly_rate ?? 0;
  const planName    = locationSummary?.dominant_type?.name ?? s.plan_type ?? "-";
  const usagePct    = Math.round(s.usage_percent ?? 0);

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

  return (
    <div
      ref={cardRef}
      className="rounded-xl overflow-hidden relative select-none h-full"
      style={{
        background: theme.bg,
        boxShadow: `0 4px 16px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.06)`,
      }}
    >
      {/* zoom 래퍼 — 카드 너비 기준으로 전체 콘텐츠 비율 유지 */}
      <div style={{ zoom, transformOrigin: "top left" }}>
      {/* 배경 텍스처 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(60deg,transparent,transparent 44px,rgba(255,255,255,0.012) 44px,rgba(255,255,255,0.012) 88px)",
        }}
      />

      {/* ── 상단: 아이콘 + 스토리지명 + 티어 뱃지 ── */}
      <div className="relative px-3 pt-2 flex items-start justify-between">
          <div className="flex items-center gap-1.5">
          <div
            className="w-6 h-6 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${theme.accent}18`, border: `1.5px solid ${theme.accent}40` }}
          >
            <Package size={10} style={{ color: theme.accent }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 mt-0.5">
              <p className="text-[12px] font-bold text-white leading-tight truncate">{s.storage_name}</p>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onRename(); }}
                className="shrink-0 p-0.5 rounded-md opacity-40 hover:opacity-80 transition-opacity"
                style={{ color: theme.accent }}
              >
                <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              {/* 팔레트 버튼 제거 — 이름 변경 팝업에서 색상 선택 가능 */}
            </div>
          </div>
        </div>
        <div
          className="px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide shrink-0"
          style={{ background: `${theme.accent}18`, color: theme.accent, border: `1px solid ${theme.accent}35`, fontSize: "8px" }}
        >
          {isShortTerm ? "단기" : "장기"} · {planName}
        </div>
      </div>

      {/* ── 중단: 요금 + 물품 수 ── */}
      <div className="relative px-3 mt-1.5 flex items-end justify-between">
        <div>
          <p className="text-[9px] text-white/30 mb-0.5">{isShortTerm ? "주 요금" : "월 요금"}</p>
          <p className="text-[22px] font-black leading-none tracking-tight" style={{ color: theme.accent }}>
            {mainFeeLabel === "FREE" ? "FREE" : `₩${mainFeeLabel}`}
          </p>
          {mainUnit && mainFeeLabel !== "FREE" && (
            <p className="text-[9px] text-white/30 mt-0.5">{mainUnit}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/30 mb-0.5">보관 물품</p>
          <p className="text-[22px] font-black leading-none text-white">{itemCount}</p>
          <p className="text-[9px] text-white/30 mt-0.5">개</p>
        </div>
      </div>

      {/* ── 눈금 게이지 ── */}
      <div className="relative px-3 mt-1.5 flex items-center gap-2">
        <div className="flex gap-[2px] flex-1">
          {Array.from({ length: 20 }).map((_, i) => {
            const filled = i < Math.round(usagePct / 5);
            return (
              <div
                key={i}
                className="flex-1 rounded-[2px]"
                style={{
                  height: 7,
                  background: filled ? theme.accent : "rgba(255,255,255,0.12)",
                  transition: "background 0.3s",
                }}
              />
            );
          })}
        </div>
        <span className="shrink-0 font-bold" style={{ color: theme.accent, fontSize: "9px" }}>
          {freeBadge ?? `${usagePct}%`}
        </span>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="relative px-2 mt-1.5 grid grid-cols-3 gap-1">
        <button
          type="button"
          className="py-1.5 rounded-xl font-bold text-white transition-colors"
          style={{ background: `linear-gradient(90deg,${theme.accent}cc,${theme.accent}99)`, fontSize: "11px" }}
          onClick={e => {
            e.stopPropagation();
            const parcelIds = [...new Set(
              storageItems.filter(it => it.storage_id === s.id && it.parcel_id).map(it => it.parcel_id)
            )];
            if (parcelIds.length === 0) { alert("출고 가능한 물품이 없습니다."); return; }
            onRelease(parcelIds as string[]);
          }}
        >
          출고 요청
        </button>
        <button
          type="button"
          className="py-1.5 rounded-xl font-bold transition-colors"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)", fontSize: "11px" }}
          onClick={e => { e.stopPropagation(); onCapacity(); }}
        >
          용량 변경
        </button>
        <button
          type="button"
          className="py-1.5 rounded-xl font-bold transition-colors"
          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.75)", border: "1px solid rgba(255,255,255,0.15)", fontSize: "11px" }}
          onClick={e => { e.stopPropagation(); onDetail(); }}
        >
          상세 보기
        </button>
      </div>
      </div>{/* /zoom wrapper */}
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
  MINI:     "미니 (소형)",
  STANDARD: "스탠다드 (중형)",
  LONG:     "롱박스 (대형)",
  XL:       "XL (특대)",
  OVERSIZE: "오버사이즈 (랙)",
};

function CapacityChangeSheet({
  storage,
  currentTypeName,
  onClose,
}: {
  storage: Storage;
  currentTypeName: string | null;
  onClose: () => void;
}) {
  const [types, setTypes] = useState<StorageType[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/storage/types")
      .then((r) => r.json())
      .then((j) => setTypes(j.types ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function handleRequest() {
    if (!selected) return;
    setSubmitting(true);
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
        alert(json.error ?? "요청 접수에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-[520px] bg-white rounded-3xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <div>
            <p className="text-base font-bold text-gray-900">용량 변경</p>
            <p className="text-xs text-gray-400 mt-0.5">
              현재: {currentTypeName ?? storage.plan_type ?? "-"}
            </p>
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
            <p className="text-sm font-bold text-gray-900">변경 요청이 접수되었습니다</p>
            <p className="text-xs text-gray-500 text-center">
              관리자가 확인 후 로케이션을 재배정해 드립니다.<br />
              처리 완료 시 알림으로 안내해 드립니다.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            {/* 옵션 목록 — 스크롤 */}
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">원하는 사이즈를 선택하면 관리자에게 변경 요청이 전달됩니다.</p>

              {loading ? (
                <div className="py-10 flex justify-center">
                  <svg className="animate-spin w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                </div>
              ) : (
                types.map((t) => {
                  const isSelected = selected === t.id;
                  const isCurrent = currentTypeName === t.name || currentTypeName === t.code;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelected(t.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-brand-500 bg-brand-50"
                          : isCurrent
                          ? "border-gray-300 bg-gray-50 opacity-60"
                          : "border-gray-100 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-xs ${
                          isSelected ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {t.code.slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isSelected ? "text-brand-700" : "text-gray-800"}`}>
                          {TYPE_SIZE_KO[t.code] ?? t.name}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                              현재
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.max_parcels != null ? `최대 ${t.max_parcels}개 물품` : "무제한"}
                          {t.volume_liter != null && ` · ${t.volume_liter}L`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isSelected ? "text-brand-600" : "text-gray-700"}`}>
                          {t.price_per_month != null
                            ? `${t.price_per_month.toLocaleString()}원`
                            : `${t.price_per_week.toLocaleString()}원`}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {t.price_per_month != null ? "/월" : "/주"}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* 버튼 — 하단 */}
            <div className="px-4 pt-3 pb-5 border-t border-gray-100 bg-white shrink-0 rounded-b-3xl">
              <button
                onClick={handleRequest}
                disabled={!selected || submitting}
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
                ) : "변경 요청하기"}
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
            <div className="flex gap-3">
              {CARD_THEME_KEYS.map(key => {
                const t = CARD_THEME_MAP[key];
                const active = selectedColor === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedColor(active ? "" : key)}
                    className="flex-1 h-10 rounded-2xl transition-all"
                    style={{
                      background: t.bg,
                      outline: active ? `3px solid ${t.accent}` : "2px solid transparent",
                      outlineOffset: 2,
                      boxShadow: active ? `0 0 0 1px ${t.accent}40` : "none",
                    }}
                    title={key}
                  >
                    <div className="w-2 h-2 rounded-full mx-auto" style={{ background: t.accent }} />
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
   슬롯 합치기 시트
   여러 슬롯을 하나의 대표 슬롯으로 통합 신청
───────────────────────────────────────────── */
function MergeSlotSheet({
  storages,
  onClose,
}: {
  storages: Storage[];
  onClose: () => void;
}) {
  // 합칠 소스 슬롯 (대표 슬롯 제외)
  const [targetId, setTargetId] = useState<string | null>(
    storages.length > 0 ? storages[0].id : null
  );
  const [sourceIds, setSourceIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // 대상(target) 바뀌면 소스 선택 초기화
  useEffect(() => {
    setSourceIds(new Set());
  }, [targetId]);

  function toggleSource(id: string) {
    setSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sourceStorages = storages.filter(s => s.id !== targetId);
  const selectedSources = storages.filter(s => sourceIds.has(s.id));

  // 용량 합산 (capacity_score 기준, liter 정보가 없으면 score로 표시)
  const totalScore = selectedSources.reduce((acc, s) => acc + (s.capacity_score ?? 0), 0) +
    (storages.find(s => s.id === targetId)?.capacity_score ?? 0);

  async function handleSubmit() {
    if (!targetId || sourceIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/storage/${targetId}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: "MERGE_SLOTS",
          source_storage_ids: Array.from(sourceIds),
          customer_note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? "요청 접수에 실패했습니다.");
        return;
      }
      setDone(true);
    } catch {
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-[520px] bg-white rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">슬롯 합치기</p>
            <p className="text-xs text-gray-400 mt-0.5">여러 슬롯을 하나의 큰 보관함으로 통합합니다</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-4 py-10 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={24} className="text-green-600" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-bold text-gray-900">합치기 요청이 접수되었습니다</p>
            <p className="text-xs text-gray-500 text-center">
              관리자가 용량을 검토 후 통합 처리해 드립니다.<br />
              처리 완료 시 알림으로 안내해 드립니다.
            </p>
            <button onClick={onClose} className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl">
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
              {/* 안내 */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-bold text-blue-800">슬롯 합치기 안내</p>
                <ul className="space-y-0.5">
                  {[
                    "합칠 슬롯들의 총 용량 이하인 사이즈로 통합됩니다",
                    "관리자가 실제 물품을 대표 슬롯으로 이전 후 나머지 슬롯을 종료합니다",
                    "용량 기준 적합 여부는 관리자가 최종 확인합니다",
                  ].map(t => (
                    <li key={t} className="flex items-start gap-1"><span>•</span><span>{t}</span></li>
                  ))}
                </ul>
              </div>

              {/* STEP 1: 대표 슬롯 선택 */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">
                  STEP 1. 통합 후 남길 대표 보관함 선택
                </p>
                <div className="space-y-2">
                  {storages.map(s => {
                    const isTarget = targetId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setTargetId(s.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                          isTarget ? "border-brand-500 bg-brand-50" : "border-gray-100 bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isTarget ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500"
                        }`}>
                          <Archive size={15} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${isTarget ? "text-brand-700" : "text-gray-800"}`}>
                            {s.storage_name}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {s.storage_mode === "long_term" ? "장기" : "단기"}
                            {s.plan_type && ` · ${s.plan_type}`}
                            {s.capacity_score ? ` · 용량 ${s.capacity_score}점` : ""}
                          </p>
                        </div>
                        {isTarget && <Check size={15} className="text-brand-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2: 합칠 슬롯 선택 */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">
                  STEP 2. 합칠 슬롯 선택 (대표 슬롯으로 통합됨)
                </p>
                {sourceStorages.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">대표 슬롯을 먼저 선택해주세요.</p>
                ) : (
                  <div className="space-y-2">
                    {sourceStorages.map(s => {
                      const isSel = sourceIds.has(s.id);
                      return (
                        <button
                          key={s.id}
                          onClick={() => toggleSource(s.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${
                            isSel ? "border-orange-400 bg-orange-50" : "border-gray-100 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                            isSel ? "bg-orange-500 border-orange-500" : "border-gray-300"
                          }`}>
                            {isSel && <Check size={13} className="text-white" strokeWidth={3} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-bold ${isSel ? "text-orange-700" : "text-gray-800"}`}>
                              {s.storage_name}
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {s.storage_mode === "long_term" ? "장기" : "단기"}
                              {s.plan_type && ` · ${s.plan_type}`}
                              {s.capacity_score ? ` · 용량 ${s.capacity_score}점` : ""}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 합산 용량 미리보기 */}
              {sourceIds.size > 0 && totalScore > 0 && (
                <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <p className="text-xs text-gray-500">합산 용량 점수</p>
                  <p className="text-sm font-bold text-brand-700">{totalScore}점</p>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">
                  요청 메모 <span className="font-normal text-gray-400">(선택)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="특이사항이 있으면 입력해 주세요. (예: MINI 2개 → STANDARD 1개로 통합 희망)"
                  rows={2}
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 resize-none"
                />
              </div>
            </div>

            <div className="px-4 pt-3 pb-5 border-t border-gray-100 bg-white shrink-0 rounded-b-3xl">
              <button
                onClick={handleSubmit}
                disabled={!targetId || sourceIds.size === 0 || submitting}
                className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> 처리 중...</> : `합치기 신청 (${1 + sourceIds.size}개 → 1개)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
