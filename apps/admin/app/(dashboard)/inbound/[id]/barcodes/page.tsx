"use client";

import { useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import Link from "next/link";

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

function LabelCard({ label }: { label: BarcodeLabel }) {
  return (
    <div className="label-card">
      <div className="label-header">
        <span className="customer-code">{label.customer_code}</span>
        <span className="customer-name">{label.customer_name}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={barcodeImgUrl(label.barcode_no)}
        alt={label.barcode_no}
        className="barcode-img"
      />
      <div className="barcode-no">{label.barcode_no}</div>
      {label.item_name && (
        <div className="item-name">{label.item_name.slice(0, 12)}</div>
      )}
      <div className="label-footer">
        {label.location_code && (
          <span className="location">{label.location_code}</span>
        )}
        <span className="date">{label.inbound_date}</span>
      </div>
    </div>
  );
}

export default function BarcodesPrintPage() {
  const searchParams = useSearchParams();
  const labelsRef = useRef<BarcodeLabel[]>([]);

  // URL 파라미터에서 라벨 데이터 파싱 (inbound/process API 결과)
  const raw = searchParams.get("data");
  const labels: BarcodeLabel[] = (() => {
    if (!raw) return [];
    try { return JSON.parse(decodeURIComponent(raw)) as BarcodeLabel[]; }
    catch { return []; }
  })();
  labelsRef.current = labels;

  const handlePrint = useCallback(() => window.print(), []);

  // autoPrint 파라미터가 있으면 자동 출력
  useEffect(() => {
    if (searchParams.get("auto") === "1" && labels.length > 0) {
      setTimeout(() => window.print(), 300);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        .label-card {
          width: 60mm;
          height: 40mm;
          border: 1px solid #ccc;
          border-radius: 4px;
          padding: 3mm 4mm;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          background: white;
          break-inside: avoid;
          page-break-inside: avoid;
          font-family: 'Malgun Gothic', sans-serif;
        }
        .label-header {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 7pt;
          color: #555;
        }
        .customer-name { font-weight: 700; color: #111; }
        .barcode-img { width: 52mm; height: 12mm; object-fit: contain; }
        .barcode-no { font-size: 8pt; font-family: monospace; font-weight: 600; letter-spacing: 0.5px; }
        .item-name {
          font-size: 7pt;
          color: #333;
          background: #f0f4ff;
          border-radius: 3px;
          padding: 1px 4px;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .label-footer {
          display: flex;
          justify-content: space-between;
          width: 100%;
          font-size: 7pt;
          color: #666;
        }
        .location { font-weight: 800; font-size: 9pt; color: #2563eb; }
        .date { color: #999; }

        /* 화면 레이아웃 */
        .labels-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 4mm;
          padding: 10mm;
        }

        /* 인쇄 스타일 */
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; }
          .labels-grid { padding: 3mm; gap: 2mm; }
          @page { size: A4; margin: 5mm; }
        }
      `}</style>

      {/* 인쇄 툴바 */}
      <div className="no-print bg-gray-900 text-white px-6 py-3 flex items-center gap-4 sticky top-0 z-50">
        <Link href="/inbound" className="text-gray-400 hover:text-white flex items-center gap-1 text-sm">
          <ArrowLeft size={14} /> 입고처리
        </Link>
        <span className="text-gray-400 text-sm flex-1">
          바코드 라벨 {labels.length}장
        </span>
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
        >
          <Printer size={15} /> 인쇄
        </button>
      </div>

      {labels.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400">
          <p>출력할 바코드 데이터가 없습니다.</p>
          <Link href="/inbound" className="mt-3 text-sm text-blue-600 hover:underline">← 입고처리로 돌아가기</Link>
        </div>
      ) : (
        <div className="labels-grid">
          {labels.map((label) => (
            <LabelCard key={label.barcode_no} label={label} />
          ))}
        </div>
      )}
    </>
  );
}
