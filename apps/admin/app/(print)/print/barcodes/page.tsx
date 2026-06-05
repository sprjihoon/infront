"use client";

import { Suspense } from "react";
import { useEffect, useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, Settings2, RotateCcw } from "lucide-react";
import Link from "next/link";
import {
  BarcodeLabelSettings,
  DEFAULT_SETTINGS,
  loadSettings,
} from "@/lib/barcode-label/settings";

interface BarcodeLabel {
  barcode_no: string;
  seq: number;
  item_name: string | null;
  customer_name: string;
  customer_code: string;
  tracking_no: string | null;
  location_code: string | null;
  inbound_date: string;
}

function barcodeImgUrl(text: string) {
  return `https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(text)}&code=Code128&dpi=203&translate-esc=on`;
}

function LabelCard({
  label,
  s,
  onImageLoad,
}: {
  label: BarcodeLabel;
  s: BarcodeLabelSettings;
  onImageLoad?: () => void;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: `${s.labelWidth}mm`,
        height: `${s.labelHeight}mm`,
        overflow: "hidden",
        border: "1px solid #ccc",
        borderRadius: "3px",
        background: "white",
        fontFamily: "'Malgun Gothic', sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={barcodeImgUrl(label.barcode_no)}
        alt={label.barcode_no}
        style={{ position: "absolute", left: `${s.barcodeImage.x}mm`, top: `${s.barcodeImage.y}mm`, width: `${s.barcodeImage.width}mm`, height: `${s.barcodeImage.height}mm`, objectFit: "contain" }}
        onLoad={onImageLoad}
        onError={onImageLoad}
      />
      {s.customerCode.show && (
        <span style={{ position: "absolute", left: `${s.customerCode.x}mm`, top: `${s.customerCode.y}mm`, fontSize: `${s.customerCode.fontSize}pt`, fontWeight: s.customerCode.bold ? 700 : 400, color: "#555", whiteSpace: "nowrap" }}>
          {label.customer_code}
        </span>
      )}
      {s.customerName.show && (
        <span style={{ position: "absolute", left: `${s.customerName.x}mm`, top: `${s.customerName.y}mm`, fontSize: `${s.customerName.fontSize}pt`, fontWeight: s.customerName.bold ? 700 : 400, color: "#111", whiteSpace: "nowrap" }}>
          {label.customer_name}
        </span>
      )}
      {s.barcodeNo.show && (
        <span style={{ position: "absolute", left: `${s.barcodeNo.x}mm`, top: `${s.barcodeNo.y}mm`, fontSize: `${s.barcodeNo.fontSize}pt`, fontWeight: s.barcodeNo.bold ? 700 : 600, fontFamily: "monospace", letterSpacing: "0.3px", whiteSpace: "nowrap" }}>
          {label.barcode_no}
        </span>
      )}
      {s.itemName.show && label.item_name && (
        <span style={{ position: "absolute", left: `${s.itemName.x}mm`, top: `${s.itemName.y}mm`, fontSize: `${s.itemName.fontSize}pt`, fontWeight: s.itemName.bold ? 700 : 400, color: "#333", background: "#f0f4ff", borderRadius: "2px", padding: "0 2px", whiteSpace: "nowrap", overflow: "hidden", maxWidth: `${s.labelWidth - s.itemName.x - 1}mm`, textOverflow: "ellipsis" }}>
          {label.item_name.slice(0, s.itemName.maxChars)}
        </span>
      )}
      {s.location.show && label.location_code && (
        <span style={{ position: "absolute", left: `${s.location.x}mm`, top: `${s.location.y}mm`, fontSize: `${s.location.fontSize}pt`, fontWeight: s.location.bold ? 700 : 400, color: "#2563eb", whiteSpace: "nowrap" }}>
          {label.location_code}
        </span>
      )}
      {s.date.show && (
        <span style={{ position: "absolute", left: `${s.date.x}mm`, top: `${s.date.y}mm`, fontSize: `${s.date.fontSize}pt`, fontWeight: s.date.bold ? 700 : 400, color: "#999", whiteSpace: "nowrap" }}>
          {label.inbound_date}
        </span>
      )}
    </div>
  );
}

/**
 * 회전 래퍼 (인라인 스타일 — CSS 미디어쿼리 !important 불필요)
 *
 * 수학적 검증: translate(W_h, 0) rotate(-90deg) with transform-origin 0 0
 *   W = labelWidth(70mm), H = labelHeight(30mm)
 *   TL(0,0) → (H,0)   TR(W,0) → (H,W)
 *   BL(0,H) → (0,0)   BR(W,H) → (0,W)
 *   결과: 0~H(x) × 0~W(y) = 30mm × 70mm 영역에 정확히 들어맞음
 */
