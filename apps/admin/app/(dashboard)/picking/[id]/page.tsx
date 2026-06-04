"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
  Truck,
  MapPin,
  Package,
  CheckCircle2,
  Loader2,
  AlertCircle,
  ScanLine,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  ChevronRight,
  X,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────

type PickingStatus = "WAITING" | "DONE" | "HOLD" | "NOT_FOUND";
type ScanResult   = "PICKED" | "WRONG_ORDER" | "DUPLICATE" | "NOT_FOUND";
type FeedbackType = "success" | "wrong_order" | "duplicate" | "not_found";

interface PickingBarcode {
  id:             string;
  barcode_no:     string;
  seq:            number;
  item_name:      string | null;
  picking_status: PickingStatus;
  picking_reason: string | null;
  picking_note:   string | null;
  picked_at:      string | null;
  location:       { id: string; code: string } | null;
}

interface OrderInfo {
  id:               string;
  order_no?:        string;
  status:           string;
  recipient_name?:  string;
  recipient_country?: string;
  packaging_type?:  string;
  delivery_msg?:    string;
  notes?:           string;
  customers?:       { name?: string; customer_code?: string } | null;
}

interface PickingStats {
  total:     number;
  done:      number;
  hold:      number;
  not_found: number;
  waiting:   number;
}

interface FeedbackState {
  type:      FeedbackType;
  title:     string;
  subtitle?: string;
}

// ── 상수 ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PickingStatus, { label: string; dot: string; card: string; badge: string }> = {
  WAITING:   { label: "대기",     dot: "bg-gray-300",   card: "",                              badge: "bg-gray-100 text-gray-600 border-gray-200" },
  DONE:      { label: "피킹완료", dot: "bg-green-500",  card: "bg-green-50 border-green-300",  badge: "bg-green-100 text-green-700 border-green-300" },
  HOLD:      { label: "보류",     dot: "bg-yellow-400", card: "bg-yellow-50 border-yellow-300",badge: "bg-yellow-100 text-yellow-700 border-yellow-300" },
  NOT_FOUND: { label: "물품없음", dot: "bg-red-400",    card: "bg-red-50 border-red-300",      badge: "bg-red-100 text-red-700 border-red-300" },
};

const MANUAL_REASONS: Record<"DONE" | "HOLD" | "NOT_FOUND", string[]> = {
  DONE:      ["스캐너 오류로 수동 처리", "바코드 인식 불가", "기타"],
  HOLD:      ["상품 상태 확인 필요", "위치 확인 불가", "포장 손상", "기타"],
  NOT_FOUND: ["해당 위치에 상품 없음", "다른 위치 보관 추정", "상품 분실 추정", "기타"],
};

// ── 메인 컴포넌트 ──────────────────────────────────────────────

