"use client";

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, Box, Camera, CameraOff, CheckCircle2,
  ChevronRight, Clock, DollarSign, Loader2, MapPin, Package,
  Pause, Play, Printer, Send, Square, Video, Weight, X, Globe, Truck,
  ClipboardList,
} from "lucide-react";

// ── 타입 ──────────────────────────────────────────────────────

type WorkStep = "idle" | "working" | "scan_done" | "measuring" | "printing" | "done";
type ItemStatus = "waiting" | "scanned" | "hold" | "missing";

interface WorkItem {
  barcode_id: string;
  barcode_no: string;
  seq: number;
  item_name: string | null;
  parcel_id: string;
  parcel_tracking: string | null;
  location_code: string | null;
  scan_status: ItemStatus;
  scanned_at: string | null;
}

interface BoxInput {
  id: string;
  seq: number;
  weight_kg: string;
  length_cm: string;
  width_cm:  string;
  height_cm: string;
}

interface ScanAlert {
  severity: "error" | "warning" | "info";
  title: string;
  body: string;
  autoDismiss?: number; // ms
}

type OrderData = {
  id: string;
  order_no?: string;
  status: string;
  shipping_method?: string;
  recipient_name: string;
  recipient_country?: string;
  recipient_addr1?: string;
  ems_regino?: string | null;
  epost_regi_no?: string | null;
  customers: { name?: string; customer_code?: string; email?: string } | null;
};

// ── 상수 ──────────────────────────────────────────────────────

const STATUS_LABEL: Record<ItemStatus, string> = {
  waiting: "대기", scanned: "스캔완료", hold: "보류", missing: "누락",
};
const STATUS_COLOR: Record<ItemStatus, string> = {
  waiting: "bg-gray-100 text-gray-500",
  scanned: "bg-green-100 text-green-700",
  hold:    "bg-yellow-100 text-yellow-700",
  missing: "bg-orange-100 text-orange-700",
};

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

// ── 컴포넌트 ──────────────────────────────────────────────────

