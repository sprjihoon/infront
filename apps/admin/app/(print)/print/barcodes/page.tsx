"use client";

import { Suspense } from "react";
import { useEffect, useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, Settings2 } from "lucide-react";
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
      className="label-card"
      style={{ position: "relative", width: `${s.labelWidth}mm`, height: `${s.labelHeight}mm`, overflow: "hidden" }}
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

// useSearchParams를 사용하는 내부 컴포넌트
function PrintBarcodesContent() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<BarcodeLabelSettings>(DEFAULT_SETTINGS);

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
          border-radius: 8px; padding: 6px 16px;
          font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .toolbar button:hover { background: #1d4ed8; }
        .toolbar a { color: #9ca3af; font-size: 12px; text-decoration: none; }
        .toolbar a:hover { color: white; text-decoration: underline; }
        .label-card {
          border: 1px solid #ccc; border-radius: 3px; background: white;
          break-inside: avoid; page-break-inside: avoid;
        }
        .labels-grid { display: flex; flex-wrap: wrap; gap: 4mm; padding: 10mm; }
        @media print {
          .toolbar { display: none !important; }
          body { background: white; }
          .labels-grid { padding: 3mm; gap: 2mm; }
          @page { size: A4; margin: 5mm; }
        }
      `}</style>

      <div className="toolbar">
        <span style={{ flex: 1, fontSize: 14, color: "#9ca3af" }}>
          바코드 라벨 {labels.length}장
        </span>
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
        <div className="labels-grid">
          {labels.map((label) => (
            <LabelCard key={label.barcode_no} label={label} s={settings} onImageLoad={onImageLoad} />
          ))}
        </div>
      )}
    </>
  );
}

// Suspense 래퍼 — useSearchParams 빌드 오류 방지
export default function PrintBarcodesPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>로딩 중...</div>}>
      <PrintBarcodesContent />
    </Suspense>
  );
}