export default function PickingDetailPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const router        = useRouter();
  const isIntl        = !rawId.startsWith("dom-");
  const orderType     = isIntl ? "intl" : "domestic";

  // 데이터
  const [order,    setOrder]    = useState<OrderInfo | null>(null);
  const [barcodes, setBarcodes] = useState<PickingBarcode[]>([]);
  const [stats,    setStats]    = useState<PickingStats>({ total: 0, done: 0, hold: 0, not_found: 0, waiting: 0 });
  const [loading,  setLoading]  = useState(true);
  const [loadErr,  setLoadErr]  = useState("");

  // 스캔
  const [scanInput,  setScanInput]  = useState("");
  const [scanning,   setScanning]   = useState(false);
  const [feedback,   setFeedback]   = useState<FeedbackState | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // 팝업 (물품 상세)
  const [selectedBarcode, setSelectedBarcode] = useState<PickingBarcode | null>(null);
  const [popupAction,     setPopupAction]      = useState<"DONE" | "HOLD" | "NOT_FOUND" | null>(null);
  const [popupReason,     setPopupReason]      = useState("");
  const [popupNote,       setPopupNote]        = useState("");
  const [popupSubmitting, setPopupSubmitting]  = useState(false);
  const [popupErr,        setPopupErr]         = useState("");
  const popupRef = useRef<HTMLDivElement>(null);

  // 피킹 완료
  const [completing, setCompleting] = useState(false);
  const [completed,  setCompleted]  = useState(false);
  const [completeErr, setCompleteErr] = useState("");

  // ── 데이터 로드 ─────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadErr("");
    try {
      const res  = await fetch(`/api/admin/picking/${rawId}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setLoadErr(data.error ?? "주문을 불러오지 못했습니다.");
        return;
      }
      setOrder(data.order);
      setBarcodes(data.barcodes ?? []);
      setStats(data.stats ?? { total: 0, done: 0, hold: 0, not_found: 0, waiting: 0 });
      if (data.order?.status === "PICKING_DONE") setCompleted(true);
    } catch {
      setLoadErr("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [rawId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── 스캔 입력 자동 포커스 ──────────────────────────────────

  // 팝업이 없을 때 항상 스캔 입력에 포커스 유지
  useEffect(() => {
    if (selectedBarcode) return;
    const el = scanInputRef.current;
    if (!el) return;

    const onBlur = () => {
      // 팝업 내 요소 클릭 시에는 포커스 이동 허용
      setTimeout(() => {
        if (!document.activeElement?.closest("[data-popup]")) {
          el.focus();
        }
      }, 150);
    };

    el.addEventListener("blur", onBlur);
    el.focus();
    return () => el.removeEventListener("blur", onBlur);
  }, [selectedBarcode]);

  // ── 스캔 처리 ───────────────────────────────────────────────

  const handleScan = useCallback(
    async (raw: string) => {
      const barcode = raw.trim();
      if (!barcode || scanning) return;

      setScanning(true);
      setScanInput("");

      try {
        const res  = await fetch(`/api/admin/picking/${rawId}/scan`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ barcode }),
        });
        const data = await res.json();
        const result: ScanResult = data.result;

        if (result === "PICKED") {
          // 바코드 상태를 클라이언트 상태에서 즉시 업데이트
          setBarcodes((prev) =>
            prev.map((b) =>
              b.barcode_no === barcode
                ? { ...b, picking_status: "DONE", picked_at: new Date().toISOString() }
                : b,
            ),
          );
          setStats((prev) => ({
            ...prev,
            done:    prev.done + 1,
            waiting: Math.max(0, prev.waiting - 1),
          }));
          const item = data.barcode?.item_name ?? barcode;
          const loc  = data.barcode?.location?.code ?? "";
          showFeedback({
            type:     "success",
            title:    "스캔 완료",
            subtitle: `${loc ? `[${loc}] ` : ""}${item}`,
          });
        } else if (result === "WRONG_ORDER") {
          showFeedback({
            type:     "wrong_order",
            title:    "이 주문의 물품이 아닙니다",
            subtitle: "다시 확인해주세요.",
          });
        } else if (result === "DUPLICATE") {
          showFeedback({
            type:     "duplicate",
            title:    "이미 피킹 완료된 물품입니다.",
            subtitle: data.barcode?.item_name ?? "",
          });
        } else {
          showFeedback({
            type:     "not_found",
            title:    "등록되지 않은 바코드입니다.",
            subtitle: "관리자 확인이 필요합니다.",
          });
        }
      } catch {
        showFeedback({
          type:     "not_found",
          title:    "스캔 처리 오류",
          subtitle: "잠시 후 다시 시도하세요.",
        });
      } finally {
        setScanning(false);
        setTimeout(() => scanInputRef.current?.focus(), 50);
      }
    },
    [rawId, scanning],
  );

  function showFeedback(fb: FeedbackState) {
    setFeedback(fb);
    if (fb.type === "success") {
      setTimeout(() => setFeedback(null), 2000);
    }
  }

  // ── 팝업: 물품 상세 ─────────────────────────────────────────

  function openPopup(barcode: PickingBarcode) {
    setSelectedBarcode(barcode);
    setPopupAction(null);
    setPopupReason("");
    setPopupNote("");
    setPopupErr("");
  }

  function closePopup() {
    setSelectedBarcode(null);
    setPopupAction(null);
    setPopupReason("");
    setPopupNote("");
    setPopupErr("");
    setTimeout(() => scanInputRef.current?.focus(), 100);
  }

  async function submitPopupAction() {
    if (!selectedBarcode || !popupAction) return;
    if (!popupReason) {
      setPopupErr("사유를 선택해주세요.");
      return;
    }

    setPopupSubmitting(true);
    setPopupErr("");

    try {
      const res = await fetch(`/api/admin/picking/${rawId}/items`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          barcodeId: selectedBarcode.id,
          status:    popupAction,
          reason:    popupReason,
          note:      popupNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPopupErr(data.error ?? "처리 실패");
        return;
      }

      // 클라이언트 상태 업데이트
      const prevStatus = selectedBarcode.picking_status;
      setBarcodes((prev) =>
        prev.map((b) =>
          b.id === selectedBarcode.id
            ? {
                ...b,
                picking_status: popupAction,
                picking_reason: popupReason,
                picking_note:   popupNote || null,
                picked_at:      new Date().toISOString(),
              }
            : b,
        ),
      );
      setStats((prev) => {
        const next = { ...prev };
        // 이전 상태 감소
        if (prevStatus === "WAITING")   next.waiting   = Math.max(0, next.waiting - 1);
        if (prevStatus === "DONE")      next.done      = Math.max(0, next.done - 1);
        if (prevStatus === "HOLD")      next.hold      = Math.max(0, next.hold - 1);
        if (prevStatus === "NOT_FOUND") next.not_found = Math.max(0, next.not_found - 1);
        // 새 상태 증가
        if (popupAction === "DONE")      next.done      += 1;
        if (popupAction === "HOLD")      next.hold      += 1;
        if (popupAction === "NOT_FOUND") next.not_found += 1;
        return next;
      });

      closePopup();
    } catch {
      setPopupErr("네트워크 오류가 발생했습니다.");
    } finally {
      setPopupSubmitting(false);
    }
  }

  // ── 피킹 완료 처리 ──────────────────────────────────────────

  async function handleComplete() {
    setCompleting(true);
    setCompleteErr("");
    try {
      const res  = await fetch(`/api/admin/picking/${rawId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "done", type: orderType }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompleteErr(data.error ?? "처리 실패");
        return;
      }
      setCompleted(true);
    } finally {
      setCompleting(false);
    }
  }

  // ── 파생 상태 ────────────────────────────────────────────────

  const doneCount  = barcodes.filter((b) => b.picking_status === "DONE").length;
  const totalCount = barcodes.length;
  const allDone    = totalCount > 0 && doneCount === totalCount;

  const canStart   = order && ["PAID", "PACKING", "PENDING"].includes(order.status);
  const inPicking  = order?.status === "PICKING";

  const orderLabel = isIntl
    ? (order as { order_no?: string } | null)?.order_no ?? rawId.slice(5, 13)
    : `국내-${rawId.slice(4, 12)}`;

  // ── 로딩/에러 ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 size={36} className="animate-spin text-indigo-600" />
        <p className="text-gray-500 text-lg">주문 정보를 불러오는 중…</p>
      </div>
    );
  }

  if (loadErr) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
        <p className="text-xl font-bold text-red-700 mb-2">불러오기 실패</p>
        <p className="text-gray-600 mb-6">{loadErr}</p>
        <Link href="/picking" className="text-indigo-600 hover:underline">
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  // ── 피킹 시작 전 화면 ───────────────────────────────────────

  if (canStart) {
    return <PickingStartScreen order={order!} orderLabel={orderLabel} isIntl={isIntl} rawId={rawId} orderType={orderType} onStarted={loadData} />;
  }

  // ── 피킹 완료 후 화면 ───────────────────────────────────────

  if (completed) {
    return <PickingDoneScreen rawId={rawId} />;
  }

  // ── 메인 피킹 화면 ──────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* ── 고정 헤더 ─────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link href="/picking" className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-500 shrink-0">
            <ArrowLeft size={22} />
          </Link>

          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isIntl ? (
              <Globe size={16} className="text-indigo-500 shrink-0" />
            ) : (
              <Truck size={16} className="text-emerald-500 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-bold text-gray-900 text-base truncate">{orderLabel}</p>
              <p className="text-xs text-gray-500 truncate">
                {order?.customers?.customer_code ?? "-"}
                {order?.customers?.name && ` · ${order.customers.name}`}
              </p>
            </div>
          </div>

          {/* 진행 수량 */}
          <div className="shrink-0 text-right">
            <div className="text-2xl font-extrabold text-indigo-700 leading-none">
              {doneCount}
              <span className="text-base font-semibold text-gray-400">
                /{totalCount}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">피킹 완료</p>
          </div>

          {/* 스캔 상태 표시 */}
          <div className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold border ${
            scanning
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-green-50 text-green-700 border-green-200"
          }`}>
            <ScanLine size={14} />
            {scanning ? "처리중" : "스캔 대기"}
          </div>
        </div>

        {/* 스캔 입력 필드 */}
        <div className="px-4 pb-3">
          <div className="relative flex items-center">
            <ScanLine size={18} className="absolute left-3 text-gray-400 pointer-events-none" />
            <input
              ref={scanInputRef}
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleScan(scanInput);
                }
              }}
              placeholder="바코드를 스캔하거나 입력하세요 (Enter 확인)"
              disabled={scanning}
              className="w-full pl-10 pr-4 py-3 border-2 border-indigo-300 rounded-xl bg-indigo-50/50 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-indigo-500 focus:bg-white text-base transition-all disabled:opacity-60"
            />
            {scanning && (
              <Loader2 size={18} className="absolute right-3 animate-spin text-indigo-500" />
            )}
          </div>
        </div>
      </div>

      {/* ── 피드백 오버레이 ───────────────────────────────── */}
      {feedback && <FeedbackOverlay feedback={feedback} onDismiss={() => { setFeedback(null); scanInputRef.current?.focus(); }} />}

      {/* ── 모든 물품 완료 배너 ──────────────────────────── */}
      {allDone && !completed && (
        <div className="mx-4 mt-4 bg-green-100 border-2 border-green-400 rounded-2xl p-4 flex items-center gap-3">
          <CheckCircle2 size={28} className="text-green-600 shrink-0" />
          <p className="font-bold text-green-800 text-lg">모든 물품 피킹 완료!</p>
        </div>
      )}

      {/* ── 물품 카드 그리드 ──────────────────────────────── */}
      <div className="flex-1 px-4 py-4">
        {barcodes.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Package size={48} className="mx-auto mb-3 text-gray-200" />
            <p className="text-lg">등록된 바코드가 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {barcodes.map((bc) => (
              <BarcodeCard
                key={bc.id}
                barcode={bc}
                onClick={() => openPopup(bc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 고정 하단 바 ──────────────────────────────────── */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        {completeErr && (
          <p className="text-red-600 text-sm text-center mb-2">{completeErr}</p>
        )}
        <button
          onClick={handleComplete}
          disabled={!allDone || completing}
          className={`w-full py-5 rounded-2xl font-extrabold text-xl flex items-center justify-center gap-3 transition-all ${
            allDone && !completing
              ? "bg-green-600 text-white shadow-lg shadow-green-200 active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {completing ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <ClipboardCheck size={24} />
          )}
          {allDone
            ? completing
              ? "처리 중…"
              : `피킹 완료 (${doneCount}/${totalCount})`
            : `피킹 완료 (${doneCount}/${totalCount} 완료 시 활성화)`
          }
        </button>
      </div>

      {/* ── 물품 상세 팝업 ────────────────────────────────── */}
      {selectedBarcode && (
        <ItemPopup
          barcode={selectedBarcode}
          popupRef={popupRef}
          popupAction={popupAction}
          popupReason={popupReason}
          popupNote={popupNote}
          popupSubmitting={popupSubmitting}
          popupErr={popupErr}
          onSetAction={setPopupAction}
          onSetReason={setPopupReason}
          onSetNote={setPopupNote}
          onSubmit={submitPopupAction}
          onClose={closePopup}
        />
      )}
    </div>
  );
}