function RotatedLabel({
  label,
  s,
  onImageLoad,
}: {
  label: BarcodeLabel;
  s: BarcodeLabelSettings;
  onImageLoad?: () => void;
}) {
  const W = s.labelWidth;   // 70mm
  const H = s.labelHeight;  // 30mm

  return (
    // 외부 박스: 회전 후 크기 (H × W = 30mm × 70mm)
    <div
      style={{
        display: "inline-block",
        width: `${H}mm`,
        height: `${W}mm`,
        position: "relative",
        overflow: "hidden",
        verticalAlign: "top",
        pageBreakInside: "avoid",
        breakInside: "avoid",
      }}
    >
      {/* 회전 컨테이너 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          transform: `translate(${H}mm, 0) rotate(-90deg)`,
          transformOrigin: "0 0",
        }}
      >
        <LabelCard label={label} s={s} onImageLoad={onImageLoad} />
      </div>
    </div>
  );
}

function PrintBarcodesContent() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<BarcodeLabelSettings>(DEFAULT_SETTINGS);
  const [rotated, setRotated] = useState(true);

  const raw = searchParams.get("data");
  const labels: BarcodeLabel[] = (() => {
    if (!raw) return [];
    try { return JSON.parse(decodeURIComponent(raw)) as BarcodeLabel[]; }
    catch { return []; }
  })();

  const isAuto = searchParams.get("auto") === "1";
  const loadedRef = useRef(0);
  const totalImages = labels.length;
  const printTriggeredRef = useRef(false);

  useEffect(() => { setSettings(loadSettings()); }, []);

  const handlePrint = useCallback(() => window.print(), []);

  const onImageLoad = useCallback(() => {
    if (!isAuto || printTriggeredRef.current) return;
    loadedRef.current += 1;
    if (loadedRef.current >= totalImages) {
      printTriggeredRef.current = true;
      setTimeout(() => window.print(), 150);
    }
  }, [isAuto, totalImages]);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background: #f5f5f5; font-family: 'Malgun Gothic', sans-serif; }
        .toolbar {
          position: sticky; top: 0; z-index: 100;
          background: #1f2937; color: white;
          display: flex; align-items: center; gap: 12px; padding: 10px 20px;
        }
        .toolbar button {
          display: flex; align-items: center; gap: 6px;
          background: #2563eb; color: white; border: none;
          border-radius: 8px; padding: 6px 14px;
          font-size: 13px; font-weight: 600; cursor: pointer;
        }
        .toolbar button.secondary {
          background: #374151;
        }
        .toolbar button.secondary.active {
          background: #7c3aed;
        }
        .toolbar button:hover { filter: brightness(1.1); }
        .toolbar a { color: #9ca3af; font-size: 12px; text-decoration: none; }
        .toolbar a:hover { color: white; text-decoration: underline; }
        .labels-area { display: flex; flex-wrap: wrap; gap: 4mm; padding: 10mm; }
        @media print {
          .toolbar { display: none !important; }
          body { background: white; }
          .labels-area { padding: 3mm; gap: 3mm; }
          @page { margin: 5mm; }
        }
      `}</style>

      <div className="toolbar">
        <span style={{ flex: 1, fontSize: 14, color: "#9ca3af" }}>
          바코드 라벨 {labels.length}장
        </span>
        <button
          className={`secondary${rotated ? " active" : ""}`}
          onClick={() => setRotated((v) => !v)}
        >
          <RotateCcw size={13} />
          {rotated ? "90° 회전 ON" : "90° 회전 OFF"}
        </button>
        <Link href="/label-editor/barcode">
          <Settings2 size={14} style={{ marginRight: 4, verticalAlign: "middle" }} />
          라벨 설정
        </Link>
        <button onClick={handlePrint}>
          <Printer size={15} /> 인쇄
        </button>
      </div>

      {labels.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", color: "#9ca3af" }}>
          <p>출력할 바코드 데이터가 없습니다.</p>
        </div>
      ) : (
        <div className="labels-area">
          {labels.map((label) =>
            rotated ? (
              <RotatedLabel key={label.barcode_no} label={label} s={settings} onImageLoad={onImageLoad} />
            ) : (
              <LabelCard key={label.barcode_no} label={label} s={settings} onImageLoad={onImageLoad} />
            )
          )}
        </div>
      )}
    </>
  );
}

export default function PrintBarcodesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>로딩 중...</div>}>
      <PrintBarcodesContent />
    </Suspense>
  );
}
