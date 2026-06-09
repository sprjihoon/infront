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
  storage_plan_config: PlanConfig | null;
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
  CREATED:          { label: "수거 대기",  color: "bg-yellow-100 text-yellow-700" },
  PICKUP_REQUESTED: { label: "수거 신청",  color: "bg-blue-100 text-blue-700" },
  IN_TRANSIT:       { label: "이동 중",   color: "bg-purple-100 text-purple-700" },
  INBOUND:          { label: "검수 대기",  color: "bg-yellow-100 text-yellow-700" },
  INSPECTING:       { label: "검수 대기",  color: "bg-yellow-100 text-yellow-700" },
  INSPECTION:       { label: "검수 대기",  color: "bg-yellow-100 text-yellow-700" },
  HOLD:             { label: "보류",      color: "bg-orange-100 text-orange-700" },
  SHIPPABLE:        { label: "출고 가능",  color: "bg-green-100 text-green-700" },
  READY:            { label: "출고 가능",  color: "bg-green-100 text-green-700" },
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
  const [showReleaseSheet, setShowReleaseSheet] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/storage/${id}`);
      if (res.status === 401) { router.push("/login"); return; }
      if (res.status === 404) { router.push("/storage"); return; }
      const json = await res.json();
      setStorage(json.storage);
      setParcels(json.parcels ?? []);
      setNameInput(json.storage?.storage_name ?? "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

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
  // 상세 페이지에서는 출고 가능 물품만 표시
  const shippableParcels = parcels.filter(
    (p) => p.status === "SHIPPABLE" || p.status === "READY" || p.is_shippable === true
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
        {/* 상태 카드 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${sCfg.color}`}>
              <SIcon size={12} />
              {sCfg.label}
            </span>
            <span className="text-xs text-gray-400">
              신청일 {new Date(storage.created_at).toLocaleDateString("ko-KR")}
            </span>
          </div>

          {/* 단기보관 무료기간 표시 */}
          {freeInfo && (
            <div className={`mb-3 px-3 py-2.5 rounded-xl flex items-start gap-2 ${
              freeInfo.inFreePeriod
                ? "bg-green-50 border border-green-100"
                : "bg-gray-50 border border-gray-100"
            }`}>
              <Clock size={14} className={`${freeInfo.inFreePeriod ? "text-green-500" : "text-gray-400"} mt-0.5 shrink-0`} />
              <div>
                {freeInfo.inFreePeriod ? (
                  <>
                    <p className="text-xs font-bold text-green-700">
                      무료 기간 <span className="text-green-800">{freeInfo.freeDaysLeft}일</span> 남음
                    </p>
                    <p className="text-[11px] text-green-600 mt-0.5">
                      {freeInfo.billingStartDate}부터 주 단위 보관료가 발생합니다 (3일 무료)
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-gray-700">
                      {freeInfo.billableWeeks}주차 과금 중
                      {storage.storage_plan_config?.weekly_rate != null && (
                        <span className="ml-1.5 text-brand-600">
                          {(storage.storage_plan_config.weekly_rate * freeInfo.billableWeeks).toLocaleString()}원 누적
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      무료 기간({FREE_DAYS}일) 종료 후 {freeInfo.daysElapsed - FREE_DAYS}일 경과
                      {storage.storage_plan_config?.weekly_rate != null && (
                        <> · 주당 {storage.storage_plan_config.weekly_rate.toLocaleString()}원</>
                      )}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 용량 */}
          {storage.capacity_score != null ? (
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-1.5">
                <span>보관 용량</span>
                <span className="font-semibold">
                  {storage.used_score} / {storage.capacity_score} 개
                  <span className="text-gray-400 ml-1">
                    ({Math.round(storage.usage_percent ?? 0)}%)
                  </span>
                </span>
              </div>
              <CapacityBar percent={storage.usage_percent ?? 0} />
              {(storage.usage_percent ?? 0) >= 90 && (
                <p className="text-xs text-red-600 mt-1.5 font-medium">
                  보관 공간이 거의 가득 찼습니다. 출고 또는 플랜 업그레이드를 고려해 주세요.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 rounded-xl p-3 text-xs text-yellow-700">
              플랜을 선택하면 용량을 관리할 수 있습니다.
            </div>
          )}

          {/* 요금 정보 */}
          <div className="mt-3 pt-3 border-t border-gray-50 grid grid-cols-2 gap-3">
            {storage.storage_mode === "short_term" ? (
              <>
                <InfoCell label="보관 기간" value={`${weeksUsed}주 경과`} />
                {storage.storage_plan_config?.weekly_rate != null && (
                  <InfoCell
                    label="주간 요금"
                    value={`${storage.storage_plan_config.weekly_rate.toLocaleString()}원`}
                  />
                )}
                {storage.max_plan_type && (
                  <InfoCell label="최대 사용 플랜" value={storage.max_plan_type + " 플랜"} />
                )}
              </>
            ) : (
              <>
                {storage.paid_until_date && (
                  <InfoCell
                    label="이용 만료일"
                    value={new Date(storage.paid_until_date).toLocaleDateString("ko-KR")}
                  />
                )}
                {storage.next_billing_date && (
                  <InfoCell
                    label="다음 결제일"
                    value={new Date(storage.next_billing_date).toLocaleDateString("ko-KR")}
                  />
                )}
                {storage.monthly_amount != null && (
                  <InfoCell label="월 요금" value={`${storage.monthly_amount.toLocaleString()}원`} />
                )}
              </>
            )}
          </div>
        </div>

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
  const s = PARCEL_STATUS_MAP[parcel.status] ?? { label: parcel.status, color: "bg-gray-100 text-gray-500" };
  const declaredItems = Array.isArray(parcel.pre_invoice_items) && parcel.pre_invoice_items.length > 0
    ? parcel.pre_invoice_items.filter((it) => it.name)
    : null;

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

  const Thumbnail = () => (
    <div className="relative group shrink-0">
      {photoUrl ? (
        <>
          <img
            src={photoUrl}
            alt="입고 사진"
            className="w-9 h-9 rounded-xl object-cover"
          />
          <div className="absolute left-0 bottom-11 z-50 hidden group-hover:block pointer-events-none">
            <img
              src={photoUrl}
              alt="입고 사진 확대"
              className="w-48 h-48 rounded-2xl object-cover shadow-2xl border-2 border-white"
            />
          </div>
        </>
      ) : (
        <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
          <Package size={16} className="text-blue-400" />
        </div>
      )}
    </div>
  );

  if (declaredItems && declaredItems.length > 0) {
    return (
      <>
        {declaredItems.map((item, idx) => (
          <div key={`${parcel.id}-${idx}`} className="px-4 py-3 flex items-center gap-3">
            <Thumbnail />
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
      <Thumbnail />
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
