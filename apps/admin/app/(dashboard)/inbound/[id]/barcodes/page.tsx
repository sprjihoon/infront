"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
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

// 절대 위치 기반 라벨 카드
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
      style={{
        position: "relative",
        width: `${s.labelWidth}mm`,
        height: `${s.labelHeight}mm`,
        overflow: "hidden",
      }}
    >
      {/* 바코드 이미지 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={barcodeImgUrl(label.barcode_no)}
        alt={label.barcode_no}
        style={{
          position: "absolute",
          left: `${s.barcodeImage.x}mm`,
          top: `${s.barcodeImage.y}mm`,
          width: `${s.barcodeImage.width}mm`,
          height: `${s.barcodeImage.height}mm`,
          objectFit: "contain",
        }}
        onLoad={onImageLoad}
        onError={onImageLoad}
      />

      {/* 고객 코드 */}
      {s.customerCode.show && (
        <span
          style={{
            position: "absolute",
            left: `${s.customerCode.x}mm`,
            top: `${s.customerCode.y}mm`,
            fontSize: `${s.customerCode.fontSize}pt`,
            fontWeight: s.customerCode.bold ? 700 : 400,
            color: "#555",
            whiteSpace: "nowrap",
          }}
        >
          {label.customer_code}
        </span>
      )}

      {/* 고객명 */}
      {s.customerName.show && (
        <span
          style={{
            position: "absolute",
            left: `${s.customerName.x}mm`,
            top: `${s.customerName.y}mm`,
            fontSize: `${s.customerName.fontSize}pt`,
            fontWeight: s.customerName.bold ? 700 : 400,
            color: "#111",
            whiteSpace: "nowrap",
          }}
        >
          {label.customer_name}
        </span>
      )}

      {/* 바코드 번호 */}
      {s.barcodeNo.show && (
        <span
          style={{
            position: "absolute",
            left: `${s.barcodeNo.x}mm`,
            top: `${s.barcodeNo.y}mm`,
            fontSize: `${s.barcodeNo.fontSize}pt`,
            fontWeight: s.barcodeNo.bold ? 700 : 600,
            fontFamily: "monospace",
            letterSpacing: "0.3px",
            whiteSpace: "nowrap",
          }}
        >
          {label.barcode_no}
        </span>
      )}

      {/* 상품명 */}
      {s.itemName.show && label.item_name && (
        <span
          style={{
            position: "absolute",
            left: `${s.itemName.x}mm`,
            top: `${s.itemName.y}mm`,
            fontSize: `${s.itemName.fontSize}pt`,
            fontWeight: s.itemName.bold ? 700 : 400,
            color: "#333",
            background: "#f0f4ff",
            borderRadius: "2px",
            padding: "0 2px",
            whiteSpace: "nowrap",
            overflow: "hidden",
            maxWidth: `${s.labelWidth - s.itemName.x - 1}mm`,
            textOverflow: "ellipsis",
          }}
        >
          {label.item_name.slice(0, s.itemName.maxChars)}
        </span>
      )}

      {/* 로케이션 */}
      {s.location.show && label.location_code && (
        <span
          style={{
            position: "absolute",
            left: `${s.location.x}mm`,
            top: `${s.location.y}mm`,
            fontSize: `${s.location.fontSize}pt`,
            fontWeight: s.location.bold ? 700 : 400,
            color: "#2563eb",
            whiteSpace: "nowrap",
          }}
        >
          {label.location_code}
        </span>
      )}

      {/* 날짜 */}
      {s.date.show && (
        <span
          style={{
            position: "absolute",
            left: `${s.date.x}mm`,
            top: `${s.date.y}mm`,
            fontSize: `${s.date.fontSize}pt`,
            fontWeight: s.date.bold ? 700 : 400,
            color: "#999",
            whiteSpace: "nowrap",
          }}
        >
          {label.inbound_date}
        </span>
      )}
    </div>
  );
}

export default function BarcodesPrintPage() {
  const searchParams = useSearchParams();
  const [settings, setSettings] = useState<BarcodeLabelSettings>(DEFAULT_SETTINGS);

  const raw = searchParams.get("data");
  const labels: BarcodeLabel[] = (() => {
    if (!raw) return [];
    try {
      return JSON.parse(decodeURIComponent(raw)) as BarcodeLabel[];
    } catch {
      return [];
    }
  })();

  const isAuto = searchParams.get("auto") === "1";
  const loadedRef = useRef(0);
  const totalImages = labels.length;
  const printTriggeredRef = useRef(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handlePrint = useCallback(() => window.print(), []);

  // 모든 이미지 로드 완료 후 자동 인쇄
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
        .label-card {
          border: 1px solid #ccc;
          border-radius: 3px;
          background: white;
          break-inside: avoid;
          page-break-inside: avoid;
          font-family: 'Malgun Gothic', sans-serif;
          box-sizing: border-box;
        }
        .labels-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 4mm;
          padding: 10mm;
        }
        @media print {
          /* 페이지 전체를 숨기고 라벨만 표시 */
          html body * { visibility: hidden !important; }
          .labels-print-root,
          .labels-print-root * { visibility: visible !important; }
          .labels-print-root {
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            background: white !important;
            z-index: 99999 !important;
          }
          .no-print { display: none !important; }
          .labels-grid { padding: 3mm; gap: 2mm; }
          @page { size: A4; margin: 5mm; }
        }
      `}</style>

      {/* 인쇄 툴바 */}
      <div className="no-print bg-gray-900 text-white px-6 py-3 flex items-center gap-4 sticky top-0 z-50">
        <Link
          href="/inbound"
          className="text-gray-400 hover:text-white flex items-center gap-1 text-sm"
        >
          <ArrowLeft size={14} /> 입고처리
        </Link>
        <span className="text-gray-400 text-sm flex-1">
          바코드 라벨 {labels.length}장
        </span>
        <Link
          href="/label-editor/barcode"
          className="text-gray-400 hover:text-white text-xs hover:underline underline-offset-2"
        >
          라벨 설정
        </Link>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
        >
          <Printer size={15} /> 인쇄
        </button>
      </div>

      {/* 라벨 인쇄 영역 — 이 div만 print에 표시됨 */}
      <div className="labels-print-root">
        {labels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <p>출력할 바코드 데이터가 없습니다.</p>
            <Link
              href="/inbound"
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              ← 입고처리로 돌아가기
            </Link>
          </div>
        ) : (
          <div className="labels-grid">
            {labels.map((label) => (
              <LabelCard
                key={label.barcode_no}
                label={label}
                s={settings}
                onImageLoad={onImageLoad}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