export default function OutboundWorkstationPage() {
  const { id: rawId } = useParams<{ id: string }>();
  const router = useRouter();

  const orderType = rawId.startsWith("dom-") ? "domestic" : "intl";
  const orderId   = rawId.replace(/^(intl|dom)-/, "");

  // ── 데이터 ──
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [items, setItems]         = useState<WorkItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);

  // ── 워크플로우 ──
  const [step, setStep] = useState<WorkStep>("idle");

  // ── 스캔 ──
  const [scanInput, setScanInput]         = useState("");
  const [lastFeedback, setLastFeedback]   = useState<string | null>(null);
  const [feedbackType, setFeedbackType]   = useState<"ok" | "warn" | "err">("ok");
  const [scanAlert, setScanAlert]         = useState<ScanAlert | null>(null);
  const scanInputRef                      = useRef<HTMLInputElement>(null);

  // ── 카메라/녹화 ──
  const videoRef                  = useRef<HTMLVideoElement>(null);
  const streamRef                 = useRef<MediaStream | null>(null);
  const recorderRef               = useRef<MediaRecorder | null>(null);
  const chunksRef                 = useRef<BlobPart[]>([]);
  const [camError, setCamError]   = useState("");
  const [camReady, setCamReady]   = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec]       = useState(0);
  const timerRef                  = useRef<ReturnType<typeof setInterval> | null>(null);
  const [firstParcelId, setFirstParcelId] = useState<string | null>(null);

  // ── 박스 실측 ──
  const [showMeasure, setShowMeasure] = useState(false);
  const [boxes, setBoxes] = useState<BoxInput[]>([
    { id: "1", seq: 1, weight_kg: "", length_cm: "", width_cm: "", height_cm: "" },
  ]);

  // ── 결제 요청 ──
  const [paymentSent, setPaymentSent]     = useState(false);
  const [paymentSending, setPaymentSending] = useState(false);

  // ── 화면 이탈 경고 ──
  useEffect(() => {
    function guard(e: BeforeUnloadEvent) {
      if (step !== "idle" && step !== "done") {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [step]);

  // ── 데이터 로드 ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/outbound/${orderId}?type=${orderType}`);
        const data = await res.json();
        if (!res.ok) { setLoadError(data.error ?? "로드 실패"); return; }

        setOrderData(data.order);
        setItems(
          (data.items as Omit<WorkItem, "scan_status" | "scanned_at">[]).map((it) => ({
            ...it,
            scan_status: "waiting",
            scanned_at: null,
          })),
        );
        if (data.items?.length > 0) setFirstParcelId(data.items[0].parcel_id);

        // 진행 중 세션 복원
        if (data.session?.status && !["DONE", "CANCELLED"].includes(data.session.status)) {
          setSessionId(data.session.id);
          const sl: Array<{ barcode_no: string; scanned_at: string }> =
            data.session.scan_log ?? [];
          if (sl.length > 0) {
            setItems((prev) =>
              prev.map((it) => {
                const log = sl.find((s) => s.barcode_no === it.barcode_no);
                return log
                  ? { ...it, scan_status: "scanned", scanned_at: log.scanned_at }
                  : it;
              }),
            );
            setStep("working");
          }
          if (data.session.boxes?.length > 0) {
            setBoxes(
              data.session.boxes.map((b: Omit<BoxInput, "id">, i: number) => ({
                id: String(i + 1),
                seq: b.seq,
                weight_kg: String(b.weight_kg ?? ""),
                length_cm: String(b.length_cm ?? ""),
                width_cm:  String(b.width_cm  ?? ""),
                height_cm: String(b.height_cm ?? ""),
              })),
            );
          }
        }
      } catch {
        setLoadError("네트워크 오류");
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId, orderType]);

  // ── 스캔 입력 자동 포커스 유지 ──
  useEffect(() => {
    if (step === "working") scanInputRef.current?.focus();
  }, [step, items]);

  // ── 카메라 시작 ──
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCamReady(true);
      setCamError("");
    } catch {
      setCamError("카메라 접근 불가 — 브라우저 권한을 확인하세요");
    }
  }, []);

  // ── 녹화 시작 ──
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, { mimeType: "video/webm;codecs=vp8" });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start(2000);
    recorderRef.current = recorder;
    setRecording(true);
    timerRef.current = setInterval(() => setRecSec((s) => s + 1), 1000);
  }, []);

  // ── 녹화 중지 + 업로드 ──
  const stopRecordingAndUpload = useCallback(async (sid: string) => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);

    recorderRef.current.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      if (blob.size < 1000 || !firstParcelId) return;

      try {
        const initRes = await fetch(`/api/admin/outbound/${orderId}/stream-upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_size: blob.size, parcel_id: firstParcelId }),
        });
        const { upload_url, stream_uid, media_id } = await initRes.json();
        if (!upload_url) return;

        await fetch(upload_url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/offset+octet-stream",
            "Upload-Offset": "0",
            "Tus-Resumable": "1.0.0",
          },
          body: blob,
        });

        await fetch(`/api/admin/outbound/${orderId}/stream-upload`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ media_id, stream_uid, session_id: sid }),
        });
      } catch {
        // 영상 업로드 실패는 작업 중단 없이 진행
      }
    };
  }, [orderId, firstParcelId]);

  // ── 작업 시작 ──
  async function handleStartWork() {
    await startCamera();

    const res = await fetch(`/api/admin/outbound/${orderId}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: orderType }),
    });
    const { session } = await res.json();
    setSessionId(session.id);

    startRecording();
    setStep("working");
    setTimeout(() => scanInputRef.current?.focus(), 300);
  }

  // ── 스캔 처리 ──
  const handleScan = useCallback(
    async (barcode: string) => {
      const b = barcode.trim();
      if (!b) return;
      setScanInput("");

      const found = items.find((it) => it.barcode_no === b);

      if (found) {
        if (found.scan_status === "scanned") {
          // 이미 스캔됨
          setLastFeedback("이미 스캔 완료된 제품입니다.");
          setFeedbackType("warn");
          showScanAlert({
            severity: "warning",
            title: "이미 스캔 완료된 제품",
            body: `${found.item_name ?? found.barcode_no} — 이미 스캔 처리되었습니다.`,
            autoDismiss: 2500,
          });
          return;
        }

        // 정상 스캔
        const now = new Date().toISOString();
        setItems((prev) =>
          prev.map((it) =>
            it.barcode_no === b ? { ...it, scan_status: "scanned", scanned_at: now } : it,
          ),
        );
        setLastFeedback(`✓ ${found.item_name ?? b} — 스캔 완료`);
        setFeedbackType("ok");

        // 세션 업데이트 (debounce 불필요 — 각 스캔 즉시 저장)
        if (sessionId) {
          const newLog = items
            .filter((it) => it.scan_status === "scanned" || it.barcode_no === b)
            .map((it) =>
              it.barcode_no === b
                ? { barcode_no: b, item_name: it.item_name, seq: it.seq, scanned_at: now }
                : { barcode_no: it.barcode_no, item_name: it.item_name, seq: it.seq, scanned_at: it.scanned_at },
            );
          fetch(`/api/admin/outbound/${orderId}/session`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, scan_log: newLog, status: "SCANNING" }),
          });
        }
        return;
      }

      // 바코드가 현재 주문에 없음 → 시스템 전체 조회
      try {
        const res = await fetch(`/api/admin/transfer/scan?q=${encodeURIComponent(b)}`);
        if (res.status === 404) {
          setLastFeedback("등록되지 않은 바코드");
          setFeedbackType("err");
          showScanAlert({
            severity: "error",
            title: "등록되지 않은 바코드입니다",
            body: "관리자 확인이 필요합니다.",
          });
        } else {
          setLastFeedback("이 주문의 내품이 아닙니다");
          setFeedbackType("err");
          showScanAlert({
            severity: "error",
            title: "이 주문의 내품이 아닙니다",
            body: "다시 확인해주세요. 잘못된 물품이 섞여 있을 수 있습니다.",
          });
        }
      } catch {
        setLastFeedback("스캔 오류");
        setFeedbackType("err");
      }
    },
    [items, sessionId, orderId],
  );

  function showScanAlert(alert: ScanAlert) {
    setScanAlert(alert);
    if (alert.autoDismiss) {
      setTimeout(() => setScanAlert(null), alert.autoDismiss);
    }
  }

  // ── 스캔 완료 확인 ──
  const scannedCount = useMemo(
    () => items.filter((it) => it.scan_status === "scanned").length,
    [items],
  );
  const allScanned = items.length > 0 && items.every(
    (it) => it.scan_status === "scanned" || it.scan_status === "hold" || it.scan_status === "missing",
  );

  useEffect(() => {
    if (allScanned && step === "working") {
      setStep("scan_done");
      if (sessionId) {
        fetch(`/api/admin/outbound/${orderId}/session`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, status: "SCAN_DONE" }),
        });
      }
    }
  }, [allScanned, step, sessionId, orderId]);

  // ── 보류 처리 ──
  function holdItem(barcode_no: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.barcode_no === barcode_no ? { ...it, scan_status: "hold" } : it,
      ),
    );
  }

  // ── 누락 처리 ──
  function missingItem(barcode_no: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.barcode_no === barcode_no ? { ...it, scan_status: "missing" } : it,
      ),
    );
  }

  // ── 박스 계산 ──
  function calcBox(b: BoxInput) {
    const w  = parseFloat(b.weight_kg) || 0;
    const l  = parseFloat(b.length_cm) || 0;
    const wd = parseFloat(b.width_cm)  || 0;
    const h  = parseFloat(b.height_cm) || 0;
    const vol = l && wd && h ? l * wd * h / 5000 : 0;
    const charge = Math.max(w, vol);
    return { vol: vol.toFixed(2), charge: charge.toFixed(2) };
  }

  // ── 박스 저장 ──
  async function handleSaveMeasurements() {
    const validBoxes = boxes.filter((b) => b.weight_kg);
    if (validBoxes.length === 0) return;

    const totalWeight = validBoxes.reduce((s, b) => s + (parseFloat(b.weight_kg) || 0), 0);

    // 대표 무게 저장 (첫 번째 박스 또는 합산)
    await fetch(`/api/admin/outbound/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "set_dimensions",
        type: orderType,
        weight_g: totalWeight * 1000,
        length_cm: parseFloat(validBoxes[0].length_cm) || undefined,
        width_cm:  parseFloat(validBoxes[0].width_cm)  || undefined,
        height_cm: parseFloat(validBoxes[0].height_cm) || undefined,
      }),
    });

    if (sessionId) {
      const boxesData = validBoxes.map((b) => ({
        seq: b.seq,
        weight_kg:  parseFloat(b.weight_kg) || 0,
        length_cm:  parseFloat(b.length_cm) || 0,
        width_cm:   parseFloat(b.width_cm)  || 0,
        height_cm:  parseFloat(b.height_cm) || 0,
      }));
      fetch(`/api/admin/outbound/${orderId}/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, boxes: boxesData, status: "MEASURING" }),
      });
    }

    setShowMeasure(false);
    setStep("printing");
  }

  // ── 출력 처리 ──
  async function handlePrint() {
    await fetch(`/api/admin/outbound/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_label_printed", type: orderType }),
    });

    if (orderType === "domestic") {
      window.open(`/domestic-orders/${orderId}/label`, "_blank");
    } else {
      window.open(`/orders/${orderId}/label`, "_blank");
      setTimeout(() => window.open(`/orders/${orderId}/packing-slip`, "_blank"), 500);
    }

    if (sessionId) {
      fetch(`/api/admin/outbound/${orderId}/session`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, status: "PRINTING" }),
      });
    }
  }

  // ── 결제 요청 ──
  async function handlePaymentRequest() {
    setPaymentSending(true);
    try {
      // 국내는 출하 처리 + 세션 완료
      if (orderType === "domestic") {
        await fetch(`/api/admin/outbound/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "ship", type: "domestic" }),
        });
      }

      if (sessionId) {
        await stopRecordingAndUpload(sessionId);
        await fetch(`/api/admin/outbound/${orderId}/session`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId, status: "PAYMENT_SENT" }),
        });
      }

      setPaymentSent(true);
      setStep("done");

      // 스트림 정리
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } finally {
      setPaymentSending(false);
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950">
        <Loader2 size={36} className="animate-spin text-emerald-400" />
      </div>
    );
  }

  if (loadError || !orderData) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-950 text-white">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-lg font-bold">{loadError || "주문을 찾을 수 없습니다."}</p>
          <Link href="/outbound" className="mt-4 inline-block text-emerald-400 hover:underline">
            ← 목록으로
          </Link>
        </div>
      </div>
    );
  }

  const customer = orderData.customers;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-gray-950 overflow-hidden select-none">

      {/* ── 상단 상태 바 ────────────────────────────────── */}
      <header className="h-12 shrink-0 bg-gray-900 border-b border-gray-800 flex items-center px-4 gap-4 text-sm">
        <Link href="/outbound" className="text-gray-400 hover:text-white p-1">
          <ArrowLeft size={16} />
        </Link>

        <div className="flex items-center gap-2 text-white font-semibold">
          {orderType === "intl"
            ? <Globe size={14} className="text-indigo-400" />
            : <Truck size={14} className="text-emerald-400" />
          }
          {orderType === "intl" ? orderData.order_no : "국내배송"}
        </div>

        <div className="text-gray-400 text-xs hidden md:flex items-center gap-3">
          <span>{customer?.name ?? "-"}</span>
          <span className="text-gray-600">|</span>
          <span className="font-mono">{customer?.customer_code}</span>
          {orderType === "intl" && (
            <>
              <span className="text-gray-600">|</span>
              <span className="text-indigo-300">{orderData.recipient_country} · {orderData.shipping_method}</span>
            </>
          )}
          <span className="text-gray-600">|</span>
          <span>내품 <b className="text-white">{items.length}</b>개</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* 스캔 진행 */}
          <span className="text-xs text-gray-400">
            스캔 <b className={scannedCount === items.length ? "text-green-400" : "text-white"}>
              {scannedCount}/{items.length}
            </b>
          </span>

          {/* 촬영 상태 */}
          {recording ? (
            <div className="flex items-center gap-1.5 text-red-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              REC {fmt(recSec)}
            </div>
          ) : camReady ? (
            <span className="text-xs text-gray-500 flex items-center gap-1"><Camera size={12} /> 준비</span>
          ) : (
            <span className="text-xs text-gray-600 flex items-center gap-1"><CameraOff size={12} /> 카메라 없음</span>
          )}

          {/* 출고 상태 */}
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
            step === "done" ? "bg-green-900 text-green-300"
            : step === "working" || step === "scan_done" ? "bg-blue-900 text-blue-300"
            : "bg-gray-800 text-gray-400"
          }`}>
            {step === "idle" ? "대기"
              : step === "working" ? "스캔 중"
              : step === "scan_done" ? "스캔 완료"
              : step === "measuring" ? "실측 중"
              : step === "printing" ? "출력"
              : "완료"}
          </span>
        </div>
      </header>

      {/* ── 메인 작업 영역 ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── 왼쪽: 카메라 패널 ── */}
        <div className="w-[360px] shrink-0 bg-black border-r border-gray-800 flex flex-col">
          {/* 영상 영역 */}
          <div className="relative flex-1 min-h-0 bg-gray-950">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            {!camReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600">
                <Video size={40} className="mb-3" />
                <p className="text-sm">
                  {camError || (step === "idle" ? "작업 시작 시 카메라 활성화" : "카메라 초기화 중...")}
                </p>
              </div>
            )}
            {recording && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 text-red-400 text-xs font-semibold px-2.5 py-1.5 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                녹화 중 {fmt(recSec)}
              </div>
            )}
          </div>

          {/* 카메라 컨트롤 */}
          <div className="h-14 bg-gray-900 border-t border-gray-800 flex items-center justify-center gap-3 px-4">
            {step === "idle" ? (
              <p className="text-xs text-gray-600">작업 시작 시 자동 녹화</p>
            ) : recording ? (
              <button
                onClick={() => {
                  if (recorderRef.current && sessionId) stopRecordingAndUpload(sessionId);
                  setRecording(false);
                  if (timerRef.current) clearInterval(timerRef.current);
                }}
                className="flex items-center gap-2 text-xs text-red-400 hover:text-red-300 border border-red-800 rounded-lg px-3 py-1.5"
              >
                <Square size={12} /> 녹화 중지
              </button>
            ) : (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-800 rounded-lg px-3 py-1.5"
              >
                <Play size={12} /> 녹화 재시작
              </button>
            )}
          </div>
        </div>

        {/* ── 오른쪽: 작업 패널 ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">

          {/* 내품 리스트 */}
          <div className="flex-1 overflow-y-auto">
            {step === "idle" ? (
              /* 작업 시작 화면 */
              <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
                <div className="text-center">
                  <ClipboardList size={48} className="mx-auto text-gray-300 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">출고 작업 준비</h2>
                  <p className="text-gray-500 text-sm mb-1">
                    수취인: <span className="font-semibold text-gray-800">{orderData.recipient_name}</span>
                  </p>
                  <p className="text-gray-500 text-sm">
                    내품 <span className="font-bold text-gray-800">{items.length}</span>개 ·{" "}
                    {orderType === "intl"
                      ? `${orderData.recipient_country} ${orderData.shipping_method}`
                      : `국내 ${orderData.recipient_addr1?.slice(0, 20) ?? ""}`}
                  </p>
                </div>

                {/* 내품 미리보기 */}
                <div className="w-full max-w-md bg-gray-50 rounded-2xl p-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2 uppercase">내품 목록</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {items.map((it) => (
                      <div key={it.barcode_id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                        <span className="text-gray-800">{it.item_name ?? "미등록"}</span>
                        <div className="flex items-center gap-2">
                          {it.location_code && (
                            <span className="text-xs font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                              {it.location_code}
                            </span>
                          )}
                          <span className="text-xs text-gray-400 font-mono">{it.barcode_no}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleStartWork}
                  className="flex items-center gap-3 bg-emerald-600 hover:bg-emerald-700 text-white px-10 py-4 rounded-2xl text-lg font-bold shadow-lg transition-colors"
                >
                  <Play size={22} /> 출고 작업 시작
                </button>

                <p className="text-xs text-gray-400">카메라가 자동으로 시작되고 녹화가 시작됩니다</p>
              </div>
            ) : (
              /* 작업 중 내품 리스트 테이블 */
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <th className="text-left py-2.5 px-4 font-semibold text-gray-600 w-8">#</th>
                    <th className="text-left py-2.5 px-4 font-semibold text-gray-600">상품명</th>
                    <th className="text-left py-2.5 px-2 font-semibold text-gray-600">바코드</th>
                    <th className="text-left py-2.5 px-2 font-semibold text-gray-600">로케이션</th>
                    <th className="text-center py-2.5 px-3 font-semibold text-gray-600">상태</th>
                    <th className="py-2.5 px-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.barcode_id}
                      className={`border-b border-gray-100 transition-colors ${
                        it.scan_status === "scanned" ? "bg-green-50" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="py-2.5 px-4 text-gray-400 text-xs">{it.seq}</td>
                      <td className="py-2.5 px-4">
                        <span className={`font-medium ${it.scan_status === "scanned" ? "text-green-800" : "text-gray-900"}`}>
                          {it.item_name ?? "품목 미등록"}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-xs text-gray-500">{it.barcode_no}</td>
                      <td className="py-2.5 px-2">
                        {it.location_code ? (
                          <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                            {it.location_code}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${STATUS_COLOR[it.scan_status]}`}>
                          {STATUS_LABEL[it.scan_status]}
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        {it.scan_status === "waiting" && (
                          <div className="flex gap-1">
                            <button
                              onClick={() => holdItem(it.barcode_no)}
                              className="text-[10px] px-2 py-1 rounded border border-yellow-200 text-yellow-700 hover:bg-yellow-50"
                            >
                              보류
                            </button>
                            <button
                              onClick={() => missingItem(it.barcode_no)}
                              className="text-[10px] px-2 py-1 rounded border border-orange-200 text-orange-700 hover:bg-orange-50"
                            >
                              누락
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ── 스캔 입력 영역 ── */}
          {(step === "working" || step === "scan_done") && (
            <div className="border-t border-gray-200 p-3 bg-gray-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    ref={scanInputRef}
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleScan(scanInput);
                    }}
                    onBlur={() => {
                      if (step === "working") setTimeout(() => scanInputRef.current?.focus(), 100);
                    }}
                    placeholder="바코드 스캐너 입력 대기 중..."
                    className="w-full border-2 border-emerald-300 focus:border-emerald-500 rounded-xl px-4 py-3 font-mono text-sm focus:outline-none bg-white"
                    autoComplete="off"
                  />
                </div>
                <button
                  onClick={() => handleScan(scanInput)}
                  disabled={!scanInput.trim()}
                  className="bg-emerald-600 text-white px-4 py-3 rounded-xl disabled:opacity-40 hover:bg-emerald-700"
                >
                  <Send size={16} />
                </button>
              </div>

              {/* 마지막 스캔 결과 */}
              {lastFeedback && (
                <div className={`mt-2 text-sm font-medium px-3 py-1.5 rounded-lg ${
                  feedbackType === "ok"  ? "text-green-700 bg-green-50"
                  : feedbackType === "warn" ? "text-yellow-700 bg-yellow-50"
                  : "text-red-700 bg-red-50"
                }`}>
                  {lastFeedback}
                </div>
              )}

              {/* 완료 메시지 */}
              {step === "scan_done" && (
                <div className="mt-2 flex items-center gap-2 text-sm font-bold text-green-700 bg-green-100 px-3 py-2 rounded-lg">
                  <CheckCircle2 size={16} /> 모든 내품 확인 완료 — 포장 후 실측을 입력하세요
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 하단 액션 바 ──────────────────────────────── */}
      <footer className="h-14 shrink-0 bg-gray-900 border-t border-gray-800 flex items-center px-4 gap-2">
        <Link href="/picking" className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-gray-700 rounded-lg px-3 py-1.5">
          <ArrowLeft size={12} /> 피킹 목록
        </Link>

        <div className="flex-1" />

        {/* 실측 입력 (스캔 완료 이후) */}
        {(step === "scan_done" || step === "measuring" || step === "printing") && (
          <button
            onClick={() => setShowMeasure(true)}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg"
          >
            <Weight size={14} /> 실측 입력
          </button>
        )}

        {/* 서류 출력 (실측 완료 이후) */}
        {(step === "printing") && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg"
          >
            <Printer size={14} />
            {orderType === "domestic" ? "송장 출력" : "라벨·세관서류 출력"}
          </button>
        )}

        {/* 결제 요청 (출력 완료 이후 또는 실측 완료 이후) */}
        {(step === "printing") && !paymentSent && (
          <button
            onClick={handlePaymentRequest}
            disabled={paymentSending}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg disabled:opacity-50"
          >
            {paymentSending
              ? <><Loader2 size={14} className="animate-spin" /> 처리 중</>
              : <><DollarSign size={14} /> 결제 요청 전송</>
            }
          </button>
        )}

        {step === "done" && (
          <Link
            href="/outbound"
            className="flex items-center gap-1.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg"
          >
            <CheckCircle2 size={14} /> 완료 — 다음 주문
          </Link>
        )}
      </footer>

      {/* ── 스캔 경고 오버레이 ─────────────────────────── */}
      {scanAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 cursor-pointer"
          onClick={() => setScanAlert(null)}
        >
          <div
            className={`max-w-lg w-full mx-6 rounded-3xl p-8 shadow-2xl text-center ${
              scanAlert.severity === "error"   ? "bg-red-600 text-white"
              : scanAlert.severity === "warning" ? "bg-yellow-500 text-white"
              : "bg-blue-600 text-white"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <AlertTriangle size={52} className="mx-auto mb-4 opacity-90" />
            <h2 className="text-2xl font-black mb-3">{scanAlert.title}</h2>
            <p className="text-lg font-medium opacity-90">{scanAlert.body}</p>
            <button
              onClick={() => setScanAlert(null)}
              className="mt-6 bg-white/20 hover:bg-white/30 text-white font-bold px-8 py-3 rounded-xl text-sm transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* ── 실측 입력 모달 ─────────────────────────────── */}
      {showMeasure && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
            <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <Box size={18} /> 박스별 실측 입력
              </div>
              <button onClick={() => setShowMeasure(false)} className="text-gray-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {boxes.map((box, idx) => {
                const { vol, charge } = calcBox(box);
                return (
                  <div key={box.id} className="border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-gray-700 text-sm">박스 #{box.seq}</span>
                      {boxes.length > 1 && (
                        <button
                          onClick={() => setBoxes((prev) => prev.filter((b) => b.id !== box.id))}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          삭제
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                      {[
                        { label: "무게(kg) *", key: "weight_kg", unit: "kg" },
                        { label: "가로(cm)", key: "length_cm", unit: "cm" },
                        { label: "세로(cm)", key: "width_cm",  unit: "cm" },
                        { label: "높이(cm)", key: "height_cm", unit: "cm" },
                      ].map(({ label, key }) => (
                        <div key={key}>
                          <label className="block text-xs text-gray-500 mb-1">{label}</label>
                          <input
                            type="number"
                            step="0.1"
                            value={box[key as keyof BoxInput]}
                            onChange={(e) =>
                              setBoxes((prev) =>
                                prev.map((b) =>
                                  b.id === box.id ? { ...b, [key]: e.target.value } : b,
                                ),
                              )
                            }
                            className="w-full border border-gray-200 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
                          />
                        </div>
                      ))}
                    </div>

                    {box.weight_kg && (
                      <div className="mt-3 grid grid-cols-3 gap-2 text-xs bg-gray-50 rounded-xl p-3">
                        <div className="text-center">
                          <p className="text-gray-500">실제무게</p>
                          <p className="font-bold text-gray-800">{parseFloat(box.weight_kg).toFixed(2)} kg</p>
                        </div>
                        <div className="text-center">
                          <p className="text-gray-500">부피무게</p>
                          <p className="font-bold text-gray-800">{vol} kg</p>
                        </div>
                        <div className="text-center border-l border-gray-200">
                          <p className="text-gray-500">청구기준</p>
                          <p className="font-bold text-blue-700 text-sm">{charge} kg</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() =>
                  setBoxes((prev) => [
                    ...prev,
                    { id: String(Date.now()), seq: prev.length + 1, weight_kg: "", length_cm: "", width_cm: "", height_cm: "" },
                  ])
                }
                className="w-full border-2 border-dashed border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 py-3 rounded-xl text-sm"
              >
                + 박스 추가
              </button>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setShowMeasure(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl font-medium text-sm"
              >
                취소
              </button>
              <button
                onClick={handleSaveMeasurements}
                disabled={!boxes.some((b) => b.weight_kg)}
                className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold text-sm disabled:opacity-40 hover:bg-blue-700"
              >
                저장 → 서류 출력 단계로
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 완료 화면 오버레이 ──────────────────────────── */}
      {step === "done" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="bg-white rounded-3xl shadow-2xl p-10 text-center max-w-sm mx-4">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={44} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">출고 작업 완료</h2>
            <p className="text-gray-500 text-sm mb-6">
              {orderData.recipient_name}님의 주문이 처리되었습니다
            </p>
            <div className="flex gap-3">
              <Link
                href={orderType === "intl" ? `/orders/${orderId}` : `/domestic-orders/${orderId}`}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                주문 상세
              </Link>
              <Link
                href="/outbound"
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-emerald-700"
              >
                다음 주문
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
