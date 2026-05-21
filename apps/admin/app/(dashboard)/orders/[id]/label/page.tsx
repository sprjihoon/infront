"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { Printer, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

// ── 타입 ────────────────────────────────────────────────────
interface LabelOrder {
  id: string;
  order_no: string;
  shipping_method: string;
  ems_regino: string | null;
  ems_fee: number | null;
  ems_premium_cd: string | null;
  recipient_name: string;
  recipient_country: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_addr1: string | null;
  recipient_addr2: string | null;
  recipient_addr3: string | null;
  recipient_zip: string | null;
  item_list: Array<{
    name_en: string;
    quantity: number;
    unit_price_usd: number;
    hs_code?: string;
    origin_country?: string;
  }>;
  customs_value: number | null;
  created_at: string;
}

// ── 상수 ────────────────────────────────────────────────────
const SERVICE_LABEL: Record<string, string> = {
  EMS: "EMS",
  EMS_PREMIUM: "EMS PREMIUM",
  KPACKET: "K-PACKET",
};

const SENDER = {
  name: process.env.NEXT_PUBLIC_SENDER_NAME ?? "INFRONT",
  addr: process.env.NEXT_PUBLIC_SENDER_ADDR ?? "1, Dongchon-ro, Dong-gu, Daegu, Korea",
  zip:  process.env.NEXT_PUBLIC_SENDER_ZIP  ?? "41500",
  tel:  process.env.NEXT_PUBLIC_SENDER_TEL  ?? "+82-",
};

// ── 바코드 이미지 URL (quickchart.io 무료 API) ──────────────
function barcodeUrl(text: string) {
  return `https://quickchart.io/barcode?type=code128&text=${encodeURIComponent(text)}&height=60&width=300&includetext=true&textxalign=center`;
}

// ── 날짜 포맷 ────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
}

