"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Search, Package, User, MapPin, CheckCircle,
  Loader2, ScanLine, ChevronDown, RotateCcw, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import WebcamCapture, { type CapturedPhoto, type WebcamCaptureResult } from "@/components/inbound/WebcamCapture";

interface InvoiceItem {
  name_en?: string;
  name_ko?: string;
  quantity?: number;
}

interface ParcelData {
  id: string;
  tracking_no: string | null;
  status: string;
  item_count: number;
  pre_invoice_items: InvoiceItem[] | null;
  courier: string | null;
  sender_name: string | null;
  customers: { id: string; name: string; customer_code: string; email: string } | null;
  storage_locations: { id: string; code: string; zone: string; slot: string } | null;
}

interface LocationOption {
  id: string;
  code: string;
  zone: string;
}

type Step = "scan" | "review" | "capture" | "done";

export default function InboundPage() {
  const [step, setStep] = useState<Step>("scan");
  const [trackingInput, setTrackingInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  const [parcel, setParcel] = useState<ParcelData | null>(null);
  const [itemCount, setItemCount] = useState(1);

  // 로케이션
  const [locationMode, setLocationMode] = useState<"auto" | "manual">("auto");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);

  // 미디어 (웹캠 캡처 결과)
  const [captureResult, setCaptureResult] = useState<WebcamCaptureResult | null>(null);

  // 처리
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<{ parcel_id: string; location_code: string | null; barcode_count: number } | null>(null);
  const [resultBarcodes, setResultBarcodes] = useState<unknown[]>([]);

  const scanInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "scan") scanInputRef.current?.focus();
  }, [step]);

  const loadLocations = useCallback(async () => {
    if (locationsLoaded) return;
    const res = await fetch("/api/admin/storage/list");
    const json = await res.json();
    const all = (json.locations ?? []) as { id: string; code: string; zone: string; status: string }[];
    setLocations(all.filter(l => l.status === "AVAILABLE").map(({ id, code, zone }) => ({ id, code, zone })));
    setLocationsLoaded(true);
  }, [locationsLoaded]);

  const calcDefaultItemCount = useCallback((items: InvoiceItem[] | null): number => {
    if (!items || items.length === 0) return 1;
    return items.reduce((s, i) => s + Math.max(1, Number(i.quantity) || 1), 0);
  }, []);

  // 송장 조회
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const no = trackingInput.trim();
    if (!no) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetch(`/api/admin/inbound/lookup?tracking_no=${encodeURIComponent(no)}`);
      const json = await res.json();
      if (!res.ok) { setSearchError(json.error ?? "조회 실패"); return; }
      setParcel(json.parcel);
      setItemCount(calcDefaultItemCount(json.parcel.pre_invoice_items));
      setStep("review");
    } catch {
      setSearchError("네트워크 오류");
    } finally {
      setSearching(false);
    }
  }

  // 웹캠 캡처 완료 콜백
  function handleCaptureResult(result: WebcamCaptureResult) {
    setCaptureResult(result);
    // capture step → 바로 입고처리 실행
    handleProcess(result);
  }

  // 사진 Blob → Supabase Storage
  async function uploadPhoto(parcelId: string, photo: CapturedPhoto, idx: number, total: number) {
    const fd = new FormData();
    fd.append("parcel_id", parcelId);
    fd.append("file", new File([photo.blob], `capture-${photo.capturedAt}.jpg`, { type: "image/jpeg" }));
    fd.append("caption", `${photo.itemName} (${idx + 1}/${total})`);
    await fetch("/api/admin/inbound/upload-photo", { method: "POST", body: fd });
  }

  // 영상 Blob → Cloudflare Stream TUS
  async function uploadVideo(parcelId: string, videoBlob: Blob) {
    const initRes = await fetch("/api/admin/inbound/stream-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcel_id: parcelId, file_size: videoBlob.size }),
    });
    const initJson = await initRes.json();
    if (!initRes.ok || !initJson.upload_url) return;

    const { upload_url, stream_uid, media_id } = initJson;

    await fetch(upload_url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/offset+octet-stream",
        "Upload-Offset": "0",
        "Tus-Resumable": "1.0.0",
      },
      body: videoBlob,
    });

    await fetch("/api/admin/inbound/stream-upload", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id, stream_uid }),
    });
  }

  // 입고처리 실행
  async function handleProcess(media?: WebcamCaptureResult) {
    if (!parcel) return;
    const mediaData = media ?? captureResult;
    setProcessing(true);
    setUploadProgress(0);
    setStep("done"); // 진행 중 표시를 위해 미리 이동

    try {
      const photos = mediaData?.photos ?? [];
      const videoBlob = mediaData?.videoBlob ?? null;
      const totalMedia = photos.length + (videoBlob ? 1 : 0);
      let done = 0;

      // 사진 업로드 (품목 매칭 caption 포함)
      for (let i = 0; i < photos.length; i++) {
        await uploadPhoto(parcel.id, photos[i], i, photos.length);
        done++;
        setUploadProgress(Math.round((done / Math.max(totalMedia, 1)) * 70));
      }

      // 영상 업로드
      if (videoBlob) {
        await uploadVideo(parcel.id, videoBlob);
        done++;
        setUploadProgress(Math.round((done / Math.max(totalMedia, 1)) * 70));
      }

      // 입고처리 + 바코드 생성
      const res = await fetch("/api/admin/inbound/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcel_id: parcel.id,
          item_count: itemCount,
          location_id: locationMode === "manual" ? selectedLocationId : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) { alert(`오류: ${json.error}`); setProcessing(false); return; }

      setResult({
        parcel_id: json.parcel_id,
        location_code: json.location_code,
        barcode_count: json.barcode_count,
      });
      setResultBarcodes(json.barcodes ?? []);
      setUploadProgress(100);

      // 바코드 라벨 자동 출력
      if (json.barcodes?.length > 0) {
        const labelData = buildLabelData(json.barcodes, parcel, json.location_code);
        const encoded = encodeURIComponent(JSON.stringify(labelData));
        window.open(`/inbound/${parcel.id}/barcodes?data=${encoded}&auto=1`, "_blank");
      }
    } finally {
      setProcessing(false);
    }
  }

  function buildLabelData(
    barcodes: Array<{ barcode_no: string; seq: number; item_name: string | null }>,
    p: ParcelData,
    locationCode: string | null,
  ) {
    const today = new Date().toLocaleDateString("ko-KR");
    return barcodes.map((b) => ({
      barcode_no: b.barcode_no,
      seq: b.seq,
      item_name: b.item_name,
      customer_name: p.customers?.name ?? "",
      customer_code: p.customers?.customer_code ?? "",
      tracking_no: p.tracking_no,
      location_code: locationCode,
      inbound_date: today,
    }));
  }

  function buildLabelDataForDone() {
    if (!parcel) return [];
    const today = new Date().toLocaleDateString("ko-KR");
    return (resultBarcodes as Array<{ barcode_no: string; seq: number; item_name: string | null }>).map((b) => ({
      barcode_no: b.barcode_no,
      seq: b.seq,
      item_name: b.item_name,
      customer_name: parcel.customers?.name ?? "",
      customer_code: parcel.customers?.customer_code ?? "",
      tracking_no: parcel.tracking_no,
      location_code: result?.location_code ?? null,
      inbound_date: today,
    }));
  }

  function resetAll() {
    setStep("scan");
    setTrackingInput("");
    setParcel(null);
    setCaptureResult(null);
    setResult(null);
    setResultBarcodes([]);
    setLocationMode("auto");
    setSelectedLocationId(null);
    setSearchError("");
    setUploadProgress(0);
  }

  const totalItems = parcel?.pre_invoice_items?.reduce((s, i) => s + Math.max(1, Number(i.quantity) || 1), 0) ?? 0;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-blue-600 text-white p-2 rounded-xl">
          <ScanLine size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">입고처리</h1>
          <p className="text-sm text-gray-500">스캔 → 확인 → 촬영 → 바코드 출력</p>
        </div>
      </div>

      {/* ─── STEP 1: 스캔 ─── */}
      {step === "scan" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                송장번호 스캔 또는 입력
              </label>
              <div className="flex gap-2">
                <input
                  ref={scanInputRef}
                  type="text"
                  value={trackingInput}
                  onChange={(e) => setTrackingInput(e.target.value)}
                  placeholder="바코드 스캐너 또는 직접 입력"
                  className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={searching || !trackingInput.trim()}
                  className="bg-blue-600 text-white px-4 py-3 rounded-xl disabled:opacity-50 hover:bg-blue-700"
                >
                  {searching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                </button>
              </div>
            </div>
            {searchError && (
              <p className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                <AlertCircle size={14} /> {searchError}
              </p>
            )}
          </form>
        </div>
      )}

      {/* ─── STEP 2: 내용 확인 + 로케이션 ─── */}
      {step === "review" && parcel && (
        <>
          {/* 고객 정보 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <User size={15} className="text-blue-500" />
              <span className="font-semibold text-gray-800 text-sm">고객</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-blue-50 rounded-xl w-10 h-10 flex items-center justify-center text-blue-700 font-bold text-lg">
                {parcel.customers?.name?.[0] ?? "?"}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{parcel.customers?.name ?? "-"}</p>
                <p className="text-xs text-gray-500">{parcel.customers?.customer_code}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400">{parcel.courier ?? "택배"}</p>
                <p className="text-xs font-mono text-gray-600">{parcel.tracking_no}</p>
              </div>
            </div>
          </div>

          {/* 내품 목록 + 수량 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-indigo-500" />
                <span className="font-semibold text-gray-800 text-sm">내품 목록</span>
              </div>
              {totalItems > 0 && (
                <span className="text-xs text-gray-400">사전등록 합계 {totalItems}개</span>
              )}
            </div>

            {parcel.pre_invoice_items && parcel.pre_invoice_items.length > 0 ? (
              <div className="space-y-1.5 mb-4">
                {parcel.pre_invoice_items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800">
                      {item.name_ko || item.name_en || "품목명 없음"}
                    </span>
                    <span className="text-sm font-semibold text-gray-600">× {item.quantity ?? 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic mb-4">사전 등록 내품 없음</p>
            )}

            <div className="border-t pt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                실제 내품 수량 확인 <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <button onClick={() => setItemCount(v => Math.max(1, v - 1))}
                  className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold text-lg">−</button>
                <input type="number" min={1} value={itemCount}
                  onChange={(e) => setItemCount(Math.max(1, Number(e.target.value)))}
                  className="w-16 text-center border border-gray-200 rounded-xl py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <button onClick={() => setItemCount(v => v + 1)}
                  className="w-9 h-9 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold text-lg">+</button>
                <span className="text-sm text-gray-500">개 → 바코드 {itemCount}장</span>
              </div>
            </div>
          </div>

          {/* 로케이션 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <MapPin size={15} className="text-indigo-500" />
              <span className="font-semibold text-gray-800 text-sm">보관 로케이션</span>
            </div>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setLocationMode("auto")}
                className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${locationMode === "auto" ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                자동배정
              </button>
              <button onClick={() => { setLocationMode("manual"); loadLocations(); }}
                className={`flex-1 py-2 text-sm rounded-lg border font-medium transition-colors ${locationMode === "manual" ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}>
                직접 선택
              </button>
            </div>
            {locationMode === "auto" && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">빈 슬롯 중 첫 번째를 자동 배정합니다</p>
            )}
            {locationMode === "manual" && (
              <div className="relative">
                <select value={selectedLocationId ?? ""}
                  onChange={(e) => setSelectedLocationId(e.target.value || null)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">로케이션 선택</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.code} (구역 {loc.zone})</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* 웹캠 촬영으로 진행 버튼 */}
          <button
            onClick={() => setStep("capture")}
            disabled={locationMode === "manual" && !selectedLocationId}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50 hover:bg-blue-700 flex items-center justify-center gap-2"
          >
            다음: 영상·사진 촬영 →
          </button>

          {/* 촬영 건너뛰고 바로 입고처리 */}
          <button
            onClick={() => handleProcess()}
            disabled={processing || (locationMode === "manual" && !selectedLocationId)}
            className="w-full py-3 text-sm text-gray-400 hover:text-gray-600 border border-gray-200 rounded-xl flex items-center justify-center gap-1.5"
          >
            {processing
              ? <><Loader2 size={14} className="animate-spin" /> 처리 중...</>
              : "촬영 건너뛰고 바로 입고처리"}
          </button>

          <button onClick={resetAll} className="w-full text-sm text-gray-400 hover:text-gray-600 py-2 flex items-center justify-center gap-1">
            <RotateCcw size={13} /> 처음으로
          </button>
        </>
      )}

      {/* ─── STEP 3: 웹캠 촬영 ─── */}
      {step === "capture" && parcel && (
        <>
          <div className="bg-blue-50 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-blue-700">
            <span className="font-semibold">{parcel.customers?.name}</span>
            <span className="text-blue-400">·</span>
            <span className="font-mono text-xs">{parcel.tracking_no}</span>
          </div>

          <WebcamCapture
            items={parcel.pre_invoice_items ?? []}
            onDone={handleCaptureResult}
            onSkip={() => handleProcess()}
          />
        </>
      )}

      {/* ─── STEP 4: 완료 / 처리 중 ─── */}
      {step === "done" && (
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center space-y-4">
          {processing ? (
            <>
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
                <Loader2 size={28} className="animate-spin text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">입고처리 중...</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {uploadProgress < 70 ? "사진·영상 업로드 중" : uploadProgress < 90 ? "바코드 생성 중" : "거의 완료"}
                </p>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }} />
              </div>
            </>
          ) : result ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">입고처리 완료</h2>
                <p className="text-sm text-gray-500 mt-1">바코드 라벨이 새 탭에서 출력됩니다</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2">
                {result.location_code && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">로케이션</span>
                    <span className="font-bold text-blue-700 text-lg">{result.location_code}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">바코드 생성</span>
                  <span className="font-semibold text-gray-900">{result.barcode_count}장</span>
                </div>
                {captureResult && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">사진</span>
                    <span className="font-semibold text-gray-900">{captureResult.photos.length}장</span>
                  </div>
                )}
                {captureResult?.videoBlob && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">오픈박스 영상</span>
                    <span className="font-semibold text-green-600">저장됨</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {resultBarcodes.length > 0 && parcel && (
                  <Link
                    href={`/inbound/${parcel.id}/barcodes?data=${encodeURIComponent(JSON.stringify(buildLabelDataForDone()))}`}
                    target="_blank"
                    className="flex-1 border border-blue-200 text-blue-600 py-3 rounded-xl text-sm font-medium hover:bg-blue-50"
                  >
                    바코드 재출력
                  </Link>
                )}
                <button
                  onClick={resetAll}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700"
                >
                  다음 입고처리
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
