"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Package, RefreshCw,
  CheckCircle, Clock, AlertTriangle,
  XCircle, Archive, Edit3, X, Check,
  CreditCard, Loader2, TruckIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CARD_THEME_MAP } from "../constants";
import { Block1SVG, Block2SVG, Block3SVG, Block4SVG, Block5SVG } from "../BlockSVGs";

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
  MINI: Block1SVG, STANDARD: Block2SVG, LONG: Block3SVG, XL: Block4SVG, OVERSIZE: Block5SVG, DEFAULT: Block2SVG,
};

const BLOCK_BASE_SIZE: Record<string, number> = {
  MINI: 64, STANDARD: 76, LONG: 88, XL: 100, OVERSIZE: 112, DEFAULT: 76,
};

function BrickSVG({ color, typeCode, size }: { color: string; typeCode: string; size?: number }) {
  const medium = color;
  const light  = shadeColor(color, 1.6);
  const dark   = shadeColor(color, 0.45);
  const Comp   = BLOCK_SVG_MAP[typeCode] ?? Block2SVG;
  const auto   = size ?? BLOCK_BASE_SIZE[typeCode] ?? 76;
  return <Comp dark={dark} medium={medium} light={light} size={auto} />;
}

interface PlanConfig {
  label_ko: string;
  label_en: string;
  weekly_rate: number | null;
  monthly_amount: number | null;
}

interface Storage {
  id: string;
  storage_name: string;
  storage_mode: "short_term" | "long_term";
  plan_type: string | null;
  current_plan_type: string | null;
  max_plan_type: string | null;
  monthly_amount: number | null;
  capacity_score: number | null;
  used_score: number;
  usage_percent: number;
  status: string;
  short_term_started_at: string | null;
  paid_until_date: string | null;
  next_billing_date: string | null;
  created_at: string;
  card_color: string | null;
  storage_plan_config: PlanConfig | null;
  storage_types?: { code: string } | null;
}

interface StorageParcel {
  id: string;
  tracking_no: string | null;
  status: string;
  inbound_at: string | null;
  weight_actual: number | null;
  sender_name: string | null;
  pre_invoice_items: { name: string; qty?: number }[] | null;
  is_shippable: boolean;
  hold_reason: string | null;
  created_at: string;
  parcel_media?: { storage_url: string | null; cf_thumbnail_url: string | null; stage: string; is_visible: boolean }[];
}

const PARCEL_STATUS_MAP: Record<string, { label: string; color: string }> = {
  CREATED:          { label: "입고중",   color: "bg-indigo-50 text-indigo-700" },
  PICKUP_REQUESTED: { label: "입고중",   color: "bg-indigo-50 text-indigo-700" },
  IN_TRANSIT:       { label: "입고중",   color: "bg-indigo-50 text-indigo-700" },
  INBOUND:          { label: "입고중",   color: "bg-indigo-50 text-indigo-700" },
  INSPECTING:       { label: "입고중",   color: "bg-indigo-50 text-indigo-700" },
  INSPECTION:       { label: "입고중",   color: "bg-indigo-50 text-indigo-700" },
  HOLD:             { label: "보류",     color: "bg-orange-100 text-orange-700" },
  PICKUP_CANCELLED: { label: "보류",     color: "bg-orange-100 text-orange-700" },
  SHIPPABLE:        { label: "출고 가능", color: "bg-green-100 text-green-700" },
  READY:            { label: "출고 가능", color: "bg-green-100 text-green-700" },
};

const STORAGE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ACTIVE:    { label: "이용 중",     color: "text-green-600 bg-green-50",   icon: CheckCircle },
  EMPTY:     { label: "비어있음",    color: "text-gray-500 bg-gray-100",    icon: Archive },
  SUSPENDED: { label: "서비스 제한", color: "text-orange-600 bg-orange-50", icon: AlertTriangle },
  OVERDUE:   { label: "장기 미납",   color: "text-red-600 bg-red-50",       icon: XCircle },
};

