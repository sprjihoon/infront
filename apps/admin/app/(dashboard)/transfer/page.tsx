"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, ScanLine,
  Package, User, X, RefreshCw, RotateCcw, MoveRight,
  MapPin, Layers, Tag, ClipboardList, ChevronDown, ChevronUp,
  Boxes, ArrowRightLeft, BadgePlus, Combine, ArrowUpCircle,
} from "lucide-react";

/* ── 스캐너 타입 ──────────────────────────────────────── */
type ParcelInfo = {
  id: string;
  tracking_no: string | null;
  status: string;
  parcel_size_code: string | null;
  item_count: number;
  display_name: string;
  storage_location_id: string | null;
  location: { id: string; code: string; zone: string; slot: string } | null;
  customer: { id: string; name: string | null; customer_code: string } | null;
};

type ItemInfo = {
  barcode_id: string;
  barcode_no: string;
  seq: number;
  item_name: string | null;
  location: { id: string; code: string } | null;
};

type LocationInfo = {
  id: string;
  code: string;
  zone: string;
  slot: string;
  status: string;
  storage_type: { code: string; name: string; volume_liter: number | null } | null;
  customer: { id: string; name: string | null; customer_code: string } | null;
};

type ScanResult =
  | { type: "item"; item: ItemInfo; parcel: ParcelInfo; siblings: ItemInfo[] }
  | { type: "parcel"; parcel: ParcelInfo; items: ItemInfo[] }
  | { type: "location"; location: LocationInfo; items: unknown[] };

/* ── 작업지시서 타입 ───────────────────────────────────── */
type WorkOrder = {
  id: string;
  request_type: string;
  status: string;
  customer_note: string | null;
  admin_note: string | null;
  requested_type_code: string | null;
  requested_plan_type: string | null;
  source_storage_ids: string[] | null;
  target_storage_id: string | null;
  created_at: string;
  customers: { name: string | null; customer_code: string } | null;
  customer_storages: { id: string; storage_name: string; plan_type: string | null } | null;
  storage_types: { code: string; name: string; volume_liter: number | null } | null;
};

/* ── 작업 타입 설정 ────────────────────────────────────── */
const ORDER_CFG: Record<string, {
  label: string;
  icon: React.ReactNode;
  borderColor: string;
  badgeCls: string;
  actionDesc: string;
}> = {
  CAPACITY_CHANGE: {
    label: "용량 변경",
    icon: <ArrowUpCircle size={14} />,
    borderColor: "border-indigo-300",
    badgeCls: "bg-indigo-100 text-indigo-700",
    actionDesc: "더 큰 로케이션으로 물품 전체 이동",
  },
  ADD_SLOT: {
    label: "슬롯 추가",
    icon: <BadgePlus size={14} />,
    borderColor: "border-emerald-300",
    badgeCls: "bg-emerald-100 text-emerald-700",
    actionDesc: "새 로케이션 배정 및 라벨 부착",
  },
  MERGE_SLOTS: {
    label: "슬롯 합치기",
    icon: <Combine size={14} />,
    borderColor: "border-purple-300",
    badgeCls: "bg-purple-100 text-purple-700",
    actionDesc: "소스 슬롯 물품을 대표 슬롯으로 물리 이동",
  },
  TRANSFER_ITEMS: {
    label: "물품 이동",
    icon: <ArrowRightLeft size={14} />,
    borderColor: "border-amber-300",
    badgeCls: "bg-amber-100 text-amber-700",
    actionDesc: "물품을 대상 슬롯으로 이동",
  },
  CONVERT_TO_LONG_TERM: {
    label: "장기 전환",
    icon: <Boxes size={14} />,
    borderColor: "border-teal-300",
    badgeCls: "bg-teal-100 text-teal-700",
    actionDesc: "장기 보관 로케이션 배정",
  },
};

const AUTO_APPLY_TYPES = ["CAPACITY_CHANGE", "MERGE_SLOTS"];

const TYPE_BADGE: Record<string, string> = {
  MINI:     "bg-slate-100 text-slate-600",
  STANDARD: "bg-indigo-100 text-indigo-700",
  LONG:     "bg-purple-100 text-purple-700",
  XL:       "bg-orange-100 text-orange-700",
  OVERSIZE: "bg-red-100 text-red-700",
};

