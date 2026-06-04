"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Loader2, MapPin, Package,
  ScanLine, AlertTriangle, RotateCcw, ChevronRight,
  Globe, Truck, PauseCircle, XCircle, Info,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────

type PickingStatus = "WAITING" | "DONE" | "HOLD" | "NOT_FOUND";

interface PickBarcode {
  id: string;
  barcode_no: string;
  seq: number;
  item_name: string | null;
  picking_status: PickingStatus;
  picking_reason: string | null;
  picking_note:   string | null;
  picked_at:      string | null;
  location:       { id: string; code: string } | null;
}

interface PickOrder {
  id: string;
  order_no?:       string;
  status:          string;
  shipping_method?: string;
  recipient_name:  string;
  recipient_country?: string;
  recipient_addr1?: string;
  picking_started_at?: string | null;
  picking_done_at?:    string | null;
  customers: { name?: string; customer_code?: string } | null;
}

interface PickingStats {
  total:     number;
  done:      number;
  hold:      number;
  not_found: number;
  waiting:   number;
}

type ScanFeedback = { type: "ok" | "warn" | "err"; msg: string };

// 바코드 ID 기준으로 로컬 상태 Override
type LocalOverride = Record<string, PickingStatus>;

// ── 상태 표시 설정 ──────────────────────────────────────────────

const STATUS_ICON: Record<PickingStatus, React.ReactNode> = {
  WAITING:   <div className="w-5 h-5 rounded-full border-2 border-gray-300" />,
  DONE:      <CheckCircle2 size={20} className="text-green-600" />,
  HOLD:      <PauseCircle   size={20} className="text-yellow-500" />,
  NOT_FOUND: <XCircle       size={20} className="text-orange-500" />,
};
const STATUS_CARD: Record<PickingStatus, string> = {
  WAITING:   "bg-white border-gray-200",
  DONE:      "bg-green-50 border-green-400",
  HOLD:      "bg-yellow-50 border-yellow-400",
  NOT_FOUND: "bg-orange-50 border-orange-400",
};
const STATUS_LABEL: Record<PickingStatus, string> = {
  WAITING: "대기", DONE: "완료", HOLD: "보류", NOT_FOUND: "없음",
};

// ── 컴포넌트 ──────────────────────────────────────────────────

