"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Upload, AlertCircle } from "lucide-react";

interface Props {
  locationCode: string;
  onConfirm: (blob: Blob) => void;
  uploading?: boolean;
}

export default function PutawayPhotoCapture({ locationCode, onConfirm, uploading = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [camReady, setCamReady] = useState(false);
  const [camError, setCamError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    let active = true;
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      .then((stream) => {
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCamReady(true);
      })
      .catch((err) => {
        if (!active) return;
        setCamError(
          err.name === "NotAllowedError"
            ? "카메라 권한이 필요합니다."
            : "카메라를 사용할 수 없습니다. 아래 파일 업로드를 이용하세요.",
        );
      });

    return () => {
      active = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const setBlobPreview = useCallback((blob: Blob) => {
    setPhotoBlob(blob);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }, []);

  function captureFromCamera() {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCapturing(false);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        setCapturing(false);
        if (blob) setBlobPreview(blob);
      },
      "image/jpeg",
      0.92,
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setBlobPreview(file);
  }

  function resetPhoto() {
    setPhotoBlob(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
          ③ 적치 확인 사진 (필수 1장)
        </p>
        <p className="text-sm text-gray-600">
          <span className="font-mono font-bold text-indigo-700">{locationCode}</span>
          {" "}에 넣은 상태를 촬영해주세요
        </p>
      </div>

      <div className="p-5 space-y-4">
        {previewUrl ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="적치 확인"
              className="w-full rounded-xl border border-gray-200 object-cover max-h-64"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetPhoto}
                disabled={uploading}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-1.5"
              >
                <RotateCcw size={15} />
                다시 촬영
              </button>
              <button
                type="button"
                onClick={() => photoBlob && onConfirm(photoBlob)}
                disabled={uploading || !photoBlob}
                className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {uploading ? (
                  <><Loader2 size={15} className="animate-spin" /> 업로드 중...</>
                ) : (
                  <><Upload size={15} /> 사진 등록</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <>
            {camError ? (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{camError}</span>
              </div>
            ) : (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {!camReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                    <Loader2 size={24} className="animate-spin text-white" />
                  </div>
                )}
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-2">
              {!camError && (
                <button
                  type="button"
                  onClick={captureFromCamera}
                  disabled={!camReady || capturing}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {capturing ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Camera size={16} />
                  )}
                  촬영
                </button>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Upload size={16} />
                파일 선택
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>
    </div>
  );
}
