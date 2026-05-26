"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft, Loader2, Download, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { EmsLabelData } from "@/lib/ems/label";
import EmsLabelDocument from "@/components/ems/EmsLabelDocument";

export default function LabelPage() {
  const { id } = useParams<{ id: string }>();
  const [label, setLabel] = useState<EmsLabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/ems/label?order_id=${id}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "라벨 조회 실패");
        setLabel(json.label as EmsLabelData);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "네트워크 오류");
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !label) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-600">{error || "주문 없음"}</p>
        <Link href={`/orders/${id}`} className="text-blue-600 text-sm">← 돌아가기</Link>
      </div>
    );
  }

  const htmlUrl = `/api/admin/ems/label?order_id=${id}&format=html`;

  return (
    <>
      <div className="no-print bg-gray-900 text-white px-6 py-3 flex items-center gap-4 sticky top-0 z-50 flex-wrap">
        <Link href={`/orders/${id}`} className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm">
          <ArrowLeft size={15} /> 주문 상세
        </Link>
        <span className="flex-1 text-sm font-semibold min-w-[140px]">{label.order_no} · EMS 라벨</span>
        {!label.ems_applied && (
          <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full">
            ⚠ EMS 미접수 — 임시 출력
          </span>
        )}
        <a
          href={htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm"
        >
          <ExternalLink size={14} /> HTML 새 창
        </a>
        <a
          href={htmlUrl}
          download
          className="flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold px-3 py-2 rounded-lg"
        >
          <Download size={14} /> HTML 저장
        </a>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Printer size={15} /> 인쇄
        </button>
      </div>

      <div className="bg-gray-100 min-h-screen p-6 no-print-bg">
        <EmsLabelDocument data={label} />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .no-print-bg { background: none !important; padding: 0 !important; }
          body { margin: 0; }
          @page { size: A4; margin: 8mm; }
        }
      `}</style>
    </>
  );
}
