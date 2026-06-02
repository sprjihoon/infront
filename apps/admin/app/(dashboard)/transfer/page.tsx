"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, AlertTriangle, ScanLine,
  Package, User, X, RefreshCw, RotateCcw, MoveRight, MapPin,
} from "lucide-react";

type ParcelInfo = {
  id: string;
  tracking_no: string | null;
  status: string;
  parcel_size_code: string | null;
  display_name: string;
  item_count: number;
  storage_location_id: string | null;
  location: { id: string; code: string; zone: string; slot: string } | null;
  customer: { id: string; name: string | null; customer_code: string } | null;
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

const TYPE_BADGE: Record<string, string> = {
  MINI:     "bg-slate-100 text-slate-600",
  STANDARD: "bg-indigo-100 text-indigo-700",
  LONG:     "bg-purple-100 text-purple-700",
  XL:       "bg-orange-100 text-orange-700",
  OVERSIZE: "bg-red-100 text-red-700",
};

async function scanLookup(q: string) {
  const res = await fetch(`/api/admin/transfer/scan?q=${encodeURIComponent(q)}`);
  if (res.status === 404) return { type: "not_found" as const };
  if (!res.ok) throw new Error("서버 오류");
  return res.json();
}

export default function TransferPage() {
  // step: "parcel" → "dest" → "done"
  const [step, setStep] = useState<"parcel" | "dest" | "done">("parcel");

  const [parcelInput, setParcelInput] = useState("");
  const [destInput,   setDestInput]   = useState("");
  const [scanning,    setScanning]    = useState(false);
  const [moving,      setMoving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const [parcel,    setParcel]    = useState<ParcelInfo | null>(null);
  const [destLoc,   setDestLoc]   = useState<LocationInfo | null>(null);
  const [doneInfo,  setDoneInfo]  = useState<{ from: string; to: string; name: string } | null>(null);

  const parcelRef = useRef<HTMLInputElement>(null);
  const destRef   = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "parcel") setTimeout(() => parcelRef.current?.focus(), 50);
    if (step === "dest")   setTimeout(() => destRef.current?.focus(), 50);
  }, [step]);

  /* ── 소포 스캔 ─────────────────────────────── */
  async function handleParcelScan(e: React.FormEvent) {
    e.preventDefault();
    const q = parcelInput.trim();
    if (!q || scanning) return;
    setScanning(true);
    setError(null);
    try {
      const result = await scanLookup(q);
      if (result.type === "not_found") {
        setError(`"${q}" 을(를) 찾을 수 없습니다`);
        setParcelInput("");
        return;
      }
      if (result.type === "parcel") {
        setParcel(result.parcel);
        setParcelInput("");
        setStep("dest");
      } else {
        // 로케이션 코드를 소포 스캔란에 넣은 경우
        setError("소포 바코드 또는 운송장번호를 스캔하세요");
        setParcelInput("");
      }
    } catch {
      setError("조회 중 오류가 발생했습니다");
    } finally {
      setScanning(false);
    }
  }

  /* ── 목적지 스캔 → 즉시 이동 ───────────────── */
  async function handleDestScan(e: React.FormEvent) {
    e.preventDefault();
    const q = destInput.trim();
    if (!q || scanning || moving || !parcel) return;
    setScanning(true);
    setError(null);
    try {
      const result = await scanLookup(q);
      if (result.type !== "location") {
        setError("유효한 로케이션 코드를 스캔하세요 (예: A-001)");
        setDestInput("");
        return;
      }
      if (result.location.id === parcel.storage_location_id) {
        setError("현재 위치와 동일한 로케이션입니다");
        setDestInput("");
        return;
      }
      setDestLoc(result.location);
      setDestInput("");
      setScanning(false);

      // 목적지 확인되면 즉시 이동 실행
      await executeMove(parcel, result.location);
    } catch {
      setError("조회 중 오류가 발생했습니다");
      setScanning(false);
    }
  }

  /* ── 이동 실행 ─────────────────────────────── */
  async function executeMove(p: ParcelInfo, dest: LocationInfo) {
    setMoving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/parcels/${p.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_location_id: dest.id, reason: "TRANSFER" }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "이동 실패"); return; }
      setDoneInfo({ from: p.location?.code ?? "미배정", to: dest.code, name: p.display_name });
      setStep("done");
    } finally {
      setMoving(false);
    }
  }

  /* ── 초기화 ─────────────────────────────────── */
  function reset() {
    setParcel(null);
    setDestLoc(null);
    setParcelInput("");
    setDestInput("");
    setError(null);
    setDoneInfo(null);
    setStep("parcel");
  }

  /* ────────────────────────────────────────────── */
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
            {step === "parcel" && "① 소포 바코드 스캔"}
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

      {/* ══ STEP 1: 소포 스캔 ══════════════════════════════ */}
      {step === "parcel" && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">소포 바코드 / 운송장번호</p>
            <form onSubmit={handleParcelScan} className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  ref={parcelRef}
                  type="text"
                  value={parcelInput}
                  onChange={(e) => setParcelInput(e.target.value)}
                  placeholder="스캔 또는 직접 입력"
                  className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="submit"
                disabled={scanning || !parcelInput.trim()}
                className="px-4 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 flex items-center gap-1.5"
              >
                {scanning ? <RefreshCw size={14} className="animate-spin" /> : <ScanLine size={14} />}
              </button>
            </form>
          </div>
          <div className="px-5 py-3 text-xs text-gray-400 text-center">
            내부 바코드 · 우체국 운송장번호 모두 사용 가능
          </div>
        </div>
      )}

      {/* ══ STEP 2: 소포 확인 + 목적지 스캔 ═══════════════ */}
      {step === "dest" && parcel && (
        <div className="space-y-3">

          {/* 소포 정보 카드 */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                <Package size={18} className="text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{parcel.display_name}</p>
                {parcel.item_count > 1 && <p className="text-xs text-gray-400">외 {parcel.item_count - 1}종</p>}
                <p className="text-xs text-gray-400 font-mono mt-0.5">{parcel.tracking_no}</p>
                {parcel.customer && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <User size={11} />
                    {parcel.customer.name} · {parcel.customer.customer_code}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {parcel.parcel_size_code && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${TYPE_BADGE[parcel.parcel_size_code] ?? "bg-gray-100 text-gray-600"}`}>
                    {parcel.parcel_size_code}
                  </span>
                )}
                <button onClick={reset} className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-0.5 mt-1">
                  <RotateCcw size={11} /> 다시
                </button>
              </div>
            </div>

            {/* 현재 위치 표시 */}
            <div className="mt-3 flex items-center gap-2">
              <MapPin size={13} className="text-gray-400 shrink-0" />
              <span className="text-xs text-gray-500">현재 위치</span>
              <span className="font-mono font-bold text-sm text-gray-700">
                {parcel.location?.code ?? "미배정"}
              </span>
              <MoveRight size={14} className="text-indigo-400 mx-1" />
              <span className={`font-mono font-bold text-sm ${destLoc ? "text-indigo-700" : "text-gray-300"}`}>
                {destLoc?.code ?? "?"}
              </span>
            </div>
          </div>

          {/* 목적지 로케이션 스캔 */}
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
              <p className="text-xs text-gray-400 mt-2 text-center">
                스캔 즉시 이동 처리됩니다
              </p>
            </div>
          </div>

        </div>
      )}

      {/* ══ STEP 3: 완료 ════════════════════════════════════ */}
      {step === "done" && doneInfo && (
        <div className="space-y-3">
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">이동 완료</h2>
              <p className="text-sm text-gray-500 mt-1 truncate px-4">{doneInfo.name}</p>
            </div>
            <div className="flex items-center justify-center gap-3 bg-gray-50 rounded-xl py-4 px-6">
              <span className="font-mono font-bold text-gray-500 text-xl">{doneInfo.from}</span>
              <MoveRight size={22} className="text-indigo-500 shrink-0" />
              <span className="font-mono font-bold text-indigo-700 text-xl">{doneInfo.to}</span>
            </div>
          </div>

          {/* 다음 작업 버튼 */}
          <button
            onClick={reset}
            className="w-full py-4 bg-indigo-600 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors"
          >
            <ScanLine size={18} />
            다음 소포 스캔
          </button>
        </div>
      )}

    </div>
  );
}