function fmtTime(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mn = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd} ${hh}:${mn}`;
}

async function scanLookup(q: string): Promise<ScanResult | { type: "not_found" }> {
  const res = await fetch(`/api/admin/transfer/scan?q=${encodeURIComponent(q)}`);
  if (res.status === 404) return { type: "not_found" };
  if (!res.ok) throw new Error("서버 오류");
  return res.json();
}

/* ── 작업지시서 패널 ───────────────────────────────────── */
function WorkOrderPanel() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/storage/change-requests?status=PENDING");
      const json = await res.json();
      setOrders(json.requests ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  async function handleComplete(id: string) {
    setCompletingId(id);
    try {
      await fetch("/api/admin/storage/change-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "APPROVED" }),
      });
      await fetch_();
    } finally {
      setCompletingId(null);
    }
  }

  const cfg = (type: string) => ORDER_CFG[type] ?? {
    label: type, icon: <ClipboardList size={14} />,
    borderColor: "border-gray-300", badgeCls: "bg-gray-100 text-gray-600",
    actionDesc: "작업 처리 필요",
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b border-gray-100 cursor-pointer select-none"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-indigo-600" />
          <h2 className="font-bold text-gray-900 text-base">작업지시서</h2>
          {orders.length > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
              {orders.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); fetch_(); }}
            className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
            title="새로고침"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          {collapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
        </div>
      </div>

      {!collapsed && (
        <div className="divide-y divide-gray-50 max-h-[calc(100vh-200px)] overflow-y-auto">
          {loading && orders.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-gray-300" />
              불러오는 중...
            </div>
          )}

          {!loading && orders.length === 0 && (
            <div className="px-5 py-10 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
              <p className="text-sm text-gray-400">대기 중인 작업지시가 없습니다</p>
            </div>
          )}

          {orders.map((order, idx) => {
            const c = cfg(order.request_type);
            const isAutoApply = AUTO_APPLY_TYPES.includes(order.request_type);
            const isDone = completingId === order.id;

            return (
              <div
                key={order.id}
                className={`px-5 py-4 border-l-4 ${c.borderColor} hover:bg-gray-50/60 transition-colors`}
              >
                {/* 상단 행: 번호 + 타입 배지 + 시간 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold text-gray-300">#{idx + 1}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${c.badgeCls}`}>
                    {c.icon}
                    {c.label}
                  </span>
                  {isAutoApply && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200">
                      DB자동적용
                    </span>
                  )}
                  <span className="ml-auto text-[10px] text-gray-400 shrink-0">
                    {fmtTime(order.created_at)}
                  </span>
                </div>

                {/* 고객 + 슬롯 */}
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {order.customers?.name ?? "—"}
                      <span className="ml-1.5 text-xs font-normal text-gray-400">
                        {order.customers?.customer_code}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      슬롯: <span className="font-mono font-semibold text-gray-700">
                        {order.customer_storages?.storage_name ?? "—"}
                      </span>
                      {order.customer_storages?.plan_type && (
                        <span className="ml-1 text-gray-400">({order.customer_storages.plan_type})</span>
                      )}
                    </p>
                  </div>
                  {order.storage_types?.code && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${TYPE_BADGE[order.storage_types.code] ?? "bg-gray-100 text-gray-600"}`}>
                      → {order.storage_types.code}
                      {order.storage_types.volume_liter != null && (
                        <span className="ml-0.5 opacity-70">{order.storage_types.volume_liter}L</span>
                      )}
                    </span>
                  )}
                </div>

                {/* 작업 설명 */}
                <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
                  <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                    <span>📌</span>
                    {c.actionDesc}
                    {order.request_type === "MERGE_SLOTS" && order.source_storage_ids && (
                      <span className="ml-1 text-purple-600">
                        ({order.source_storage_ids.length}개 슬롯)
                      </span>
                    )}
                  </p>
                </div>

                {/* 고객 메모 */}
                {order.customer_note && (
                  <p className="text-xs text-gray-500 mb-3 italic line-clamp-2">
                    💬 {order.customer_note}
                  </p>
                )}

                {/* 완료 버튼 */}
                <button
                  onClick={() => handleComplete(order.id)}
                  disabled={isDone}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-colors"
                >
                  {isDone
                    ? <><RefreshCw size={12} className="animate-spin" /> 처리 중...</>
                    : <><CheckCircle2 size={12} /> 작업완료</>
                  }
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── 메인 컴포넌트 ────────────────────────────────────── */
export default function TransferPage() {
  const [step, setStep] = useState<"source" | "dest" | "done">("source");

  const [sourceInput, setSourceInput] = useState("");
  const [destInput,   setDestInput]   = useState("");
  const [scanning,    setScanning]    = useState(false);
  const [moving,      setMoving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const [moveTarget, setMoveTarget] = useState<
    | { mode: "item"; item: ItemInfo; parcel: ParcelInfo; siblings: ItemInfo[] }
    | { mode: "parcel"; parcel: ParcelInfo; items: ItemInfo[] }
    | null
  >(null);

  const [destLoc, setDestLoc] = useState<LocationInfo | null>(null);
  const [doneInfo, setDoneInfo] = useState<{
    from: string; to: string; label: string; mode: "item" | "parcel";
  } | null>(null);

  const sourceRef = useRef<HTMLInputElement>(null);
  const destRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "source") setTimeout(() => sourceRef.current?.focus(), 50);
    if (step === "dest")   setTimeout(() => destRef.current?.focus(), 50);
  }, [step]);

  async function handleSourceScan(e: React.FormEvent) {
    e.preventDefault();
    const q = sourceInput.trim();
    if (!q || scanning) return;
    setScanning(true);
    setError(null);
    try {
      const result = await scanLookup(q);
      if (result.type === "not_found") {
        setError(`"${q}" 을(를) 찾을 수 없습니다`);
        setSourceInput("");
        return;
      }
      if (result.type === "item") {
        setMoveTarget({ mode: "item", item: result.item, parcel: result.parcel, siblings: result.siblings });
        setSourceInput("");
        setStep("dest");
      } else if (result.type === "parcel") {
        setMoveTarget({ mode: "parcel", parcel: result.parcel, items: result.items });
        setSourceInput("");
        setStep("dest");
      } else {
        setError("소포 바코드 또는 운송장번호를 스캔하세요 (로케이션 코드 입력 불가)");
        setSourceInput("");
      }
    } catch {
      setError("조회 중 오류가 발생했습니다");
    } finally {
      setScanning(false);
    }
  }

  async function handleDestScan(e: React.FormEvent) {
    e.preventDefault();
    const q = destInput.trim();
    if (!q || scanning || moving || !moveTarget) return;
    setScanning(true);
    setError(null);
    try {
      const result = await scanLookup(q);
      if (result.type !== "location") {
        setError("유효한 로케이션 코드를 스캔하세요 (예: A-001)");
        setDestInput("");
        return;
      }
      setDestLoc(result.location);
      setDestInput("");
      setScanning(false);
      await executeMove(moveTarget, result.location);
    } catch {
      setError("조회 중 오류가 발생했습니다");
      setScanning(false);
    }
  }

  async function executeMove(
    target: typeof moveTarget & object,
    dest: LocationInfo,
  ) {
    setMoving(true);
    setError(null);
    try {
      if (target.mode === "item") {
        const fromCode = target.item.location?.code ?? "미배정";
        if (target.item.location?.id === dest.id) {
          setError("현재 위치와 동일한 로케이션입니다"); return;
        }
        const res = await fetch(`/api/admin/barcodes/${target.item.barcode_id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_location_id: dest.id, reason: "TRANSFER" }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "이동 실패"); return; }
        setDoneInfo({
          from: fromCode,
          to: dest.code,
          label: `${target.item.barcode_no} · ${target.item.item_name ?? "품목"}`,
          mode: "item",
        });
      } else {
        const fromCode = target.parcel.location?.code ?? "미배정";
        if (target.parcel.storage_location_id === dest.id) {
          setError("현재 위치와 동일한 로케이션입니다"); return;
        }
        const res = await fetch(`/api/admin/parcels/${target.parcel.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_location_id: dest.id, reason: "TRANSFER" }),
        });
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? "이동 실패"); return; }
        setDoneInfo({
          from: fromCode,
          to: dest.code,
          label: target.parcel.display_name,
          mode: "parcel",
        });
      }
      setStep("done");
    } finally {
      setMoving(false);
    }
  }

  function reset() {
    setMoveTarget(null);
    setDestLoc(null);
    setSourceInput("");
    setDestInput("");
    setError(null);
    setDoneInfo(null);
    setStep("source");
  }

  function resetKeepDest() {
    setMoveTarget(null);
    setSourceInput("");
    setError(null);
    setDoneInfo(null);
    setStep("source");
  }

  const currentLocCode =
    moveTarget?.mode === "item"
      ? moveTarget.item.location?.code ?? "미배정"
      : moveTarget?.mode === "parcel"
      ? moveTarget.parcel.location?.code ?? "미배정"
      : "미배정";

  return (
    <div className="max-w-5xl mx-auto">

      {/* 페이지 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/storage" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MoveRight size={20} className="text-indigo-600" />
            로케이션 이동처리
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">작업지시서 확인 후 바코드 스캔으로 이동 처리</p>
        </div>
      </div>

      {/* 2열 레이아웃 */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-6 items-start">

        {/* ── 좌측: 작업지시서 패널 ── */}
        <WorkOrderPanel />

        {/* ── 우측: 바코드 스캐너 ── */}
        <div className="space-y-0">

          {/* 스캐너 단계 표시 */}
          <div className="mb-4 flex items-center gap-2">
            {["source", "dest", "done"].map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                {i > 0 && <div className={`h-px w-6 ${step === "source" && i > 0 ? "bg-gray-200" : "bg-indigo-300"}`} />}
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === s ? "bg-indigo-600 text-white" :
                  (step === "done" || (step === "dest" && i === 0)) ? "bg-indigo-200 text-indigo-700" :
                  "bg-gray-100 text-gray-400"
                }`}>{i + 1}</div>
                <span className={`text-xs ${step === s ? "text-indigo-700 font-semibold" : "text-gray-400"}`}>
                  {s === "source" ? "소포스캔" : s === "dest" ? "목적지" : "완료"}
                </span>
              </div>
            ))}
          </div>

          {/* 오류 */}
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
              <button onClick={() => setError(null)}><X size={14} /></button>
            </div>
          )}

          {/* STEP 1: 소포/내품 스캔 */}
          {step === "source" && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  ① 소포 or 내품 바코드 스캔
                </p>
                <form onSubmit={handleSourceScan} className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      ref={sourceRef}
                      type="text"
                      value={sourceInput}
                      onChange={(e) => setSourceInput(e.target.value)}
                      placeholder="스캔 또는 직접 입력"
                      className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                      autoComplete="off"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={scanning || !sourceInput.trim()}
                    className="px-4 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {scanning ? <RefreshCw size={14} className="animate-spin" /> : <ScanLine size={14} />}
                  </button>
                </form>
              </div>
              <div className="px-5 py-3 text-xs text-gray-400 space-y-0.5">
                <p><Tag size={11} className="inline mr-1" />내품 바코드 (573...-01) → 내품 1개만 이동</p>
                <p><Package size={11} className="inline mr-1" />운송장번호 → 소포 전체 이동</p>
              </div>
            </div>
          )}

          {/* STEP 2: 확인 + 목적지 스캔 */}
          {step === "dest" && moveTarget && (
            <div className="space-y-3">
              {/* 이동 대상 카드 */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <div className="flex items-center gap-2 mb-3">
                  {moveTarget.mode === "item" ? (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                      <Tag size={10} /> 내품 단위 이동
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1">
                      <Layers size={10} /> 소포 전체 이동
                    </span>
                  )}
                  <button onClick={reset} className="ml-auto text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5">
                    <RotateCcw size={11} /> 다시
                  </button>
                </div>

                {moveTarget.mode === "item" ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                        <Tag size={15} className="text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{moveTarget.item.item_name ?? "품목명 없음"}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{moveTarget.item.barcode_no}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                          <User size={11} />
                          {moveTarget.parcel.customer?.name} · {moveTarget.parcel.customer?.customer_code}
                        </p>
                      </div>
                      {moveTarget.parcel.parcel_size_code && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${TYPE_BADGE[moveTarget.parcel.parcel_size_code] ?? "bg-gray-100 text-gray-600"}`}>
                          {moveTarget.parcel.parcel_size_code}
                        </span>
                      )}
                    </div>
                    {moveTarget.siblings.length > 1 && (
                      <div className="mt-2 bg-gray-50 rounded-xl px-3 py-2">
                        <p className="text-[10px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wide">같은 소포의 내품</p>
                        <div className="space-y-1">
                          {moveTarget.siblings.map((s) => (
                            <div key={s.barcode_id} className={`flex items-center gap-2 text-xs ${s.barcode_id === moveTarget.item.barcode_id ? "text-amber-700 font-semibold" : "text-gray-500"}`}>
                              <span className="font-mono w-32 truncate">{s.barcode_no}</span>
                              <span className="flex-1 truncate">{s.item_name ?? "—"}</span>
                              <span className="font-mono text-[10px] text-gray-400">{s.location?.code ?? "미배정"}</span>
                              {s.barcode_id === moveTarget.item.barcode_id && (
                                <span className="text-[9px] bg-amber-200 text-amber-800 px-1 rounded">이동</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                      <Package size={15} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{moveTarget.parcel.display_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">내품 {moveTarget.items.length}개 전체 이동</p>
                      <p className="text-xs text-gray-400 font-mono">{moveTarget.parcel.tracking_no}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <User size={11} />
                        {moveTarget.parcel.customer?.name} · {moveTarget.parcel.customer?.customer_code}
                      </p>
                    </div>
                    {moveTarget.parcel.parcel_size_code && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded shrink-0 ${TYPE_BADGE[moveTarget.parcel.parcel_size_code] ?? "bg-gray-100 text-gray-600"}`}>
                        {moveTarget.parcel.parcel_size_code}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <MapPin size={13} className="text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-500">현재</span>
                  <span className="font-mono font-bold text-sm text-gray-700">{currentLocCode}</span>
                  <MoveRight size={14} className="text-indigo-400 mx-1" />
                  <span className={`font-mono font-bold text-sm ${destLoc ? "text-indigo-700" : "text-gray-300"}`}>
                    {destLoc?.code ?? "?"}
                  </span>
                </div>
              </div>

              {/* 목적지 스캔 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-5 py-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">② 이동할 로케이션 코드</p>
                  <form onSubmit={handleDestScan} className="flex gap-2">
                    <div className="relative flex-1">
                      <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500" />
                      <input
                        ref={destRef}
                        type="text"
                        value={destInput}
                        onChange={(e) => setDestInput(e.target.value)}
                        placeholder="예: B-023"
                        className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 font-mono"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={scanning || moving || !destInput.trim()}
                      className="px-4 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {(scanning || moving) ? <RefreshCw size={14} className="animate-spin" /> : <MoveRight size={14} />}
                    </button>
                  </form>
                  <p className="text-xs text-gray-400 mt-2 text-center">스캔 즉시 이동 처리됩니다</p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: 완료 */}
          {step === "done" && doneInfo && (
            <div className="space-y-3">
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {doneInfo.mode === "item" ? (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">내품 이동 완료</span>
                    ) : (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">소포 이동 완료</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate px-4">{doneInfo.label}</p>
                </div>
                <div className="flex items-center justify-center gap-3 bg-gray-50 rounded-xl py-4 px-6">
                  <span className="font-mono font-bold text-gray-500 text-xl">{doneInfo.from}</span>
                  <MoveRight size={22} className="text-indigo-500 shrink-0" />
                  <span className="font-mono font-bold text-indigo-700 text-xl">{doneInfo.to}</span>
                </div>
              </div>

              <button
                onClick={reset}
                className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
              >
                <ScanLine size={18} />
                다음 스캔
              </button>
              <button
                onClick={resetKeepDest}
                className="w-full py-3 border border-gray-200 text-gray-500 font-medium rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <RotateCcw size={15} />
                같은 로케이션으로 다음 스캔
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