// ── 피킹 시작 전 화면 ─────────────────────────────────────────

function PickingStartScreen({
  order,
  orderLabel,
  isIntl,
  rawId,
  orderType,
  onStarted,
}: {
  order:      OrderInfo;
  orderLabel: string;
  isIntl:     boolean;
  rawId:      string;
  orderType:  string;
  onStarted:  () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [err,      setErr]      = useState("");

  async function handleStart() {
    setStarting(true);
    setErr("");
    try {
      const res  = await fetch(`/api/admin/picking/${rawId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "start", type: orderType }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error ?? "처리 실패"); return; }
      onStarted();
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/picking" className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={22} />
        </Link>
        <div>
          <p className="text-xs text-gray-500">피킹 시작 전</p>
          <p className="font-bold text-gray-900 text-lg">{orderLabel}</p>
        </div>
      </div>

      {/* 주문 요약 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">고객</span>
          <span className="font-semibold">{order.customers?.name ?? "-"} <span className="text-gray-400 font-normal">{order.customers?.customer_code}</span></span>
        </div>
        {isIntl && order.recipient_country && (
          <div className="flex justify-between">
            <span className="text-gray-500">배송 국가</span>
            <span className="font-bold text-indigo-700">{order.recipient_country}</span>
          </div>
        )}
        {order.delivery_msg && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500 shrink-0">고객 요청</span>
            <span className="font-semibold text-orange-700 text-right">{order.delivery_msg}</span>
          </div>
        )}
      </div>

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          {err}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={starting}
        className="w-full py-6 bg-indigo-600 text-white rounded-2xl font-extrabold text-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-60"
      >
        {starting ? <Loader2 size={28} className="animate-spin" /> : <ScanLine size={28} />}
        피킹 시작
      </button>
    </div>
  );
}

// ── 피킹 완료 화면 ────────────────────────────────────────────

function PickingDoneScreen({ rawId }: { rawId: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center space-y-8">
      <div className="bg-green-100 rounded-full p-8">
        <CheckCircle2 size={72} className="text-green-600" />
      </div>
      <div>
        <h1 className="text-3xl font-extrabold text-gray-900 mb-3">피킹 완료!</h1>
        <p className="text-xl text-gray-600 leading-relaxed">
          출고 작업대로 이동해주세요.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link href="/picking">
          <button className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 active:scale-[0.98]">
            <ArrowLeft size={22} />
            내 코스 보기
          </button>
        </Link>
      </div>
    </div>
  );
}

// ── 바코드 카드 ──────────────────────────────────────────────

function BarcodeCard({
  barcode,
  onClick,
}: {
  barcode: PickingBarcode;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[barcode.picking_status];

  return (
    <button
      onClick={onClick}
      className={`relative text-left border-2 rounded-2xl p-3 transition-all active:scale-[0.97] w-full ${
        barcode.picking_status === "WAITING"
          ? "bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md"
          : cfg.card
      }`}
    >
      {/* 로케이션 — 가장 크게 표시 */}
      <div className="mb-2">
        {barcode.location?.code ? (
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-indigo-500 shrink-0" />
            <span className="text-3xl font-black font-mono text-indigo-700 leading-none tracking-tight">
              {barcode.location.code}
            </span>
          </div>
        ) : (
          <span className="text-2xl font-black text-gray-300">위치없음</span>
        )}
      </div>

      {/* 상품명 */}
      <p className="text-sm font-semibold text-gray-800 leading-tight mb-1.5 line-clamp-2">
        {barcode.item_name ?? "품목 미등록"}
      </p>

      {/* 바코드 */}
      <p className="text-[11px] font-mono text-gray-400 mb-2 truncate">
        {barcode.barcode_no}
      </p>

      {/* 상태 뱃지 */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${cfg.badge}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </div>

      {/* 완료 아이콘 (우상단) */}
      {barcode.picking_status === "DONE" && (
        <CheckCircle2 size={20} className="absolute top-2 right-2 text-green-500" />
      )}
    </button>
  );
}

// ── 피드백 오버레이 ──────────────────────────────────────────

function FeedbackOverlay({
  feedback,
  onDismiss,
}: {
  feedback:  FeedbackState;
  onDismiss: () => void;
}) {
  const isSuccess = feedback.type === "success";

  if (isSuccess) {
    return (
      <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 w-[90vw] max-w-md">
        <div className="bg-green-600 text-white rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-3">
          <CheckCircle2 size={28} className="shrink-0" />
          <div>
            <p className="font-extrabold text-lg">{feedback.title}</p>
            {feedback.subtitle && <p className="text-green-100 text-sm">{feedback.subtitle}</p>}
          </div>
        </div>
      </div>
    );
  }

  const configs: Record<FeedbackType, { bg: string; border: string; icon: React.ReactNode; iconBg: string }> = {
    success:    { bg: "", border: "", icon: null, iconBg: "" },
    wrong_order: {
      bg:     "bg-red-600",
      border: "border-red-700",
      icon:   <AlertTriangle size={64} className="text-white" />,
      iconBg: "bg-red-700/40",
    },
    duplicate: {
      bg:     "bg-orange-500",
      border: "border-orange-600",
      icon:   <XCircle size={64} className="text-white" />,
      iconBg: "bg-orange-600/40",
    },
    not_found: {
      bg:     "bg-purple-700",
      border: "border-purple-800",
      icon:   <AlertCircle size={64} className="text-white" />,
      iconBg: "bg-purple-800/40",
    },
  };

  const cfg = configs[feedback.type];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      onClick={onDismiss}
    >
      <div className={`${cfg.bg} rounded-3xl p-10 text-center max-w-md w-full shadow-2xl border-2 ${cfg.border}`}>
        <div className={`${cfg.iconBg} rounded-full p-6 w-fit mx-auto mb-6`}>
          {cfg.icon}
        </div>
        <h2 className="text-3xl font-extrabold text-white mb-3">{feedback.title}</h2>
        {feedback.subtitle && (
          <p className="text-white/80 text-xl">{feedback.subtitle}</p>
        )}
        <p className="text-white/60 text-sm mt-6">화면을 탭하면 닫힙니다</p>
      </div>
    </div>
  );
}

// ── 물품 상세 팝업 ────────────────────────────────────────────

function ItemPopup({
  barcode,
  popupRef,
  popupAction,
  popupReason,
  popupNote,
  popupSubmitting,
  popupErr,
  onSetAction,
  onSetReason,
  onSetNote,
  onSubmit,
  onClose,
}: {
  barcode:        PickingBarcode;
  popupRef:       React.RefObject<HTMLDivElement | null>;
  popupAction:    "DONE" | "HOLD" | "NOT_FOUND" | null;
  popupReason:    string;
  popupNote:      string;
  popupSubmitting: boolean;
  popupErr:       string;
  onSetAction:    (a: "DONE" | "HOLD" | "NOT_FOUND" | null) => void;
  onSetReason:    (r: string) => void;
  onSetNote:      (n: string) => void;
  onSubmit:       () => void;
  onClose:        () => void;
}) {
  const cfg = STATUS_CONFIG[barcode.picking_status];
  const reasons = popupAction ? MANUAL_REASONS[popupAction] : [];

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        ref={popupRef}
        data-popup="true"
        className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* 팝업 헤더 */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">물품 상세</p>
            <div className="flex items-center gap-2">
              {barcode.location?.code && (
                <span className="text-2xl font-black font-mono text-indigo-700">
                  {barcode.location.code}
                </span>
              )}
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
                {cfg.label}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-gray-100 text-gray-400">
            <X size={22} />
          </button>
        </div>

        {/* 물품 정보 */}
        <div className="px-6 py-4 space-y-2 border-b border-gray-100">
          <p className="font-bold text-gray-900 text-lg">
            {barcode.item_name ?? "품목 미등록"}
          </p>
          <p className="text-sm font-mono text-gray-500">{barcode.barcode_no}</p>
          {barcode.picking_reason && (
            <p className="text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
              이전 처리 사유: {barcode.picking_reason}
            </p>
          )}
        </div>

        {/* 액션 선택 */}
        {!popupAction ? (
          <div className="px-6 py-5 space-y-3">
            <p className="text-sm font-semibold text-gray-600 mb-3">처리 방법을 선택하세요</p>
            <ActionButton
              label="수동완료"
              sub="바코드 스캔 없이 피킹 완료 처리"
              color="bg-green-600 hover:bg-green-700"
              onClick={() => { onSetAction("DONE"); onSetReason(""); }}
            />
            <ActionButton
              label="물품없음"
              sub="해당 위치에 물품을 찾을 수 없음"
              color="bg-red-500 hover:bg-red-600"
              onClick={() => { onSetAction("NOT_FOUND"); onSetReason(""); }}
            />
            <ActionButton
              label="보류"
              sub="확인 필요 — 관리자에게 알림"
              color="bg-yellow-500 hover:bg-yellow-600"
              onClick={() => { onSetAction("HOLD"); onSetReason(""); }}
            />
          </div>
        ) : (
          /* 사유 선택 폼 */
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onSetAction(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <ArrowLeft size={18} />
              </button>
              <p className="font-bold text-gray-800">
                {popupAction === "DONE" && "수동완료 사유"}
                {popupAction === "HOLD" && "보류 사유"}
                {popupAction === "NOT_FOUND" && "물품없음 사유"}
              </p>
            </div>

            {/* 사유 선택 */}
            <div className="space-y-2">
              {reasons.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    popupReason === r
                      ? "border-indigo-500 bg-indigo-50"
                      : "border-gray-200 hover:border-indigo-200"
                  }`}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={popupReason === r}
                    onChange={() => onSetReason(r)}
                    className="accent-indigo-600 w-5 h-5"
                  />
                  <span className="font-medium text-gray-800">{r}</span>
                </label>
              ))}
            </div>

            {/* 메모 입력 */}
            <div>
              <label className="text-sm font-semibold text-gray-600 block mb-1.5">
                메모 <span className="text-gray-400 font-normal">(선택)</span>
              </label>
              <textarea
                value={popupNote}
                onChange={(e) => onSetNote(e.target.value)}
                placeholder="추가 메모를 입력하세요…"
                rows={2}
                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 resize-none"
              />
            </div>

            {popupErr && (
              <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{popupErr}</p>
            )}

            <button
              onClick={onSubmit}
              disabled={!popupReason || popupSubmitting}
              className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
                popupReason && !popupSubmitting
                  ? "bg-indigo-600 text-white shadow-md active:scale-[0.98]"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
            >
              {popupSubmitting ? <Loader2 size={20} className="animate-spin" /> : <ChevronRight size={20} />}
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  sub,
  color,
  onClick,
}: {
  label:   string;
  sub:     string;
  color:   string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full ${color} text-white rounded-2xl px-5 py-4 text-left flex items-center justify-between active:scale-[0.98] transition-all`}
    >
      <div>
        <p className="font-bold text-lg">{label}</p>
        <p className="text-white/70 text-sm">{sub}</p>
      </div>
      <ChevronRight size={24} className="shrink-0" />
    </button>
  );
}
