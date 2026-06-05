"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Loader2, MapPin, Package,
  ScanLine, AlertTriangle, RotateCcw, ChevronRight,
  Globe, Truck, PauseCircle, XCircle, ChevronDown,
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
  order_no?:        string;
  status:           string;
  shipping_method?: string;
  recipient_name:   string;
  recipient_country?: string;
  recipient_addr1?: string;
  picking_started_at?: string | null;
  picking_done_at?:    string | null;
  customers: { name?: string; customer_code?: string } | null;
}

type ScanFeedback = { type: "ok" | "warn" | "err"; msg: string };
type LocalOverride = Record<string, PickingStatus>;

// ── 상태 스타일 ────────────────────────────────────────────────

const STATUS_ICON: Record<PickingStatus, React.ReactNode> = {
  WAITING:   <div className="w-6 h-6 rounded-full border-2 border-gray-300 bg-white" />,
  DONE:      <CheckCircle2 size={24} className="text-green-500" />,
  HOLD:      <PauseCircle  size={24} className="text-yellow-500" />,
  NOT_FOUND: <XCircle      size={24} className="text-orange-500" />,
};
const STATUS_ROW: Record<PickingStatus, string> = {
  WAITING:   "bg-white border-gray-200",
  DONE:      "bg-green-50 border-green-300",
  HOLD:      "bg-yellow-50 border-yellow-300",
  NOT_FOUND: "bg-orange-50 border-orange-300",
};

// ── 메인 컴포넌트 ──────────────────────────────────────────────

