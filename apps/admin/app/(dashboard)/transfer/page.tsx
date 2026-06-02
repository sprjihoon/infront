"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, ScanLine,
  Package, User, X, RefreshCw, RotateCcw, MoveRight,
  MapPin, Layers, Tag,
} from "lucide-react";

/* ── 타입 ─────────────────────────────────────────── */
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

// 스캔 결과 — item: 내품 단위 이동 / parcel: 소포 전체 이동
type ScanResult =
  | { type: "item"; item: ItemInfo; parcel: ParcelInfo; siblings: ItemInfo[] }
  | { type: "parcel"; parcel: ParcelInfo; items: ItemInfo[] }
  | { type: "location"; location: LocationInfo; items: unknown[] };

const TYPE_BADGE: Record<string, string> = {
  MINI:     "bg-slate-100 text-slate-600",
  STANDARD: "bg-indigo-100 text-indigo-700",
  LONG:     "bg-purple-100 text-purple-700",
  XL:       "bg-orange-100 text-orange-700",
  OVERSIZE: "bg-red-100 text-red-700",
};

async function scanLookup(q: string): Promise<ScanResult | { type: "not_found" }> {
  const res = await fetch(`/api/admin/transfer/scan?q=${encodeURIComponent(q)}`);
  if (res.status === 404) return { type: "not_found" };
  if (!res.ok) throw new Error("서버 오류");
  return res.json();
}

/* ── 메인 컴포넌트 ────────────────────────────────── */
export default function TransferPage() {
  // step: "source" → "dest" → "done"
  const [step, setStep] = useState<"source" | "dest" | "done">("source");

  const [sourceInput, setSourceInput] = useState("");
  const [destInput,   setDestInput]   = useState("");
  const [scanning,    setScanning]    = useState(false);
  const [moving,      setMoving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  // 이동 대상 — item 단위 또는 parcel 단위
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

  /* ── 소포/내품 스캔 ────────────────────────────── */
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

  /* ── 목적지 스캔 → 즉시 이동 ──────────────────── */
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

  /* ── 이동 실행 ─────────────────────────────────── */
  async function executeMove(
    target: typeof moveTarget & object,
    dest: LocationInfo,
  ) {
    setMoving(true);
    setError(null);
    try {
      if (target.mode === "item") {
        // 내품 단위 이동
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
        // 소포 전체 이동
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

  /* ── 초기화 ─────────────────────────────────────── */
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

  /* ─────────────────────────────────────────────── */
  return (
    <div className="max-w-md mx-auto">

      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/storage" className="text-gray-400 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MoveRight size={20} className="text-indigo-600" />
            로케이션 이동처리
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {step === "source" && "① 소포 또는 내품 바코드 스캔"}
            {step === "dest"   && "② 이동할 로케이션 스캔"}
            {step === "done"   && "이동 완료"}
          </p>
        </div>
      </div>

      {/* 오류 */}
      {error && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError(null)}><X size={14} /></button>
        </div>
      )}

      {/* ══ STEP 1: 소포/내품 스캔 ══════════════════════ */}
      {step === "source" && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              소포 or 내품 바코드 스캔
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

      {/* ══ STEP 2: 확인 + 목적지 스캔 ════════════════ */}
      {step === "dest" && moveTarget && (
        <div className="space-y-3">

          {/* 이동 대상 카드 */}
          <div className="bg-white rounded-2xl shadow-sm p-4">

            {/* 모드 배지 */}
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

            {/* 이동 대상 정보 */}
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

                {/* 같은 소포의 다른 내품들 */}
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

            {/* 현재위치 → 목적지 */}
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
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">이동할 로케이션 코드</p>
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

      {/* ══ STEP 3: 완료 ══════════════════════════════ */}
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
  );
}