function CapacityBar({ percent }: { percent: number }) {
  const p = Math.min(Math.max(percent, 0), 100);
  const color = p >= 90 ? "bg-red-500" : p >= 70 ? "bg-orange-400" : "bg-brand-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2.5">
      <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${p}%` }} />
    </div>
  );
}

const FREE_DAYS = 3;

function calcFreeInfo(startedAt: string | null) {
  if (!startedAt) return { daysElapsed: 0, freeDaysLeft: FREE_DAYS, inFreePeriod: true, billableWeeks: 0, billingStartDate: null as string | null };
  const started = new Date(startedAt);
  const daysElapsed = Math.floor((Date.now() - started.getTime()) / (24 * 60 * 60 * 1000));
  const freeDaysLeft = Math.max(0, FREE_DAYS - daysElapsed);
  const inFreePeriod = daysElapsed < FREE_DAYS;
  const billableWeeks = inFreePeriod ? 0 : Math.ceil((daysElapsed - FREE_DAYS + 1) / 7);
  const billingStartDate = new Date(started.getTime() + FREE_DAYS * 24 * 60 * 60 * 1000)
    .toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
  return { daysElapsed, freeDaysLeft, inFreePeriod, billableWeeks, billingStartDate };
}

function calcWeeksUsed(startedAt: string | null): number {
  if (!startedAt) return 0;
  return Math.ceil(
    (Date.now() - new Date(startedAt).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
}

export default function StorageDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [storage, setStorage] = useState<Storage | null>(null);
  const [parcels, setParcels] = useState<StorageParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [allStorages, setAllStorages] = useState<Storage[]>([]);
  const [showReleaseSheet, setShowReleaseSheet] = useState(false);
  const [showCapacitySheet, setShowCapacitySheet] = useState(false);
  const [showConvertSheet, setShowConvertSheet] = useState(false);
  const [showMergeSheet, setShowMergeSheet] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [res, allRes] = await Promise.all([
        fetch(`/api/storage/${id}`),
        fetch("/api/storage"),
      ]);
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 404) { router.push("/storage"); return; }
      const json = await res.json();
      setStorage(json.storage);
      setParcels(json.parcels ?? []);
      setNameInput(json.storage?.storage_name ?? "");
      if (allRes.ok) {
        const allJson = await allRes.json();
        setAllStorages(allJson.storages ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  // 탭이 다시 활성화될 때 조용히 새로고침
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load(true);
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  async function saveName() {
    if (!storage || !nameInput.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/storage/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage_name: nameInput.trim() }),
    });
    if (res.ok) {
      const json = await res.json();
      setStorage((s) => s ? { ...s, storage_name: json.storage.storage_name } : s);
      setEditName(false);
    }
    setSaving(false);
  }

  const parcelInboundCount = parcels.filter((p) => p.status === "INBOUND").length;
  // 출고 가능
  const shippableParcels = parcels.filter(
    (p) => p.status === "SHIPPABLE" || p.status === "READY" || p.is_shippable === true
  );
  const holdingParcels = parcels.filter(
    (p) => p.status !== "SHIPPABLE" && p.status !== "READY" && p.is_shippable !== true
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <RefreshCw size={24} className="animate-spin text-gray-300" />
      </div>
    );
  }

  if (!storage) return null;

  const sCfg = STORAGE_STATUS_CONFIG[storage.status] ?? STORAGE_STATUS_CONFIG.ACTIVE;
  const SIcon = sCfg.icon;
  const planLabel = storage.storage_plan_config?.label_ko ?? storage.plan_type ?? "-";
  const freeInfo = storage.storage_mode === "short_term" ? calcFreeInfo(storage.short_term_started_at) : null;
  const weeksUsed = freeInfo?.billableWeeks ?? calcWeeksUsed(storage.short_term_started_at);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1 -ml-1 rounded-full hover:bg-gray-100">
          <ArrowLeft size={20} className="text-gray-700" />
        </button>
        <div className="flex-1 min-w-0">
          {editName ? (
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="flex-1 text-sm font-bold border-b border-brand-400 outline-none bg-transparent"
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditName(false); }}
              />
              <button onClick={saveName} disabled={saving} className="p-1 text-green-600">
                <Check size={16} />
              </button>
              <button onClick={() => setEditName(false)} className="p-1 text-gray-400">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => setEditName(true)} className="flex items-center gap-1.5 group">
              <span className="text-base font-bold text-gray-900 truncate">{storage.storage_name}</span>
              <Edit3 size={13} className="text-gray-400 group-hover:text-gray-600 shrink-0" />
            </button>
          )}
          <p className="text-xs text-gray-400">
            {storage.storage_mode === "short_term" ? "단기보관" : "장기보관"}
            {planLabel !== "-" && ` · ${planLabel}`}
          </p>
        </div>
        <button onClick={() => load(true)} disabled={refreshing} className="p-2 rounded-full hover:bg-gray-100">
          <RefreshCw size={16} className={`text-gray-400 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* ── 스토리지 카드 (리스트와 동일 스타일) ── */}
        {(() => {
          const CARD_THEME_KEYS = Object.keys(CARD_THEME_MAP);
          const themeKey = (storage.card_color && CARD_THEME_MAP[storage.card_color])
            ? storage.card_color
            : CARD_THEME_KEYS[parseInt(storage.id.replace(/-/g, "").slice(0, 8), 16) % CARD_THEME_KEYS.length];
          const theme = CARD_THEME_MAP[themeKey];
          const isShortTerm = storage.storage_mode === "short_term";
          const weeklyFee = storage.storage_plan_config?.weekly_rate ?? 0;
          const mainFee = isShortTerm
            ? (freeInfo?.inFreePeriod ? 0 : weeklyFee)
            : storage.monthly_amount ?? weeklyFee;
          const mainFeeLabel = isShortTerm
            ? (freeInfo?.inFreePeriod ? "FREE" : mainFee.toLocaleString())
            : mainFee > 0 ? mainFee.toLocaleString() : "-";
          const mainUnit = isShortTerm ? (freeInfo?.inFreePeriod ? "" : "/주") : "/월";
          const usagePct = Math.round(storage.usage_percent ?? 0);
          const badgeText = freeInfo?.inFreePeriod ? `+${freeInfo.freeDaysLeft}일 무료` : `${usagePct}%`;
          const itemCount = parcels.length;

          /* plan_type → block SVG 코드 매핑 */
          const PT_MAP: Record<string, string> = {
            MINI: "MINI", STANDARD: "STANDARD", LONG: "LONG", XL: "XL", OVERSIZE: "OVERSIZE",
            S: "MINI", M: "STANDARD", L: "LONG",
          };
          const typeCode    = PT_MAP[storage.plan_type ?? ""] ?? "DEFAULT";
          const accentColor = theme.accent;
          const BlockComp   = BLOCK_SVG_MAP[typeCode] ?? Block2SVG;
          const blockLight  = shadeColor(accentColor, 1.6);
          const blockDark   = shadeColor(accentColor, 0.45);
          const freeBadge   = freeInfo?.inFreePeriod ? `+${freeInfo.freeDaysLeft}일 무료` : null;
          const BLOCK_SIZES: Record<string, number> = { MINI: 80, STANDARD: 96, LONG: 110, XL: 124, OVERSIZE: 140, DEFAULT: 96 };
          const bSize = BLOCK_SIZES[typeCode] ?? 96;

          const typeName = { MINI: "파인트블록", STANDARD: "싱글블록", LONG: "더블블록", XL: "패밀리블록", OVERSIZE: "점보블록" }[typeCode] ?? planLabel;

          return (
            <div
              className="rounded-2xl overflow-hidden bg-white border border-gray-100"
              style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)" }}
            >
              <div className="flex flex-col px-3 pt-3 pb-2">
                {/* 블록 이미지 */}
                <div className="flex items-center justify-center flex-1 min-h-0 py-2">
                  <div style={{ filter: "drop-shadow(10px 12px 4px rgba(0,0,0,0.42))" }}>
                    <BlockComp dark={blockDark} medium={accentColor} light={blockLight} size={bSize} />
                  </div>
                </div>

                {/* 구분선 */}
                <div className="border-t border-gray-100 my-2" />

                {/* 정보 행 */}
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  {/* 이름 + 타입 */}
                  <div className="flex flex-col min-w-0">
                    <p className="text-[12px] font-bold text-gray-900 truncate">{storage.storage_name}</p>
                    <p className="text-[9px] text-gray-400 truncate">
                      {typeName}{storage.capacity_score ? ` · ${storage.capacity_score}L` : ""}
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
                  {/* 물품수 */}
                  <div className="text-center shrink-0">
                    <p className="text-[11px] font-black text-gray-800 leading-none">{itemCount}</p>
                    <p className="text-[8px] text-gray-400 mt-0.5">개</p>
                  </div>
                </div>

                {/* 사용률 바 */}
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-gray-400">사용률</span>
                    <span className="text-[10px] font-bold" style={{ color: freeBadge ? accentColor : usagePct >= 90 ? "#EF4444" : usagePct >= 70 ? "#F97316" : accentColor }}>
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
                    className="py-1.5 rounded-xl font-bold text-white transition-colors text-[11px]"
                    style={{ background: accentColor }}
                    onClick={() => {
                      if (shippableParcels.length === 0) { alert("출고 가능한 물품이 없습니다."); return; }
                      setShowReleaseSheet(true);
                    }}
                  >
                    출고하기
                  </button>
                  <button
                    type="button"
                    className="py-1.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 text-[11px] transition-colors"
                    onClick={() => setShowCapacitySheet(true)}
                  >
                    용량 변경
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 서비스 제한 안내 */}
        {storage.status === "SUSPENDED" && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-orange-600" />
              <p className="text-sm font-bold text-orange-700">결제 문제로 서비스가 제한되었습니다</p>
            </div>
            <p className="text-xs text-orange-600">
              미납된 금액을 결제하면 서비스가 즉시 복구됩니다.
              문의: support@infront.kr
            </p>
          </div>
        )}

        {/* 단기보관 — 출고 요청 + 정산 버튼 */}
        {storage.storage_mode === "short_term" &&
          storage.status === "ACTIVE" &&
          shippableParcels.length > 0 && (
            <button
              onClick={() => setShowReleaseSheet(true)}
              className="w-full bg-brand-600 text-white rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 text-sm font-bold shadow-sm"
            >
              <TruckIcon size={16} />
              출고 요청 및 보관료 정산
            </button>
          )}

        {/* 단기보관 — 장기 전환 유도 */}
        {storage.storage_mode === "short_term" && storage.status === "ACTIVE" && (
          <button
            onClick={() => setShowConvertSheet(true)}
            className="w-full bg-white border-2 border-brand-200 text-brand-700 rounded-2xl px-4 py-3.5 flex items-center justify-center gap-2 text-sm font-bold hover:bg-brand-50 transition-colors"
          >
            <Archive size={16} />
            장기보관으로 전환하기
          </button>
        )}

        {/* 블록 합치기 배너 */}
        {allStorages.length >= 2 && storage.status === "ACTIVE" && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center">
                <Archive size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-amber-900">보관료를 줄일 수 있어요</p>
                <p className="text-xs text-amber-700 mt-0.5 leading-snug">
                  여러 블록을 하나로 합치면 월 요금을 절약할 수 있어요.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMergeSheet(true)}
                className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors"
              >
                블록 합치기
              </button>
            </div>
          </div>
        )}

        {/* 단기보관 — 결제 대기 안내 */}
        {storage.status === "PENDING_PAYMENT" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-center">
            <p className="text-sm font-bold text-yellow-800 mb-1">수거비 결제 대기 중</p>
            <p className="text-xs text-yellow-700">
              수거비 결제가 완료되지 않았습니다. 신청 페이지로 돌아가 결제를 완료해 주세요.
            </p>
          </div>
        )}

        {/* 출고 가능 물품 목록 */}
        {shippableParcels.length > 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-900">출고 가능 물품</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {(() => {
                  const totalItems = shippableParcels.reduce((sum, p) =>
                    sum + (Array.isArray(p.pre_invoice_items) && p.pre_invoice_items.length > 0
                      ? p.pre_invoice_items.length
                      : 1), 0);
                  return `${totalItems}개 물품 · ${shippableParcels.length}개 운송장`;
                })()}
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {shippableParcels.map((parcel) => (
                <ParcelRow key={parcel.id} parcel={parcel} />
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex flex-col items-center gap-2">
            <Package size={28} className="text-gray-200" />
            <p className="text-sm font-medium text-gray-400">출고 가능한 물품이 없습니다</p>
            <p className="text-xs text-gray-300 text-center">
              검수 완료 후 출고 가능 상태로 전환됩니다
            </p>
          </div>
        )}

        {/* 보관 중 물품 (INBOUND / 검수 대기 등) */}
        {holdingParcels.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="text-sm font-bold text-gray-900">보관 중 물품</p>
              <p className="text-xs text-gray-400 mt-0.5">검수 대기 · 보류 등 출고 전 상태</p>
            </div>
            <div className="divide-y divide-gray-50">
              {holdingParcels.map((parcel) => (
                <ParcelRow key={parcel.id} parcel={parcel} />
              ))}
            </div>
          </div>
        )}

        {/* 이용 안내 */}
        <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
          <p className="text-xs font-bold text-gray-600">이용 안내</p>
          {[
            "내품은 수거 신청 후 1~2 영업일 내 입고됩니다.",
            "출고 요청 후 당일~1 영업일 내 처리됩니다.",
            "리스트 확인 서비스: 500원/개 (목록 기준 수량 확인)",
            "사진+검품 서비스: 1,000원/개 (사진 촬영 및 전산 등록)",
          ].map((t) => (
            <div key={t} className="flex items-start gap-1.5">
              <span className="text-gray-400 text-xs mt-0.5">•</span>
              <span className="text-xs text-gray-500">{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 출고 요청 + 보관료 정산 바텀시트 */}
      {showReleaseSheet && storage && (
        <ReleasePaymentSheet
          storage={storage}
          onClose={() => setShowReleaseSheet(false)}
        />
      )}

      {/* 용량 변경 시트 */}
      {showCapacitySheet && storage && (
        <CapacityChangeSheet
          storage={storage}
          currentTypeName={planLabel}
          onClose={() => setShowCapacitySheet(false)}
          onDone={() => { setShowCapacitySheet(false); load(true); }}
        />
      )}

      {/* 단기→장기 전환 시트 */}
      {showConvertSheet && storage && (
        <ConvertToLongTermSheet
          storage={storage}
          onClose={() => setShowConvertSheet(false)}
          onDone={() => { setShowConvertSheet(false); load(true); }}
        />
      )}

      {/* 다른 슬롯으로 이동 시트 */}
      {showMergeSheet && allStorages.length >= 2 && (
        <MergeSlotSheet
          storages={allStorages}
          onClose={() => setShowMergeSheet(false)}
          onDone={() => { setShowMergeSheet(false); load(true); }}
        />
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function ParcelRow({ parcel }: { parcel: StorageParcel }) {
  const s = parcel.is_shippable
    ? { label: "출고 가능", color: "bg-green-100 text-green-700" }
    : (PARCEL_STATUS_MAP[parcel.status] ?? { label: parcel.status, color: "bg-gray-100 text-gray-500" });
  const declaredItems = Array.isArray(parcel.pre_invoice_items) && parcel.pre_invoice_items.length > 0
    ? parcel.pre_invoice_items.filter((it) => it.name)
    : null;

  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // 사진: INSPECTION_PHOTO 우선, 없으면 영상 thumbnail
  const photoUrl = (() => {
    const media = parcel.parcel_media ?? [];
    const visible = media.filter((m) => m.is_visible);
    const photo = visible.find((m) => m.stage === "INSPECTION_PHOTO" && m.storage_url);
    if (photo) return photo.storage_url;
    const video = visible.find((m) => m.cf_thumbnail_url);
    return video?.cf_thumbnail_url ?? null;
  })();

  const metaLine = [
    parcel.inbound_at
      ? new Date(parcel.inbound_at).toLocaleDateString("ko-KR") + " 입고"
      : null,
    parcel.weight_actual != null ? `${parcel.weight_actual}kg` : null,
    parcel.tracking_no ?? null,
  ].filter(Boolean).join(" · ");

  // 인라인 썸네일 (컴포넌트로 분리하면 state 변경 시 리마운트되어 onMouseLeave 미발화)
  const thumbJsx = photoUrl ? (
    <img
      src={photoUrl}
      alt="입고 사진"
      className="w-9 h-9 rounded-xl object-cover cursor-zoom-in shrink-0"
      onMouseEnter={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
      onMouseLeave={() => setHoverPos(null)}
      onMouseMove={(e) => setHoverPos({ x: e.clientX, y: e.clientY })}
    />
  ) : (
    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
      <Package size={16} className="text-blue-400" />
    </div>
  );

  // fixed overlay — 한 번만 렌더링 (declaredItems 루프 밖)
  const overlay = hoverPos && photoUrl ? (
    <div
      className="pointer-events-none"
      style={{
        position: "fixed",
        zIndex: 9999,
        left: hoverPos.x + 16,
        top: Math.max(8, hoverPos.y - 132),
      }}
    >
      <img
        src={photoUrl}
        alt="입고 사진 확대"
        className="w-64 h-64 rounded-2xl object-cover shadow-2xl border-2 border-white"
      />
    </div>
  ) : null;

  if (declaredItems && declaredItems.length > 0) {
    return (
      <>
        {overlay}
        {declaredItems.map((item, idx) => (
          <div key={`${parcel.id}-${idx}`} className="px-4 py-3 flex items-center gap-3">
            {idx === 0 ? thumbJsx : (
              <div className="w-9 h-9 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {item.name}
                {item.qty && item.qty > 1 && (
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">{item.qty}개</span>
                )}
              </p>
              {idx === 0 && metaLine && (
                <p className="text-[10px] text-gray-400 mt-0.5 truncate">{metaLine}</p>
              )}
            </div>
            {idx === 0 && (
              <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${s.color}`}>
                {s.label}
              </span>
            )}
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      {thumbJsx}
      {overlay}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">
          {parcel.tracking_no ?? "운송장 미확인"}
        </p>
        {metaLine && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{metaLine}</p>
        )}
      </div>
      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${s.color}`}>
        {s.label}
      </span>
    </div>
  );
}


/* ─────────────────────────────────────────────
   출고 요청 + 단기보관 정산 바텀시트
───────────────────────────────────────────── */
function ReleasePaymentSheet({
  storage,
  onClose,
}: {
  storage: Storage;
  onClose: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [loading, setLoading] = useState(false);
  const [payParams, setPayParams] = useState<Record<string, string> | null>(null);
  const [jsUrl, setJsUrl] = useState("");

  const weeksUsed = calcWeeksUsed(storage.short_term_started_at);
  const weeklyRate = storage.storage_plan_config?.weekly_rate ?? 0;
  const maxPlan = storage.max_plan_type ?? storage.current_plan_type ?? storage.plan_type ?? "S";
  const storageFee = weeksUsed * weeklyRate;
  const releaseFee = 1000;
  const totalAmount = storageFee + releaseFee;

  useEffect(() => {
    if (!payParams || !jsUrl) return;
    const prev = document.getElementById("inicis-release-script");
    if (prev) prev.remove();
    const script = document.createElement("script");
    script.id = "inicis-release-script";
    script.src = jsUrl;
    script.onload = () => {
      const INIStdPay = (window as Window & { INIStdPay?: { pay: (id: string) => void } }).INIStdPay;
      if (INIStdPay?.pay) INIStdPay.pay("frmReleasePayment");
    };
    document.head.appendChild(script);
  }, [payParams, jsUrl]);

  async function handlePay() {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("customers")
        .select("name, phone, email")
        .eq("id", user?.id ?? "")
        .single();

      const res = await fetch("/api/storage/pay/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_id: storage.id,
          payment_type: "SHORT_TERM_STORAGE",
          buyername: profile?.name ?? "고객",
          buyertel: (profile?.phone ?? "").replace(/[^0-9\-]/g, "") || "010-0000-0000",
          buyeremail: profile?.email ?? "",
          billing_weeks: weeksUsed,
          billing_plan_type: maxPlan,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(json.error ?? "결제 준비에 실패했습니다.");
        return;
      }
      setJsUrl(json.jsUrl);
      setPayParams(json);
    } catch (e) {
      console.error(e);
      alert("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl">
        <div className="px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
          <p className="text-base font-bold text-gray-900">출고 요청 및 보관료 정산</p>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          {/* 정산 내역 */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2.5">
            <p className="text-xs font-bold text-gray-600 mb-1">정산 내역</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                단기보관료
                <span className="text-xs text-gray-400 ml-1">
                  ({maxPlan}플랜 {weeksUsed}주 × {weeklyRate.toLocaleString()}원)
                </span>
              </span>
              <span className="font-semibold text-gray-800">{storageFee.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">출고 처리비</span>
              <span className="font-semibold text-gray-800">{releaseFee.toLocaleString()}원</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between">
              <span className="text-sm font-bold text-gray-800">합계</span>
              <span className="text-base font-black text-brand-600">
                {totalAmount.toLocaleString()}원
              </span>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            결제 완료 후 출고 처리가 진행됩니다. 배송 정보는 별도 안내됩니다.
          </p>

          <button
            onClick={handlePay}
            disabled={loading || weeksUsed <= 0}
            className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" /> 처리 중...</>
            ) : (
              <><CreditCard size={16} /> {totalAmount.toLocaleString()}원 결제하기</>
            )}
          </button>
        </div>
      </div>

      {/* KG Inicis 결제 폼 */}
      {payParams && (
        <form
          id="frmReleasePayment"
          ref={formRef}
          method="POST"
          acceptCharset="UTF-8"
          style={{ display: "none" }}
        >
          <input type="hidden" name="version"      value="1.0" />
          <input type="hidden" name="gopaymethod"  value="Card" />
          <input type="hidden" name="mid"          value={payParams.mid} />
          <input type="hidden" name="oid"          value={payParams.oid} />
          <input type="hidden" name="price"        value={payParams.price} />
          <input type="hidden" name="timestamp"    value={payParams.timestamp} />
          <input type="hidden" name="signature"    value={payParams.signature} />
          <input type="hidden" name="verification" value={payParams.verification} />
          <input type="hidden" name="mKey"         value={payParams.mKey} />
          <input type="hidden" name="goodname"     value={payParams.goodname} />
          <input type="hidden" name="buyername"    value={payParams.buyername} />
          <input type="hidden" name="buyertel"     value={payParams.buyertel} />
          <input type="hidden" name="buyeremail"   value={payParams.buyeremail} />
          <input type="hidden" name="currency"     value="WON" />
          <input type="hidden" name="langWallet"   value="ko" />
          <input type="hidden" name="returnUrl"    value={payParams.returnUrl} />
          <input type="hidden" name="closeUrl"     value={payParams.closeUrl} />
          <input type="hidden" name="acceptmethod" value="centerCd(Y):HPP(2)" />
        </form>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   용량 변경 시트
───────────────────────────────────────────── */
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
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white rounded-t-3xl">
          <div>
            <p className="text-base font-bold text-gray-900">용량 변경</p>
            <p className="text-xs text-gray-400 mt-0.5">
              현재: {currentTypeName ?? storage.plan_type ?? "-"}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {done ? (
          <div className="px-4 py-10 flex flex-col items-center gap-3 overflow-y-auto">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={24} className="text-green-600" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-bold text-gray-900">용량이 변경되었습니다</p>
            <p className="text-xs text-gray-500 text-center">
              보관함 용량이 즉시 반영되었습니다.<br />
              관리자가 물리적 슬롯을 재배치합니다.
            </p>
            <button
              onClick={() => { onDone ? onDone() : onClose(); }}
              className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">원하는 사이즈를 선택하면 관리자에게 변경 요청이 전달됩니다.</p>
              {loading ? (
                <div className="py-10 flex justify-center">
                  <RefreshCw size={24} className="animate-spin text-gray-300" />
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
                      <div className="w-10 h-10 flex items-center justify-center shrink-0">
                        {(() => {
                          const Comp = BLOCK_SVG_MAP[t.code] ?? Block2SVG;
                          const col = isSelected ? "#6366f1" : "#9ca3af";
                          return <Comp dark={shadeColor(col, 0.5)} medium={col} light={shadeColor(col, 1.5)} size={40} />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isSelected ? "text-brand-700" : "text-gray-800"}`}>
                          {TYPE_SIZE_KO[t.code] ?? t.name}
                          {isCurrent && (
                            <span className="ml-2 text-[10px] font-semibold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">현재</span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {t.max_parcels != null ? `최대 ${t.max_parcels}개 물품` : "무제한"}
                          {t.volume_liter != null && ` · ${t.volume_liter}L`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-bold ${isSelected ? "text-brand-600" : "text-gray-700"}`}>
                          {t.price_per_week.toLocaleString()}원/주
                        </p>
                        {t.price_per_month != null && (
                          <p className={`text-[11px] font-semibold ${isSelected ? "text-blue-500" : "text-blue-400"}`}>
                            {t.price_per_month.toLocaleString()}원/월
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className="px-4 pt-3 pb-5 border-t border-gray-100 bg-white shrink-0 rounded-b-3xl">
              <button
                onClick={handleRequest}
                disabled={!selected || submitting}
                className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><RefreshCw size={16} className="animate-spin" /> 처리 중...</>
                ) : "변경 요청하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   단기 → 장기 전환 시트
───────────────────────────────────────────── */
interface PlanOption {
  plan_type: string;
  label_ko: string;
  label_en: string;
  capacity_score: number | null;
  monthly_amount: number | null;
  weekly_rate: number | null;
}

function ConvertToLongTermSheet({
  storage,
  onClose,
  onDone,
}: {
  storage: Storage;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/storage/plans")
      .then((r) => r.json())
      .then((j) => setPlans((j.plans ?? []).filter((p: PlanOption) => p.monthly_amount != null)))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/storage/${storage.id}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type:         "CONVERT_TO_LONG_TERM",
          requested_plan_type:  selected,
          customer_note:        note.trim() || null,
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
      <div className="relative w-full sm:max-w-[520px] bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* 헤더 */}
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">장기보관으로 전환</p>
            <p className="text-xs text-gray-400 mt-0.5">월정액으로 안정적인 장기 보관</p>
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
            <p className="text-sm font-bold text-gray-900">전환 요청이 접수되었습니다</p>
            <p className="text-xs text-gray-500 text-center">
              관리자가 확인 후 장기보관으로 전환해 드립니다.<br />
              처리 완료 시 알림으로 안내해 드립니다.
            </p>
            <button
              onClick={() => { onDone ? onDone() : onClose(); }}
              className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl"
            >
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
              {/* 안내 배너 */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-bold text-blue-800">장기보관 전환 혜택</p>
                <ul className="space-y-0.5">
                  {[
                    "월정액 고정 요금으로 예측 가능한 비용",
                    "전용 로케이션 배정으로 안정적인 보관",
                    "언제든지 추가 슬롯 신청 가능",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-1">
                      <span>•</span><span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 플랜 선택 */}
              <p className="text-xs font-bold text-gray-700">플랜 선택</p>
              {loading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 size={24} className="animate-spin text-gray-300" />
                </div>
              ) : (
                plans.map((p) => {
                  const isSelected = selected === p.plan_type;
                  return (
                    <button
                      key={p.plan_type}
                      onClick={() => setSelected(p.plan_type)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                        isSelected
                          ? "border-brand-500 bg-brand-50"
                          : "border-gray-100 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-black text-sm ${
                        isSelected ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                        {p.plan_type}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isSelected ? "text-brand-700" : "text-gray-800"}`}>
                          {p.label_ko}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {p.capacity_score != null ? `최대 ${p.capacity_score}점` : "무제한"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {p.monthly_amount != null && (
                          <p className={`text-sm font-bold ${isSelected ? "text-brand-600" : "text-gray-700"}`}>
                            {p.monthly_amount.toLocaleString()}원/월
                          </p>
                        )}
                        {p.weekly_rate != null && (
                          <p className="text-xs text-gray-400">
                            ({p.weekly_rate.toLocaleString()}원/주)
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}

              {/* 메모 */}
              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">
                  요청 메모 <span className="font-normal text-gray-400">(선택)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="전환 관련 특이사항이 있으면 입력해 주세요."
                  rows={2}
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 resize-none"
                />
              </div>
            </div>

            <div className="px-4 pt-3 pb-5 border-t border-gray-100 bg-white shrink-0 rounded-b-3xl">
              <button
                onClick={handleSubmit}
                disabled={!selected || submitting}
                className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> 처리 중...</>
                ) : "전환 요청하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   다른 슬롯으로 이동 신청 시트
───────────────────────────────────────────── */
function TransferToSlotSheet({
  storage,
  onClose,
  onDone,
}: {
  storage: Storage;
  onClose: () => void;
  onDone?: () => void;
}) {
  type SlotOption = { id: string; storage_name: string; plan_type: string | null; storage_mode: string };
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch("/api/storage")
      .then(r => r.json())
      .then(d => {
        const others: SlotOption[] = (d.storages ?? []).filter(
          (s: SlotOption & { status: string }) => s.id !== storage.id && s.status !== "CANCELLED"
        );
        setSlots(others);
      })
      .finally(() => setLoading(false));
  }, [storage.id]);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/storage/${storage.id}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type: "TRANSFER_ITEMS",
          target_storage_id: selected,
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
      <div className="relative w-full sm:max-w-[520px] bg-white rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">다른 보관함으로 이동</p>
            <p className="text-xs text-gray-400 mt-0.5">
              현재: {storage.storage_name} · 유료 서비스
            </p>
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
            <p className="text-sm font-bold text-gray-900">이동 요청이 접수되었습니다</p>
            <p className="text-xs text-gray-500 text-center">
              관리자가 확인 후 물품을 이동해 드립니다.<br />
              처리 완료 시 알림으로 안내해 드립니다.
            </p>
            <button onClick={() => { onDone ? onDone() : onClose(); }} className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl">
              확인
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-3">
              <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3 text-xs text-orange-700 space-y-1">
                <p className="font-bold text-orange-800">이동 서비스 안내</p>
                <ul className="space-y-0.5">
                  {[
                    "물품 이동은 유료 서비스입니다 (관리자 확인 후 요금 안내)",
                    "이동 요청 후 관리자가 직접 물품을 재배치합니다",
                    "처리 후 알림으로 완료를 안내해 드립니다",
                  ].map(t => (
                    <li key={t} className="flex items-start gap-1"><span>•</span><span>{t}</span></li>
                  ))}
                </ul>
              </div>

              <p className="text-xs font-bold text-gray-700">이동할 보관함 선택</p>
              {loading ? (
                <div className="py-8 flex justify-center">
                  <Loader2 size={24} className="animate-spin text-gray-300" />
                </div>
              ) : slots.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">
                  이동할 수 있는 다른 보관함이 없습니다.
                </div>
              ) : (
                slots.map(slot => {
                  const isSelected = selected === slot.id;
                  return (
                    <button
                      key={slot.id}
                      onClick={() => setSelected(slot.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
                        isSelected ? "border-brand-500 bg-brand-50" : "border-gray-100 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-500"
                      }`}>
                        <Archive size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold ${isSelected ? "text-brand-700" : "text-gray-800"}`}>
                          {slot.storage_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {slot.storage_mode === "long_term" ? "장기보관" : "단기보관"}
                          {slot.plan_type && ` · ${slot.plan_type}`}
                        </p>
                      </div>
                      {isSelected && <Check size={16} className="text-brand-600 shrink-0" />}
                    </button>
                  );
                })
              )}

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">
                  요청 메모 <span className="font-normal text-gray-400">(선택)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="이동 관련 특이사항을 입력해 주세요."
                  rows={2}
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 resize-none"
                />
              </div>
            </div>

            <div className="px-4 pt-3 pb-5 border-t border-gray-100 bg-white shrink-0 rounded-b-3xl">
              <button
                onClick={handleSubmit}
                disabled={!selected || submitting || slots.length === 0}
                className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> 처리 중...</> : "이동 요청하기"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   블록 합치기 시트
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
  const [targetId, setTargetId] = useState<string | null>(
    storages.length > 0 ? storages[0].id : null
  );
  const [sourceIds, setSourceIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");

  useEffect(() => { setSourceIds(new Set()); }, [targetId]);

  function toggleSource(sid: string) {
    setSourceIds(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  }

  const targetStorage  = storages.find(s => s.id === targetId);
  const sourceStorages = storages.filter(s => s.id !== targetId);
  const selectedSources = storages.filter(s => sourceIds.has(s.id));

  const targetCapacity  = targetStorage?.capacity_score ?? 0;
  const targetUsed      = targetStorage?.used_score ?? 0;
  const targetFree      = targetCapacity - targetUsed;
  const totalSourceUsed = selectedSources.reduce((acc, s) => acc + (s.used_score ?? 0), 0);
  const canMerge        = sourceIds.size > 0 && (targetCapacity === 0 || totalSourceUsed <= targetFree);
  const overBy          = totalSourceUsed - targetFree;

  async function handleSubmit() {
    if (!targetId || !canMerge) return;
    setSubmitting(true);
    setServerError("");
    try {
      const res = await fetch(`/api/storage/${targetId}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request_type:       "MERGE_SLOTS",
          source_storage_ids: Array.from(sourceIds),
          customer_note:      note.trim() || null,
        }),
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

  function SlotRow({ s, isTarget }: { s: Storage; isTarget?: boolean }) {
    const cap  = s.capacity_score ?? 0;
    const used = s.used_score ?? 0;
    const pct  = cap > 0 ? Math.round((used / cap) * 100) : 0;
    return (
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${isTarget ? "text-brand-700" : "text-gray-800"}`}>{s.storage_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {(s.storage_types?.code ?? s.plan_type) && (
              <span className="text-[10px] text-gray-400">{s.storage_types?.code ?? s.plan_type}</span>
            )}
            {cap > 0 && <span className="text-[10px] text-gray-500">{used}L / {cap}L ({pct}%)</span>}
          </div>
          {cap > 0 && (
            <div className="mt-1 h-1 rounded-full bg-gray-100 w-24 overflow-hidden">
              <div className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 70 ? "bg-orange-400" : "bg-brand-400"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full sm:max-w-[520px] bg-white rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="px-4 pt-5 pb-3 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-base font-bold text-gray-900">블록 합치기</p>
            <p className="text-xs text-gray-400 mt-0.5">여러 블록을 하나의 보관함으로 즉시 통합합니다</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {done ? (
          <div className="px-4 py-10 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <Check size={24} className="text-green-600" strokeWidth={2.5} />
            </div>
            <p className="text-sm font-bold text-gray-900">블록이 합쳐졌습니다</p>
            <p className="text-xs text-gray-500 text-center">DB가 즉시 반영되었으며 관리자가 물품을 이전합니다.</p>
            <button onClick={() => { onDone ? onDone() : onClose(); }} className="mt-2 px-8 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-2xl">확인</button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 text-xs text-blue-700 space-y-1">
                <p className="font-bold text-blue-800">합치기 즉시 적용됩니다</p>
                <ul className="space-y-0.5">
                  {["요청 즉시 DB에 반영되고 소스 블록이 종료됩니다", "관리자가 물품을 대표 블록으로 물리적 이전합니다", "대표 블록의 남은 용량(리터) 기준으로 합치기 가능 여부가 검증됩니다"].map(t => (
                    <li key={t} className="flex items-start gap-1"><span>•</span><span>{t}</span></li>
                  ))}
                </ul>
              </div>

              {/* STEP 1 */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">STEP 1. 남길 대표 보관함 선택</p>
                <div className="space-y-2">
                  {storages.map(s => {
                    const isTarget = targetId === s.id;
                    const tc = s.storage_types?.code ?? s.plan_type ?? "DEFAULT";
                    return (
                      <button key={s.id} onClick={() => setTargetId(s.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${isTarget ? "border-brand-500 bg-brand-50" : "border-gray-100 bg-white hover:border-gray-300"}`}
                      >
                        <div className="w-10 h-10 flex items-center justify-center shrink-0">
                          <BrickSVG color={isTarget ? "#6366f1" : "#9ca3af"} typeCode={tc} size={40} />
                        </div>
                        <SlotRow s={s} isTarget={isTarget} />
                        {isTarget && <Check size={15} className="text-brand-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* STEP 2 */}
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">STEP 2. 합칠 블록 선택 <span className="font-normal text-gray-400 ml-1">(선택 시 즉시 종료됨)</span></p>
                {sourceStorages.length === 0 ? (
                  <p className="text-xs text-gray-400 py-2">대표 블록을 먼저 선택해주세요.</p>
                ) : (
                  <div className="space-y-2">
                    {sourceStorages.map(s => {
                      const isSel = sourceIds.has(s.id);
                      const tc = s.storage_types?.code ?? s.plan_type ?? "DEFAULT";
                      return (
                        <button key={s.id} onClick={() => toggleSource(s.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all text-left ${isSel ? "border-orange-400 bg-orange-50" : "border-gray-100 bg-white hover:border-gray-300"}`}
                        >
                          <div className={`w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSel ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                            {isSel && <Check size={13} className="text-white" strokeWidth={3} />}
                          </div>
                          <div className="w-9 h-9 flex items-center justify-center shrink-0">
                            <BrickSVG color={isSel ? "#f97316" : "#9ca3af"} typeCode={tc} size={36} />
                          </div>
                          <SlotRow s={s} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 용량 검증 */}
              {sourceIds.size > 0 && targetCapacity > 0 && (
                <div className={`rounded-2xl px-4 py-3 space-y-1.5 ${canMerge ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"}`}>
                  <p className={`text-xs font-bold ${canMerge ? "text-green-700" : "text-red-700"}`}>{canMerge ? "✓ 합치기 가능" : "✗ 용량 부족"}</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[10px] text-gray-500">대표 용량</p><p className="text-xs font-bold text-gray-800">{targetCapacity}L</p></div>
                    <div><p className="text-[10px] text-gray-500">현재 사용</p><p className="text-xs font-bold text-gray-800">{targetUsed}L</p></div>
                    <div><p className="text-[10px] text-gray-500">이전 물품</p><p className={`text-xs font-bold ${canMerge ? "text-green-700" : "text-red-600"}`}>{totalSourceUsed}L</p></div>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden mt-1">
                    <div className={`h-full rounded-full transition-all ${canMerge ? "bg-green-500" : "bg-red-500"}`} style={{ width: `${Math.min(((targetUsed + totalSourceUsed) / targetCapacity) * 100, 100)}%` }} />
                  </div>
                  {!canMerge && <p className="text-[10px] text-red-600 font-semibold">{overBy}L 초과 — 더 큰 대표 블록을 선택하거나 일부 블록만 선택하세요</p>}
                </div>
              )}

              {serverError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-xl">{serverError}</p>}

              <div>
                <label className="text-xs font-bold text-gray-700 mb-1 block">요청 메모 <span className="font-normal text-gray-400">(선택)</span></label>
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="특이사항을 입력해 주세요." rows={2} maxLength={200}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-brand-400 resize-none" />
              </div>
            </div>

            <div className="px-4 pt-3 pb-5 border-t border-gray-100 bg-white shrink-0 rounded-b-3xl">
              <button onClick={handleSubmit} disabled={!targetId || !canMerge || submitting}
                className="w-full bg-brand-600 text-white text-sm font-bold py-4 rounded-2xl disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {submitting ? <><Loader2 size={16} className="animate-spin" /> 처리 중...</> : `지금 합치기 (${1 + sourceIds.size}개 → 1개)`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