export default function PickingBoardPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const router = useRouter();

  const isIntl    = !rawId.startsWith("dom-");
  const orderId   = rawId.replace(/^(intl|dom)-/, "");
  const orderType = isIntl ? "intl" : "domestic";

  // ── 데이터 ──
  const [order,    setOrder]   = useState<PickOrder | null>(null);
  const [barcodes, setBarcodes] = useState<PickBarcode[]>([]);
  const [stats,    setStats]   = useState<PickingStats | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState("");

  // 로컬 낙관적 업데이트 (API 응답 대기 없이 UI 즉시 반영)
  const [local, setLocal] = useState<LocalOverride>({});

  // ── 스캔 ──
  const [scanInput, setScanInput] = useState("");
  const [feedback,  setFeedback]  = useState<ScanFeedback | null>(null);
  const [bigAlert,  setBigAlert]  = useState<{ type: "err" | "warn"; lines: string[] } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  // ── 보류/누락 모달 ──
  const [holdModal, setHoldModal] = useState<{
    barcode_id: string;
    barcode_no: string;
    item_name:  string | null;
    action:     "HOLD" | "NOT_FOUND";
  } | null>(null);
  const [holdReason, setHoldReason] = useState("");

  // ── 피킹 완료 처리 중 ──
  const [processing, setProcessing] = useState(false);

  // ── 데이터 로드 ──
  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/picking/${rawId}`);
      const data = await res.json();
      if (!res.ok) { setLoadErr(data.error ?? "로드 실패"); return; }
      setOrder(data.order);
      setBarcodes(data.barcodes ?? []);
      setStats(data.stats ?? null);
      setLocal({}); // 로컬 오버라이드 초기화
    } catch {
      setLoadErr("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── 스캔 포커스 유지 ──
  useEffect(() => {
    scanRef.current?.focus();
  });

  // ── 현재 상태 (로컬 오버라이드 우선) ──
  function getStatus(b: PickBarcode): PickingStatus {
    return local[b.id] ?? b.picking_status;
  }

  // ── 스캔 처리 ──
  const handleScan = useCallback(
    async (barcode: string) => {
      const b = barcode.trim();
      if (!b) return;
      setScanInput("");

      const found = barcodes.find((bc) => bc.barcode_no === b);
      const currentStatus = found ? (local[found.id] ?? found.picking_status) : null;

      if (currentStatus === "DONE") {
        setFeedback({ type: "warn", msg: `이미 피킹됨: ${found?.item_name ?? b}` });
        setBigAlert({ type: "warn", lines: ["이미 피킹 처리된 바코드입니다."] });
        setTimeout(() => setBigAlert(null), 2200);
        // 중복도 API에 기록
        fetch(`/api/admin/picking/${rawId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode_no: b, order_type: orderType, scan_result: "DUPLICATE" }),
        });
        return;
      }

      if (!found) {
        // 오스캔 or 미등록 — API가 판별
        setFeedback({ type: "err", msg: `알 수 없는 바코드: ${b}` });
        const res = await fetch(`/api/admin/picking/${rawId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode_no: b, order_type: orderType }),
        });
        const json = await res.json();

        if (json.scan_result === "WRONG_ORDER") {
          setBigAlert({ type: "err", lines: ["이 주문의 내품이 아닙니다.", "다시 확인해주세요."] });
        } else {
          setBigAlert({ type: "err", lines: ["등록되지 않은 바코드입니다.", "관리자 확인이 필요합니다."] });
        }
        setTimeout(() => setBigAlert(null), 3500);
        return;
      }

      // ── 정상 스캔 ──
      setLocal((prev) => ({ ...prev, [found.id]: "DONE" }));
      setFeedback({ type: "ok", msg: `✓ ${found.item_name ?? b}` });

      // API 비동기 기록 (낙관적 업데이트 이후)
      fetch(`/api/admin/picking/${rawId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode_no: b, order_type: orderType }),
      });
    },
    [barcodes, local, rawId, orderType],
  );

  // ── 보류/누락 수동 처리 ──
  async function confirmHoldAction() {
    if (!holdModal) return;
    const { barcode_id, barcode_no, action } = holdModal;

    setLocal((prev) => ({ ...prev, [barcode_id]: action }));
    setHoldModal(null);
    setHoldReason("");

    await fetch(`/api/admin/picking/${rawId}/scan`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode_id, picking_status: action, reason: holdReason || undefined }),
    });
  }

  // ── 피킹 완료 처리 ──
  async function handlePickingDone() {
    setProcessing(true);
    try {
      // 주문 상태 PICKING으로 먼저 설정 (PAID/PENDING → PICKING)
      const startRes = await fetch(`/api/admin/picking/${rawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!startRes.ok) {
        const { error } = await startRes.json();
        // 이미 PICKING 상태면 계속 진행
        if (!error?.includes("PICKING")) { alert(error); return; }
      }

      // PICKING → PICKING_DONE
      const doneRes = await fetch(`/api/admin/picking/${rawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "done" }),
      });
      if (!doneRes.ok) {
        const { error } = await doneRes.json();
        alert(error);
        return;
      }

      router.push(`/outbound/${rawId}`);
    } finally {
      setProcessing(false);
    }
  }

  // ── 계산 ──
  const effectiveDone = barcodes.filter((b) =>
    (local[b.id] ?? b.picking_status) === "DONE",
  ).length;
  const effectiveHold = barcodes.filter((b) =>
    (local[b.id] ?? b.picking_status) === "HOLD",
  ).length;
  const effectiveNotFound = barcodes.filter((b) =>
    (local[b.id] ?? b.picking_status) === "NOT_FOUND",
  ).length;
  const effectiveWaiting = barcodes.length - effectiveDone - effectiveHold - effectiveNotFound;

  const allResolved = barcodes.length > 0 && effectiveWaiting === 0;
  const progressPct = barcodes.length ? ((barcodes.length - effectiveWaiting) / barcodes.length) * 100 : 0;

  // ── 위치별 그룹핑 ──
  const grouped = barcodes.reduce<Record<string, PickBarcode[]>>((acc, b) => {
    const loc = b.location?.code ?? "위치 없음";
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(b);
    return acc;
  }, {});
  const sortedLocs = Object.keys(grouped).sort();

  // ── 렌더 ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }
  if (loadErr || !order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center">
        <AlertTriangle size={36} className="mx-auto text-red-400 mb-3" />
        <p className="text-red-700">{loadErr || "주문을 찾을 수 없습니다."}</p>
        <Link href="/picking" className="mt-4 inline-block text-indigo-600 hover:underline">← 목록으로</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* ── 상단 헤더 ── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/picking" className="p-2 rounded-xl bg-gray-100 text-gray-600 active:bg-gray-200">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {isIntl
                ? <Globe size={13} className="text-indigo-500 shrink-0" />
                : <Truck size={13} className="text-emerald-500 shrink-0" />
              }
              <p className="font-bold text-gray-900 text-sm truncate">
                {isIntl ? order.order_no : "국내배송"}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {order.customers?.name} · {order.recipient_name}
              {isIntl ? ` → ${order.recipient_country}` : ""}
            </p>
          </div>
          {/* 진행 뱃지 */}
          <div className={`shrink-0 text-sm font-bold px-3 py-1.5 rounded-full tabular-nums ${
            allResolved ? "bg-green-600 text-white" : "bg-indigo-100 text-indigo-700"
          }`}>
            {effectiveDone}/{barcodes.length}
          </div>
        </div>

        {/* 진행바 */}
        <div className="mt-2.5 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${allResolved ? "bg-green-500" : "bg-indigo-500"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* 통계 칩 */}
        <div className="mt-2 flex gap-2 text-[11px] font-semibold">
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full">완료 {effectiveDone}</span>
          {effectiveHold > 0 && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">보류 {effectiveHold}</span>
          )}
          {effectiveNotFound > 0 && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">없음 {effectiveNotFound}</span>
          )}
          {effectiveWaiting > 0 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">대기 {effectiveWaiting}</span>
          )}
        </div>
      </div>

      {/* ── 스캔 입력 (sticky) ── */}
      <div className="bg-indigo-600 px-4 py-3 sticky top-[105px] z-10">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" />
            <input
              ref={scanRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleScan(scanInput); }}
              onBlur={() => setTimeout(() => scanRef.current?.focus(), 80)}
              placeholder="바코드 스캔 대기 중..."
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-white text-gray-900 font-mono text-sm focus:outline-none"
              autoComplete="off"
            />
          </div>
          <button
            onClick={() => handleScan(scanInput)}
            disabled={!scanInput.trim()}
            className="bg-white text-indigo-600 font-bold px-4 rounded-xl disabled:opacity-40 active:bg-gray-100 text-sm"
          >
            입력
          </button>
        </div>
        {feedback && (
          <div className={`mt-2 text-sm font-medium px-3 py-1.5 rounded-lg ${
            feedback.type === "ok"  ? "bg-green-100 text-green-800"
            : feedback.type === "warn" ? "bg-yellow-100 text-yellow-800"
            : "bg-red-100 text-red-800"
          }`}>
            {feedback.msg}
          </div>
        )}
      </div>

      {/* ── 피킹 루트 + 바둑판 ── */}
      <div className="flex-1 p-4 space-y-4 pb-28">
        {sortedLocs.map((loc, locIdx) => {
          const locBarcodes = grouped[loc];
          const locDone     = locBarcodes.filter((b) => getStatus(b) === "DONE").length;
          const locAllDone  = locDone === locBarcodes.length;

          return (
            <div key={loc} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 위치 헤더 */}
              <div className={`flex items-center gap-3 px-4 py-3 ${locAllDone ? "bg-green-600" : "bg-indigo-600"}`}>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-black text-base">
                  {locIdx + 1}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <MapPin size={14} className="text-white/70" />
                  <span className="font-black text-white font-mono text-xl tracking-widest">{loc}</span>
                </div>
                <span className="text-white/90 text-sm font-bold tabular-nums">
                  {locDone}/{locBarcodes.length}
                </span>
                {locAllDone && <CheckCircle2 size={22} className="text-white" />}
              </div>

              {/* 아이템 카드 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3">
                {locBarcodes.map((bc) => {
                  const status = getStatus(bc);
                  return (
                    <div
                      key={bc.id}
                      className={`relative flex flex-col items-start p-3 rounded-xl border-2 transition-all ${STATUS_CARD[status]}`}
                    >
                      {/* 상태 아이콘 */}
                      <div className="absolute top-2.5 right-2.5">
                        {STATUS_ICON[status]}
                      </div>

                      <Package size={15} className={`mb-2 ${status === "DONE" ? "text-green-500" : "text-gray-400"}`} />

                      <p className={`font-semibold text-sm leading-tight pr-6 ${status === "DONE" ? "text-green-800" : "text-gray-900"}`}>
                        {bc.item_name ?? "품목 미등록"}
                      </p>
                      <p className="text-[10px] text-gray-400 font-mono mt-1 truncate w-full pr-6">
                        {bc.barcode_no}
                      </p>

                      {/* 보류/누락 사유 */}
                      {bc.picking_reason && (
                        <p className="text-[10px] text-yellow-700 mt-0.5 leading-tight">{bc.picking_reason}</p>
                      )}

                      {/* 수동 처리 버튼 (대기 상태만) */}
                      {status === "WAITING" && (
                        <div className="flex gap-1 mt-2">
                          <button
                            onClick={() => setHoldModal({ barcode_id: bc.id, barcode_no: bc.barcode_no, item_name: bc.item_name, action: "HOLD" })}
                            className="text-[10px] px-2 py-0.5 rounded border border-yellow-300 text-yellow-700 bg-yellow-50 active:bg-yellow-100"
                          >
                            보류
                          </button>
                          <button
                            onClick={() => setHoldModal({ barcode_id: bc.id, barcode_no: bc.barcode_no, item_name: bc.item_name, action: "NOT_FOUND" })}
                            className="text-[10px] px-2 py-0.5 rounded border border-orange-300 text-orange-700 bg-orange-50 active:bg-orange-100"
                          >
                            없음
                          </button>
                        </div>
                      )}

                      {/* DONE → 되돌리기 */}
                      {status === "DONE" && (
                        <button
                          onClick={() => setLocal((prev) => ({ ...prev, [bc.id]: "WAITING" }))}
                          className="text-[10px] px-2 py-0.5 mt-2 rounded border border-gray-200 text-gray-400 bg-white active:bg-gray-50"
                        >
                          취소
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {barcodes.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Package size={36} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm">등록된 바코드가 없습니다</p>
            <p className="text-xs mt-1">입고처리 시 바코드가 생성됩니다</p>
          </div>
        )}
      </div>

      {/* ── 하단 고정 액션 ── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-200 px-4 py-3 safe-area-bottom">
        {allResolved ? (
          <button
            onClick={handlePickingDone}
            disabled={processing}
            className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 disabled:opacity-50 active:bg-green-700 shadow-lg"
          >
            {processing
              ? <><Loader2 size={20} className="animate-spin" /> 처리 중...</>
              : <><CheckCircle2 size={22} /> 피킹 완료 → 출고처리 이동 <ChevronRight size={18} /></>
            }
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-semibold text-gray-700">
                남은 피킹: <span className="text-indigo-700">{effectiveWaiting}개</span>
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                모든 항목이 처리되면 피킹 완료 버튼이 활성화됩니다
              </div>
            </div>
            <button
              onClick={() => {
                setLocal({});
                setFeedback(null);
              }}
              className="flex items-center gap-1.5 text-gray-400 hover:text-gray-600 text-xs border border-gray-200 rounded-lg px-3 py-2"
            >
              <RotateCcw size={12} /> 초기화
            </button>
          </div>
        )}
      </div>

      {/* ── 보류/누락 모달 ── */}
      {holdModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 shadow-2xl">
            <div className={`flex items-center gap-2 mb-4 ${holdModal.action === "HOLD" ? "text-yellow-700" : "text-orange-700"}`}>
              {holdModal.action === "HOLD" ? <PauseCircle size={20} /> : <XCircle size={20} />}
              <h3 className="font-bold text-base">
                {holdModal.action === "HOLD" ? "보류 처리" : "물품 없음 처리"}
              </h3>
            </div>
            <p className="text-sm text-gray-700 mb-1 font-medium">{holdModal.item_name ?? "미등록 품목"}</p>
            <p className="text-xs text-gray-400 font-mono mb-4">{holdModal.barcode_no}</p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1.5">사유 (선택)</label>
              <input
                type="text"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder={holdModal.action === "HOLD" ? "예: 외관 파손, 재확인 필요" : "예: 로케이션에 없음"}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setHoldModal(null); setHoldReason(""); }}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium text-sm"
              >
                취소
              </button>
              <button
                onClick={confirmHoldAction}
                className={`flex-1 text-white py-3 rounded-xl font-bold text-sm ${
                  holdModal.action === "HOLD" ? "bg-yellow-500 hover:bg-yellow-600" : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {holdModal.action === "HOLD" ? "보류 확정" : "없음 처리"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 스캔 오류 오버레이 ── */}
      {bigAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setBigAlert(null)}
        >
          <div className={`mx-6 rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full ${
            bigAlert.type === "err" ? "bg-red-600 text-white" : "bg-yellow-500 text-white"
          }`}>
            <AlertTriangle size={48} className="mx-auto mb-4" />
            {bigAlert.lines.map((line, i) => (
              <p key={i} className={i === 0 ? "text-2xl font-black" : "text-base mt-2 opacity-90"}>{line}</p>
            ))}
            <p className="text-sm mt-5 opacity-70">탭하여 닫기</p>
          </div>
        </div>
      )}
    </div>
  );
}
