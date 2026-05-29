"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import { DomesticLabelSheet, type DomesticLabelData } from "@/components/epost/DomesticLabelSheet";

export default function DomesticLabelPage() {
  const { id } = useParams<{ id: string }>();
  const [label, setLabel] = useState<DomesticLabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/epost/label-domestic?domestic_order_id=${id}`);
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "라벨 조회 실패"); setLoading(false); return; }
    setLabel(json.label as DomesticLabelData);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

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
        <p className="text-red-600">{error || "국내 배송 신청 없음"}</p>
        <Link href={`/domestic-orders/${id}`} className="text-blue-600 text-sm">← 돌아가기</Link>
      </div>
    );
  }

  return (
    <>
      <div className="no-print bg-gray-900 text-white px-6 py-3 flex items-center gap-4 sticky top-0 z-50">
        <Link href={`/domestic-orders/${id}`} className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm">
          <ArrowLeft size={15} /> 신청 상세
        </Link>
        <span className="flex-1 text-sm font-semibold">
          {label.orderNumber} · 국내 소포 라벨
        </span>
        {!label.trackingNo && (
          <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full">
            ⚠ 우체국 미접수 — 임시 출력
          </span>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Printer size={15} /> 인쇄
        </button>
      </div>

      <div className="bg-gray-100 min-h-screen p-6 no-print-bg">
        <DomesticLabelSheet data={label} />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .no-print-bg { background: none !important; padding: 0 !important; }
          body { margin: 0; }
          @page { size: 168mm 107mm; margin: 0; }
        }
      `}</style>
    </>
  );
}