export default function PickingBoardPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const router = useRouter();

  const isIntl    = !rawId.startsWith("dom-");
  const orderType = isIntl ? "intl" : "domestic";

  const [order,    setOrder]    = useState<PickOrder | null>(null);
  const [barcodes, setBarcodes] = useState<PickBarcode[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState("");
  const [local,    setLocal]    = useState<LocalOverride>({});

  const [scanInput, setScanInput] = useState("");
  const [feedback,  setFeedback]  = useState<ScanFeedback | null>(null);
  const [bigAlert,  setBigAlert]  = useState<{ type: "err" | "warn"; lines: string[] } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const [holdModal, setHoldModal] = useState<{
    barcode_id: string;
    barcode_no: string;
    item_name:  string | null;
    action:     "HOLD" | "NOT_FOUND";
  } | null>(null);
  const [holdReason, setHoldReason] = useState("");
  const [processing, setProcessing] = useState(false);

  // 현재 활성 로케이션 인덱스 (순서대로 진행)
  const [activeLocIdx, setActiveLocIdx] = useState(0);

  // ── 데이터 로드 ──────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/picking/${rawId}`);
      const data = await res.json();
      if (!res.ok) { setLoadErr(data.error ?? "로드 실패"); return; }
      setOrder(data.order);
      setBarcodes(data.barcodes ?? []);
      setLocal({});
    } catch {
      setLoadErr("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => { loadData(); }, [loadData]);

  // 스캔 필드 포커스 유지
  useEffect(() => { scanRef.current?.focus(); });

  function getStatus(b: PickBarcode): PickingStatus {
    return local[b.id] ?? b.picking_status;
  }

  // ── 위치별 그룹핑 ─────────────────────────────────────────────

  const grouped = barcodes.reduce<Record<string, PickBarcode[]>>((acc, b) => {
    const loc = b.location?.code ?? "위치 미지정";
    if (!acc[loc]) acc[loc] = [];
    acc[loc].push(b);
    return acc;
  }, {});
  const sortedLocs = Object.keys(grouped).sort((a, b) => {
    if (a === "위치 미지정") return 1;
    if (b === "위치 미지정") return -1;
    return a.localeCompare(b);
  });

  // ── 통계 ──────────────────────────────────────────────────────

  const effectiveDone      = barcodes.filter((b) => getStatus(b) === "DONE").length;
  const effectiveHold      = barcodes.filter((b) => getStatus(b) === "HOLD").length;
  const effectiveNotFound  = barcodes.filter((b) => getStatus(b) === "NOT_FOUND").length;
  const effectiveWaiting   = barcodes.length - effectiveDone - effectiveHold - effectiveNotFound;
  const allResolved        = barcodes.length > 0 && effectiveWaiting === 0;
  const progressPct        = barcodes.length ? ((barcodes.length - effectiveWaiting) / barcodes.length) * 100 : 0;

  // 현재 활성 로케이션의 미완료 여부
  const currentLoc = sortedLocs[activeLocIdx];
  const currentLocItems = currentLoc ? (grouped[currentLoc] ?? []) : [];
  const currentLocDone = currentLocItems.filter((b) => getStatus(b) !== "WAITING").length;
  const currentLocAllDone = currentLocItems.length > 0 && currentLocDone === currentLocItems.length;

  // ── 스캔 처리 ─────────────────────────────────────────────────

  const handleScan = useCallback(
    async (barcode: string) => {
      const b = barcode.trim();
      if (!b) return;
      setScanInput("");
      setFeedback(null);

      const found = barcodes.find((bc) => bc.barcode_no === b);
      const currentStatus = found ? (local[found.id] ?? found.picking_status) : null;

      if (currentStatus === "DONE") {
        setFeedback({ type: "warn", msg: `이미 피킹됨: ${found?.item_name ?? b}` });
        setBigAlert({ type: "warn", lines: ["이미 피킹 처리된 바코드입니다."] });
        setTimeout(() => setBigAlert(null), 2000);
        fetch(`/api/admin/picking/${rawId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode_no: b, order_type: orderType, scan_result: "DUPLICATE" }),
        });
        return;
      }

      if (!found) {
        setFeedback({ type: "err", msg: `미등록 바코드: ${b}` });
        const res = await fetch(`/api/admin/picking/${rawId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcode_no: b, order_type: orderType }),
        });
        const json = await res.json();
        setBigAlert({
          type: "err",
          lines: json.scan_result === "WRONG_ORDER"
            ? ["이 주문의 내품이 아닙니다!", "바코드를 다시 확인하세요."]
            : ["등록되지 않은 바코드입니다.", "관리자 확인 필요"],
        });
        setTimeout(() => setBigAlert(null), 3500);
        return;
      }

      // 정상 스캔
      setLocal((prev) => ({ ...prev, [found.id]: "DONE" }));
      setFeedback({ type: "ok", msg: `✓ ${found.item_name ?? b}` });

      // 현재 로케이션 아이템이 모두 완료되면 자동으로 다음 로케이션으로 이동
      const updatedLocal = { ...local, [found.id]: "DONE" as PickingStatus };
      const locItems = grouped[currentLoc] ?? [];
      const allLocDone = locItems.every(
        (item) => (updatedLocal[item.id] ?? item.picking_status) !== "WAITING",
      );
      if (allLocDone && activeLocIdx < sortedLocs.length - 1) {
        setTimeout(() => setActiveLocIdx((i) => i + 1), 600);
      }

      fetch(`/api/admin/picking/${rawId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode_no: b, order_type: orderType }),
      });
    },
    [barcodes, local, rawId, orderType, grouped, currentLoc, activeLocIdx, sortedLocs.length],
  );

  // ── 보류/누락 확정 ─────────────────────────────────────────────

  async function confirmHoldAction() {
    if (!holdModal) return;
    const { barcode_id, barcode_no, action } = holdModal;
    setLocal((prev) => ({ ...prev, [barcode_id]: action }));
    setHoldModal(null);
    setHoldReason("");

    // 현재 로케이션 완료 체크
    const updatedLocal = { ...local, [barcode_id]: action };
    const locItems = grouped[currentLoc] ?? [];
    const allLocDone = locItems.every(
      (item) => (updatedLocal[item.id] ?? item.picking_status) !== "WAITING",
    );
    if (allLocDone && activeLocIdx < sortedLocs.length - 1) {
      setTimeout(() => setActiveLocIdx((i) => i + 1), 600);
    }

    await fetch(`/api/admin/picking/${rawId}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode_no, order_type: orderType, scan_result: action, reason: holdReason || undefined }),
    });
  }

  // ── 피킹 완료 ─────────────────────────────────────────────────

  async function handlePickingDone() {
    setProcessing(true);
    try {
      const startRes = await fetch(`/api/admin/picking/${rawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!startRes.ok) {
        const body = await startRes.json();
        // 이미 PICKING 상태면 start를 건너뛰고 done으로 진행
        if (body.current_status !== "PICKING") { alert(body.error); return; }
      }
      const doneRes = await fetch(`/api/admin/picking/${rawId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "done" }),
      });
      if (!doneRes.ok) { alert((await doneRes.json()).error); return; }
      // 피킹 완료 → 피킹 목록으로 돌아감 (출고는 별도 출고처리 메뉴에서 진행)
      router.push("/picking");
    } finally {
      setProcessing(false);
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }
  if (loadErr || !order) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
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
                : <Truck size={13} className="text-emerald-500 shrink-0" />}
              <p className="font-bold text-gray-900 text-sm truncate">
                {isIntl ? order.order_no : "국내배송"} · {order.customers?.name}
              </p>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.recipient_name}{isIntl ? ` → ${order.recipient_country}` : ""}
            </p>
          </div>
          <div className={`shrink-0 text-sm font-black px-3 py-1.5 rounded-full tabular-nums ${
            allResolved ? "bg-green-600 text-white" : "bg-indigo-100 text-indigo-700"
          }`}>
            {effectiveDone}/{barcodes.length}
          </div>
        </div>

        {/* 진행바 */}
        <div className="mt-2.5 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allResolved ? "bg-green-500" : "bg-indigo-500"}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* 통계 칩 */}
        <div className="mt-2 flex gap-2 text-[11px] font-semibold flex-wrap">
          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full">완료 {effectiveDone}</span>
          {effectiveHold > 0 && <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">보류 {effectiveHold}</span>}
          {effectiveNotFound > 0 && <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full">없음 {effectiveNotFound}</span>}
          {effectiveWaiting > 0 && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">대기 {effectiveWaiting}</span>}
        </div>
      </div>

      {/* ── 스캔 입력 (sticky) ── */}
      <div className="bg-indigo-600 px-4 py-3 sticky top-[113px] z-10">
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
              placeholder="바코드 스캔 / 직접 입력 후 Enter"
              className="w-full pl-9 pr-4 py-3 rounded-xl bg-white text-gray-900 font-mono text-sm focus:outline-none"
              autoComplete="off"
            />
          </div>
          <button
            onClick={() => handleScan(scanInput)}
            disabled={!scanInput.trim()}
            className="bg-white text-indigo-600 font-bold px-4 rounded-xl disabled:opacity-40 active:bg-gray-100 text-sm"
          >
            확인
          </button>
        </div>
        {feedback && (
          <div className={`mt-2 text-sm font-semibold px-3 py-2 rounded-xl ${
            feedback.type === "ok"   ? "bg-green-100 text-green-800"
            : feedback.type === "warn" ? "bg-yellow-100 text-yellow-800"
            : "bg-red-100 text-red-800"
          }`}>
            {feedback.msg}
          </div>
        )}
      </div>

      {/* ── 로케이션 탭 네비게이션 ── */}
      {sortedLocs.length > 1 && (
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex gap-2 overflow-x-auto">
          {sortedLocs.map((loc, idx) => {
            const items = grouped[loc] ?? [];
            const done = items.filter((b) => getStatus(b) !== "WAITING").length;
            const isActive = idx === activeLocIdx;
            const isDone = done === items.length;
            return (
              <button
                key={loc}
                onClick={() => setActiveLocIdx(idx)}
                className={`flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                  isActive
                    ? isDone
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-indigo-600 text-white border-indigo-600"
                    : isDone
                      ? "bg-green-50 text-green-700 border-green-300"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                }`}
              >
                <MapPin size={11} />
                <span className="font-mono">{loc}</span>
                <span className="tabular-nums">{done}/{items.length}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── 현재 로케이션 피킹 화면 ── */}
      <div className="flex-1 pb-28">
        {sortedLocs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={40} className="mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium">등록된 바코드가 없습니다</p>
            <p className="text-xs mt-1 text-orange-500 font-semibold">
              소포가 주문에 연결되지 않았거나 입고 처리가 완료되지 않은 상태입니다
            </p>
            <p className="text-xs mt-1 text-gray-400">관리자에게 문의하세요</p>
          </div>
        ) : (
          sortedLocs.map((loc, locIdx) => {
            const locItems = grouped[loc] ?? [];
            const locDone  = locItems.filter((b) => getStatus(b) !== "WAITING").length;
            const locAllDone = locDone === locItems.length;
            const isActive = locIdx === activeLocIdx;

            return (
              <div key={loc} className={isActive ? "" : "hidden"}>

                {/* 로케이션 배너 */}
                <div className={`flex items-center gap-4 px-5 py-5 ${locAllDone ? "bg-green-600" : "bg-indigo-700"}`}>
                  <div className="flex-1">
                    <p className={`text-xs font-semibold mb-1 ${locAllDone ? "text-green-200" : "text-indigo-300"}`}>
                      현재 피킹 위치 {locIdx + 1} / {sortedLocs.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <MapPin size={20} className="text-white/70 shrink-0" />
                      <span className="text-3xl font-black text-white font-mono tracking-widest">{loc}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-semibold ${locAllDone ? "text-green-200" : "text-indigo-300"}`}>완료</p>
                    <p className="text-2xl font-black text-white tabular-nums">{locDone}/{locItems.length}</p>
                  </div>
                  {locAllDone && <CheckCircle2 size={32} className="text-white shrink-0" />}
                </div>

                {/* 완료 시 다음 로케이션 버튼 */}
                {locAllDone && locIdx < sortedLocs.length - 1 && (
                  <button
                    onClick={() => setActiveLocIdx(locIdx + 1)}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-green-500 text-white font-black text-base active:bg-green-600"
                  >
                    다음 위치로 이동: {sortedLocs[locIdx + 1]}
                    <ChevronRight size={22} />
                  </button>
                )}

                {/* 아이템 리스트 */}
                <div className="p-3 space-y-2">
                  {locItems.map((bc) => {
                    const status = getStatus(bc);
                    return (
                      <div
                        key={bc.id}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all ${STATUS_ROW[status]}`}
                      >
                        {/* 상태 아이콘 */}
                        <div className="shrink-0">{STATUS_ICON[status]}</div>

                        {/* 품목 정보 */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-sm leading-tight ${
                            status === "DONE" ? "text-green-800 line-through decoration-green-400" : "text-gray-900"
                          }`}>
                            {bc.item_name ?? "품목 미등록"}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono mt-0.5 truncate">
                            {bc.barcode_no}
                          </p>
                          {bc.picking_reason && (
                            <p className="text-[11px] text-yellow-700 mt-0.5">{bc.picking_reason}</p>
                          )}
                        </div>

                        {/* 액션 버튼 */}
                        <div className="shrink-0 flex gap-1.5">
                          {status === "WAITING" && (
                            <>
                              <button
                                onClick={() => setHoldModal({ barcode_id: bc.id, barcode_no: bc.barcode_no, item_name: bc.item_name, action: "HOLD" })}
                                className="text-[11px] px-2.5 py-1.5 rounded-lg border border-yellow-300 text-yellow-700 bg-yellow-50 font-semibold active:bg-yellow-100"
                              >
                                보류
                              </button>
                              <button
                                onClick={() => setHoldModal({ barcode_id: bc.id, barcode_no: bc.barcode_no, item_name: bc.item_name, action: "NOT_FOUND" })}
                                className="text-[11px] px-2.5 py-1.5 rounded-lg border border-orange-300 text-orange-700 bg-orange-50 font-semibold active:bg-orange-100"
                              >
                                없음
                              </button>
                            </>
                          )}
                          {status === "DONE" && (
                            <button
                              onClick={() => setLocal((prev) => ({ ...prev, [bc.id]: "WAITING" }))}
                              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-400 bg-white active:bg-gray-50"
                            >
                              취소
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 이전 로케이션으로 버튼 */}
                {locIdx > 0 && (
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => setActiveLocIdx(locIdx - 1)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 text-gray-500 text-xs font-semibold border border-gray-200 rounded-xl bg-white active:bg-gray-50"
                    >
                      <ChevronDown size={14} className="rotate-90" />
                      이전 위치: {sortedLocs[locIdx - 1]}
                    </button>
                  </div>
                )}
              </div>
            );
          })
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
              : <><CheckCircle2 size={22} /> 피킹 완료</>}
          </button>
        ) : currentLocAllDone && activeLocIdx < sortedLocs.length - 1 ? (
          <button
            onClick={() => setActiveLocIdx((i) => i + 1)}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-base flex items-center justify-center gap-3 active:bg-indigo-700 shadow-md"
          >
            <MapPin size={20} />
            다음 위치로: {sortedLocs[activeLocIdx + 1]}
            <ChevronRight size={20} />
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-sm font-bold text-gray-800">
                <span className="font-mono text-indigo-600">{currentLoc}</span> 에서 {effectiveWaiting}개 남음
              </div>
              <div className="text-xs text-gray-400 mt-0.5">바코드를 스캔하거나 직접 입력하세요</div>
            </div>
            <button
              onClick={() => { setLocal({}); setFeedback(null); }}
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
            <div className={`flex items-center gap-2 mb-3 ${holdModal.action === "HOLD" ? "text-yellow-700" : "text-orange-700"}`}>
              {holdModal.action === "HOLD" ? <PauseCircle size={20} /> : <XCircle size={20} />}
              <h3 className="font-bold text-base">
                {holdModal.action === "HOLD" ? "보류 처리" : "물품 없음 처리"}
              </h3>
            </div>
            <p className="text-sm text-gray-800 font-semibold mb-0.5">{holdModal.item_name ?? "미등록 품목"}</p>
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
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-semibold text-sm"
              >
                취소
              </button>
              <button
                onClick={confirmHoldAction}
                className={`flex-1 text-white py-3 rounded-xl font-black text-sm ${
                  holdModal.action === "HOLD" ? "bg-yellow-500 active:bg-yellow-600" : "bg-orange-500 active:bg-orange-600"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setBigAlert(null)}
        >
          <div className={`mx-6 rounded-3xl p-8 text-center shadow-2xl max-w-sm w-full ${
            bigAlert.type === "err" ? "bg-red-600 text-white" : "bg-yellow-500 text-white"
          }`}>
            <AlertTriangle size={52} className="mx-auto mb-4" />
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
