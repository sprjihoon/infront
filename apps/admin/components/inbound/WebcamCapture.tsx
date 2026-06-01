"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Video, Square, Camera, X, Loader2, AlertCircle, Plus } from "lucide-react";

export interface CapturedPhoto {
  itemIdx: number;    // pre_invoice_items 인덱스 (-1 = 미분류)
  itemName: string;   // 품목명 태그
  blob: Blob;
  dataUrl: string;
  capturedAt: number; // timestamp
}

export interface WebcamCaptureResult {
  videoBlob: Blob | null;
  photos: CapturedPhoto[];
}

interface ItemSlot {
  idx: number;
  name: string;
  quantity: number;
  captured: number;  // 이 품목으로 캡처된 수
}

interface Props {
  items: Array<{ name_en?: string; name_ko?: string; quantity?: number }>;
  onDone: (result: WebcamCaptureResult) => void;
  onSkip: () => void;
}

export default function WebcamCapture({ items, onDone, onSkip }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState("");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [slots, setSlots] = useState<ItemSlot[]>([]);
  const [capturing, setCapturing] = useState(false);

  // 품목 슬롯 초기화
  useEffect(() => {
    if (items.length > 0) {
      setSlots(items.map((it, idx) => ({
        idx,
        name: (it.name_ko || it.name_en || `품목 ${idx + 1}`).slice(0, 14),
        quantity: Math.max(1, Number(it.quantity) || 1),
        captured: 0,
      })));
    } else {
      setSlots([{ idx: -1, name: "미등록 물품", quantity: 1, captured: 0 }]);
    }
  }, [items]);

  // 웹캠 시작
  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCamReady(true);
      })
      .catch((err) => {
        if (!active) return;
        setCamError(err.name === "NotAllowedError"
          ? "카메라 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요."
          : `카메라를 열 수 없습니다: ${err.message}`);
      });
    return () => {
      active = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // 녹화 타이머
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  function fmtTime(s: number) {
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  // 녹화 시작
  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "";
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.start(1000);
    recorderRef.current = recorder;
    setRecording(true);
    setElapsed(0);
  }

  // 녹화 종료 + 완료
  function stopAndDone() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        const videoBlob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        streamRef.current?.getTracks().forEach(t => t.stop());
        onDone({ videoBlob, photos });
      };
      recorder.stop();
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onDone({ videoBlob: null, photos });
    }
    setRecording(false);
  }

  // 프레임 캡처
  const capturePhoto = useCallback((slot: ItemSlot) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !camReady) return;

    setCapturing(true);
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) { setCapturing(false); return; }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      const photo: CapturedPhoto = {
        itemIdx: slot.idx,
        itemName: slot.name,
        blob,
        dataUrl,
        capturedAt: Date.now(),
      };
      setPhotos(prev => [...prev, photo]);
      setSlots(prev => prev.map(s =>
        s.idx === slot.idx ? { ...s, captured: s.captured + 1 } : s
      ));
      setCapturing(false);
    }, "image/jpeg", 0.88);
  }, [camReady]);

  // 사진 삭제
  function removePhoto(capturedAt: number, itemIdx: number) {
    setPhotos(prev => prev.filter(p => p.capturedAt !== capturedAt));
    setSlots(prev => prev.map(s =>
      s.idx === itemIdx ? { ...s, captured: Math.max(0, s.captured - 1) } : s
    ));
  }

  const allCaptured = slots.every(s => s.captured >= s.quantity);

  if (camError) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-start gap-3 bg-red-50 rounded-xl p-4">
          <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{camError}</p>
        </div>
        <button onClick={onSkip} className="w-full py-3 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">
          카메라 없이 계속하기
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* 웹캠 뷰 */}
      <div className="relative bg-black aspect-video">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* 녹화 상태 배지 */}
        {recording && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 text-white text-xs px-2.5 py-1.5 rounded-full">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            REC {fmtTime(elapsed)}
          </div>
        )}

        {!camReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={32} className="text-white animate-spin" />
          </div>
        )}
      </div>

      {/* 녹화 컨트롤 */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        {!recording ? (
          <button
            onClick={startRecording}
            disabled={!camReady}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-40 hover:bg-red-700"
          >
            <Video size={15} /> 녹화 시작
          </button>
        ) : (
          <button
            onClick={stopAndDone}
            className="flex items-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-gray-900"
          >
            <Square size={13} fill="white" /> 완료
          </button>
        )}
        <span className="text-xs text-gray-400 flex-1">
          {!recording ? "녹화를 시작하세요" : "제품별 캡처 버튼을 눌러주세요"}
        </span>
        <button onClick={onSkip} className="text-xs text-gray-400 hover:text-gray-600 underline">
          건너뛰기
        </button>
      </div>

      {/* 품목별 캡처 버튼 */}
      <div className="px-4 pb-3">
        <p className="text-xs font-medium text-gray-500 mb-2">제품을 꺼낼 때 해당 버튼 클릭</p>
        <div className="flex flex-wrap gap-2">
          {slots.map((slot) => {
            const done = slot.captured >= slot.quantity;
            return (
              <button
                key={slot.idx}
                onClick={() => capturePhoto(slot)}
                disabled={capturing || !camReady}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all disabled:opacity-50 ${
                  done
                    ? "bg-green-50 border-green-200 text-green-700"
                    : "bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50 active:scale-95"
                }`}
              >
                <Camera size={13} />
                <span>{slot.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  done ? "bg-green-200 text-green-800" : "bg-gray-100 text-gray-500"
                }`}>
                  {slot.captured}/{slot.quantity}
                </span>
              </button>
            );
          })}
          {/* 미분류 캡처 버튼 */}
          <button
            onClick={() => capturePhoto({ idx: -1, name: "기타", quantity: 999, captured: 0 })}
            disabled={capturing || !camReady}
            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs border border-dashed border-gray-200 text-gray-400 hover:border-gray-300 disabled:opacity-40"
          >
            <Plus size={11} /> 기타
          </button>
        </div>
      </div>

      {/* 캡처된 사진 미리보기 */}
      {photos.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-50 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-gray-500">캡처된 사진 ({photos.length}장)</p>
            {allCaptured && (
              <span className="text-xs text-green-600 font-semibold">✓ 전 품목 완료</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {photos.map((photo) => (
              <div key={photo.capturedAt} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.dataUrl}
                  alt={photo.itemName}
                  className="w-16 h-16 object-cover rounded-lg border border-gray-100"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] text-center px-1 py-0.5 rounded-b-lg truncate">
                  {photo.itemName}
                </div>
                <button
                  onClick={() => removePhoto(photo.capturedAt, photo.itemIdx)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 녹화 없이 사진만 완료 버튼 */}
      {!recording && photos.length > 0 && (
        <div className="px-4 pb-4">
          <button
            onClick={() => {
              streamRef.current?.getTracks().forEach(t => t.stop());
              onDone({ videoBlob: null, photos });
            }}
            className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700"
          >
            사진만 저장하고 계속
          </button>
        </div>
      )}
    </div>
  );
}