// ════════════════════════════════════════════════════════════
export default function LabelPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<LabelOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then(r => r.json())
      .then(json => {
        if (json.order) setOrder(json.order as LabelOrder);
        else setError("주문을 불러올 수 없습니다.");
      })
      .catch(() => setError("네트워크 오류"))
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

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-red-600">{error || "주문 없음"}</p>
        <Link href={`/orders/${id}`} className="text-blue-600 text-sm">← 돌아가기</Link>
      </div>
    );
  }

  const items = Array.isArray(order.item_list) ? order.item_list : [];
  const svcLabel = SERVICE_LABEL[order.shipping_method] ?? order.shipping_method;
  const regino   = order.ems_regino ?? order.order_no;

  return (
    <>
      {/* ── 화면 전용 컨트롤 바 (인쇄 시 숨김) ── */}
      <div className="no-print bg-gray-900 text-white px-6 py-3 flex items-center gap-4 sticky top-0 z-50">
        <Link href={`/orders/${id}`} className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm">
          <ArrowLeft size={15} /> 주문 상세
        </Link>
        <span className="flex-1 text-sm font-semibold">{order.order_no} · EMS 라벨</span>
        {!order.ems_regino && (
          <span className="text-xs text-amber-400 bg-amber-900/30 px-2 py-1 rounded-full">
            ⚠ EMS 미접수 — 임시 출력
          </span>
        )}
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Printer size={15} /> 인쇄
        </button>
      </div>

      {/* ── 라벨 본체 ── */}
      <div className="bg-gray-100 min-h-screen p-6 no-print-bg">
        <div
          ref={printRef}
          className="bg-white mx-auto shadow-lg"
          style={{ width: "210mm", minHeight: "297mm", fontFamily: "Arial, sans-serif", fontSize: "11pt" }}
        >

          {/* ══ 상단 헤더 ══════════════════════════════════════ */}
          <div style={{ borderBottom: "3px solid #000", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "22pt", fontWeight: 900, letterSpacing: "2px" }}>{svcLabel}</div>
              <div style={{ fontSize: "9pt", color: "#555", marginTop: "2px" }}>국제특급우편 / Priority Airmail</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "9pt", color: "#333" }}>접수일: {fmtDate(order.created_at)}</div>
              <div style={{ fontSize: "9pt", color: "#333" }}>주문번호: {order.order_no}</div>
            </div>
          </div>

          {/* ══ 바코드 ════════════════════════════════════════ */}
          <div style={{ padding: "10px 14px", textAlign: "center", borderBottom: "1px solid #ddd" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={barcodeUrl(regino)}
              alt={regino}
              style={{ height: "55px", maxWidth: "100%" }}
            />
            <div style={{ fontSize: "13pt", fontWeight: 700, letterSpacing: "3px", marginTop: "4px", fontFamily: "monospace" }}>
              {regino}
            </div>
          </div>

          {/* ══ 발송인 · 수취인 ════════════════════════════════ */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", borderBottom: "2px solid #000" }}>

            {/* 발송인 */}
            <div style={{ padding: "10px 14px", borderRight: "1px solid #ccc" }}>
              <div style={{ fontSize: "9pt", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", borderBottom: "1px solid #ddd", paddingBottom: "3px" }}>
                발송인 / From
              </div>
              <div style={{ fontSize: "10pt", fontWeight: 700 }}>{SENDER.name}</div>
              <div style={{ fontSize: "9pt", marginTop: "3px", lineHeight: 1.5, color: "#333" }}>
                {SENDER.addr}
              </div>
              <div style={{ fontSize: "9pt", marginTop: "3px", color: "#333" }}>ZIP: {SENDER.zip}</div>
              <div style={{ fontSize: "9pt", color: "#333" }}>TEL: {SENDER.tel}</div>
              <div style={{ fontSize: "9pt", color: "#333" }}>KOREA (KR)</div>
            </div>

            {/* 수취인 */}
            <div style={{ padding: "10px 14px" }}>
              <div style={{ fontSize: "9pt", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", borderBottom: "1px solid #ddd", paddingBottom: "3px" }}>
                수취인 / To
              </div>
              <div style={{ fontSize: "12pt", fontWeight: 900 }}>{order.recipient_name}</div>
              {order.recipient_addr3 && (
                <div style={{ fontSize: "9pt", marginTop: "4px", lineHeight: 1.5, color: "#000" }}>
                  {order.recipient_addr3}
                  {order.recipient_addr2 && <><br />{order.recipient_addr2}</>}
                  {order.recipient_addr1 && <><br />{order.recipient_addr1}</>}
                </div>
              )}
              {!order.recipient_addr3 && (
                /* 구버전 주문 — 단일 주소 표시 */
                <div style={{ fontSize: "9pt", marginTop: "4px", lineHeight: 1.5, color: "#666", fontStyle: "italic" }}>
                  (주소 분리 미저장 — 어드민에서 확인)
                </div>
              )}
              {order.recipient_zip && (
                <div style={{ fontSize: "9pt", marginTop: "3px", color: "#333" }}>ZIP: {order.recipient_zip}</div>
              )}
              {order.recipient_phone && (
                <div style={{ fontSize: "9pt", color: "#333" }}>TEL: {order.recipient_phone}</div>
              )}
              {order.recipient_email && (
                <div style={{ fontSize: "9pt", color: "#333" }}>EMAIL: {order.recipient_email}</div>
              )}
              <div style={{ fontSize: "10pt", fontWeight: 700, marginTop: "6px", color: "#000" }}>
                {order.recipient_country}
              </div>
            </div>
          </div>

          {/* ══ 세관신고서 (CN22/CN23) ═══════════════════════ */}
          <div style={{ padding: "10px 14px 4px" }}>
            <div style={{ fontSize: "10pt", fontWeight: 700, borderBottom: "2px solid #000", paddingBottom: "4px", marginBottom: "6px", textTransform: "uppercase" }}>
              세관신고서 / Customs Declaration (CN22)
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
              <thead>
                <tr style={{ background: "#f5f5f5" }}>
                  <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "left", width: "35%" }}>품목명 / Description</th>
                  <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "10%" }}>수량 / Qty</th>
                  <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "15%" }}>단가 / Unit Price (USD)</th>
                  <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "15%" }}>총액 / Total (USD)</th>
                  <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "13%" }}>HS Code</th>
                  <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "12%" }}>원산지 / Origin</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ border: "1px solid #ccc", padding: "4px 6px" }}>{item.name_en}</td>
                    <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>{item.quantity}</td>
                    <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>{item.unit_price_usd.toFixed(2)}</td>
                    <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>
                      {(item.unit_price_usd * item.quantity).toFixed(2)}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", fontSize: "8pt" }}>
                      {item.hs_code || "-"}
                    </td>
                    <td style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center" }}>
                      {item.origin_country || "KR"}
                    </td>
                  </tr>
                ))}
                {/* 합계 행 */}
                <tr style={{ background: "#f9f9f9", fontWeight: 700 }}>
                  <td style={{ border: "1px solid #ccc", padding: "5px 6px" }}>합계 / Total</td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 6px", textAlign: "center" }}>
                    {items.reduce((s, i) => s + i.quantity, 0)}
                  </td>
                  <td style={{ border: "1px solid #ccc", padding: "5px 6px" }} />
                  <td style={{ border: "1px solid #ccc", padding: "5px 6px", textAlign: "center" }}>
                    USD {(order.customs_value ?? items.reduce((s, i) => s + i.unit_price_usd * i.quantity, 0)).toFixed(2)}
                  </td>
                  <td colSpan={2} style={{ border: "1px solid #ccc" }} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* ══ 하단 서명란 ════════════════════════════════════ */}
          <div style={{ margin: "10px 14px 0", borderTop: "1px solid #ddd", paddingTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div>
              <div style={{ fontSize: "9pt", color: "#555", marginBottom: "22px" }}>발송인 서명 / Sender&apos;s Signature</div>
              <div style={{ borderBottom: "1px solid #000", height: "1px" }} />
            </div>
            <div>
              <div style={{ fontSize: "9pt", color: "#555" }}>
                {order.ems_fee
                  ? `예상 우편요금: ₩${order.ems_fee.toLocaleString()}`
                  : "우편요금 / Postage"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "9pt", color: "#555" }}>
                우편물 종류: {svcLabel}
              </div>
              <div style={{ marginTop: "4px", fontSize: "9pt", color: "#555" }}>
                내용품유형: Merchandise
              </div>
            </div>
          </div>

          {/* ══ 안내문구 ════════════════════════════════════════ */}
          <div style={{ margin: "10px 14px 14px", fontSize: "7.5pt", color: "#888", lineHeight: 1.4, borderTop: "1px solid #eee", paddingTop: "8px" }}>
            이 우편물은 세관검사를 받을 수 있습니다. 발송인은 신고내용이 정확하고 사실임을 확인합니다.<br />
            This parcel may be opened by customs. The sender certifies that the particulars stated are correct and complete.
          </div>

        </div>
      </div>

      {/* ── 인쇄 전용 CSS ── */}
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
