"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { EmsLabelData } from "@/lib/ems/label";

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
    const frame = document.getElementById("label-pdf") as HTMLIFrameElement | null;
    frame?.contentWindow?.focus();
    frame?.contentWindow?.print();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  if (error || !label) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-red-600">{error || "주문 없음"}</p>
        <Link href={`/orders/${id}`} className="text-blue-600 text-sm">← 돌아가기</Link>
      </div>
    );
  }

  const pdfUrl = `/api/admin/ems/label?order_id=${id}&format=pdf`;

  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 8rem)" }}>
      <div className="bg-gray-900 text-white px-4 py-3 flex items-center gap-4 rounded-xl flex-wrap">
        <Link href={`/orders/${id}`} className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm">
          <ArrowLeft size={15} /> 주문 상세
        </Link>
        <span className="flex-1 text-sm font-semibold min-w-[180px]">
          {label.order_no} · {label.service_label} · {label.sheet_note}
        </span>
        {label.status === "CANCELLED" && (
          <span className="text-xs text-red-300 bg-red-900/40 px-2 py-1 rounded-full">취소된 접수</span>
        )}
        {!label.ems_applied && (
          <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full">
            우체국 미접수 — 임시 출력
          </span>
        )}
        <a
          href={pdfUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm"
        >
          <ExternalLink size={14} /> PDF 열기
        </a>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Printer size={15} /> 인쇄
        </button>
      </div>
      <iframe
        id="label-pdf"
        title="해외배송 송장"
        src={pdfUrl}
        className="flex-1 w-full rounded-xl border border-gray-200 bg-white"
      />
    </div>
  );
}
