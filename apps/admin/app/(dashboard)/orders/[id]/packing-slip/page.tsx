"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer, Loader2, Package } from "lucide-react";

interface InvoiceItem {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
  hs_code?: string;
}

interface OrderParcel {
  parcel_id: string;
  parcels: {
    id: string;
    tracking_no: string | null;
    weight_actual: number | null;
    vol_length: number | null;
    vol_width: number | null;
    vol_height: number | null;
    pre_invoice_items: InvoiceItem[] | null;
    item_condition: string | null;
  } | null;
}

interface BoxItem {
  id: string;
  parcel_id: string;
  item_index: number;
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  origin_country: string;
  hs_code?: string;
  item_condition?: string;
}

interface ShippingBox {
  id: string;
  box_seq: number;
  weight_kg: number | null;
  length_cm: number | null;
  width_cm: number | null;
  height_cm: number | null;
  intl_tracking_no: string | null;
  carrier: string | null;
  status: string;
  admin_notes: string | null;
  box_items: BoxItem[];
}

interface Order {
  id: string;
  order_no: string;
  status: string;
  shipping_method: string;
  recipient_name: string;
  recipient_country: string;
  recipient_address: string;
  recipient_phone: string | null;
  recipient_addr1: string | null;
  recipient_addr2: string | null;
  recipient_addr3: string | null;
  recipient_zip: string | null;
  recipient_email: string | null;
  customs_value: number | null;
  created_at: string;
  customers: { name: string; email: string; customer_code: string } | null;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function PackingSlipPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [orderParcels, setOrderParcels] = useState<OrderParcel[]>([]);
  const [shippingBoxes, setShippingBoxes] = useState<ShippingBox[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error ?? "주문 조회 실패");
        setOrder(json.order);
        setOrderParcels(json.orderParcels ?? []);
        setShippingBoxes(json.shippingBoxes ?? []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "오류"))
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = useCallback(() => window.print(), []);

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

  const customer = order.customers;
  const totalItems = orderParcels.reduce(
    (sum, op) => sum + (op.parcels?.pre_invoice_items?.length ?? 0),
    0,
  );
  const totalWeight = orderParcels.reduce(
    (sum, op) => sum + (op.parcels?.weight_actual ?? 0),
    0,
  );

  return (
    <>
      {/* 인쇄 제어 바 (화면에만 표시) */}
      <div className="no-print bg-gray-900 text-white px-6 py-3 flex items-center gap-4 sticky top-0 z-50">
        <Link href={`/orders/${id}`} className="flex items-center gap-1.5 text-gray-300 hover:text-white text-sm">
          <ArrowLeft size={15} /> 주문 상세
        </Link>
        <span className="flex-1 text-sm font-semibold">{order.order_no} · 출고지시서</span>
        <button
          type="button"
          onClick={handlePrint}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Printer size={15} /> 인쇄
        </button>
      </div>

      {/* 인쇄 본문 */}
      <div className="no-print-bg bg-gray-100 min-h-screen p-6 print:p-0 print:bg-white">
        <div
          className="bg-white mx-auto shadow-lg print:shadow-none"
          style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Noto Sans KR', sans-serif", fontSize: "10pt" }}
        >
          {/* ── 헤더 ── */}
          <div style={{ borderBottom: "3px solid #000", padding: "12px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "18pt", fontWeight: 900, letterSpacing: "1px" }}>출 고 지 시 서</div>
              <div style={{ fontSize: "8pt", color: "#666", marginTop: "2px" }}>PACKING / SHIPPING INSTRUCTION</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "9pt" }}>
              <div style={{ fontWeight: 700, fontSize: "11pt" }}>{order.order_no}</div>
              <div style={{ color: "#555", marginTop: "2px" }}>출력일: {fmtDate(new Date().toISOString())}</div>
              <div style={{ color: "#555" }}>신청일: {fmtDate(order.created_at)}</div>
            </div>
          </div>

          <div style={{ padding: "12px 16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

            {/* ── 고객 / 수취인 정보 ── */}
            <div style={{ border: "1px solid #ccc", borderRadius: "6px", padding: "10px" }}>
              <div style={{ fontWeight: 700, fontSize: "9pt", color: "#333", borderBottom: "1px solid #eee", paddingBottom: "4px", marginBottom: "6px" }}>
                📦 발송인 (고객)
              </div>
              <table style={{ width: "100%", fontSize: "9pt", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "#666", width: "60px", paddingBottom: "3px" }}>고객명</td>
                    <td style={{ fontWeight: 600 }}>{customer?.name ?? "-"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#666", paddingBottom: "3px" }}>고객번호</td>
                    <td style={{ fontFamily: "monospace" }}>{customer?.customer_code ?? "-"}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#666", paddingBottom: "3px" }}>이메일</td>
                    <td>{customer?.email ?? "-"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ border: "1px solid #ccc", borderRadius: "6px", padding: "10px" }}>
              <div style={{ fontWeight: 700, fontSize: "9pt", color: "#333", borderBottom: "1px solid #eee", paddingBottom: "4px", marginBottom: "6px" }}>
                ✈ 수취인 (Recipient)
              </div>
              <table style={{ width: "100%", fontSize: "9pt", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ color: "#666", width: "60px", paddingBottom: "3px" }}>이름</td>
                    <td style={{ fontWeight: 600 }}>{order.recipient_name}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#666", paddingBottom: "3px" }}>국가</td>
                    <td>{order.recipient_country}</td>
                  </tr>
                  <tr>
                    <td style={{ color: "#666", paddingBottom: "3px" }}>주소</td>
                    <td style={{ wordBreak: "break-all" }}>
                      {[order.recipient_addr3, order.recipient_addr2, order.recipient_addr1]
                        .filter(Boolean)
                        .join(", ") || order.recipient_address}
                    </td>
                  </tr>
                  {order.recipient_zip && (
                    <tr>
                      <td style={{ color: "#666", paddingBottom: "3px" }}>우편번호</td>
                      <td>{order.recipient_zip}</td>
                    </tr>
                  )}
                  {order.recipient_phone && (
                    <tr>
                      <td style={{ color: "#666", paddingBottom: "3px" }}>전화</td>
                      <td>{order.recipient_phone}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── 배송 정보 요약 ── */}
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ background: "#f0f4ff", border: "1px solid #c7d4f0", borderRadius: "6px", padding: "8px 12px", display: "flex", gap: "24px", fontSize: "9pt" }}>
              <span><strong>배송방법:</strong> {order.shipping_method}</span>
              <span><strong>소포 수:</strong> {orderParcels.length}개</span>
              <span><strong>총 품목:</strong> {totalItems}종</span>
              {totalWeight > 0 && <span><strong>합계 무게:</strong> {(totalWeight / 1000).toFixed(2)}kg</span>}
              {order.customs_value && <span><strong>신고가액:</strong> USD {Number(order.customs_value).toFixed(2)}</span>}
            </div>
          </div>

          {/* ── 소포별 물품 목록 ── */}
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
              <Package size={14} style={{ display: "inline" }} />
              소포별 물품 내역
            </div>
            {orderParcels.map((op, parcelIdx) => {
              const p = op.parcels;
              const items = p?.pre_invoice_items ?? [];
              return (
                <div key={op.parcel_id} style={{ marginBottom: "12px", border: "1px solid #ddd", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{ background: "#f8f8f8", borderBottom: "1px solid #ddd", padding: "6px 10px", display: "flex", justifyContent: "space-between", fontSize: "9pt" }}>
                    <span style={{ fontWeight: 700 }}>소포 {parcelIdx + 1} — {p?.tracking_no ?? "미등록"}</span>
                    <span style={{ color: "#555" }}>
                      {p?.weight_actual ? `${(p.weight_actual / 1000).toFixed(2)}kg` : "무게 미입력"}
                      {p?.vol_length ? ` · ${p.vol_length}×${p.vol_width}×${p.vol_height}cm` : ""}
                      {p?.item_condition === "NEW" ? " · 신품" : p?.item_condition === "USED" ? " · 중고" : ""}
                    </span>
                  </div>
                  {items.length === 0 ? (
                    <div style={{ padding: "8px 10px", color: "#999", fontSize: "9pt" }}>물품 정보 없음</div>
                  ) : (
                    <table style={{ width: "100%", fontSize: "8.5pt", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#fafafa" }}>
                          <th style={{ textAlign: "left", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600 }}>품목 (영문)</th>
                          <th style={{ textAlign: "center", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600, width: "50px" }}>수량</th>
                          <th style={{ textAlign: "right", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600, width: "80px" }}>단가 (USD)</th>
                          <th style={{ textAlign: "center", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600, width: "60px" }}>원산지</th>
                          <th style={{ textAlign: "center", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600, width: "80px" }}>HS Code</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "5px 10px" }}>{item.name_en}</td>
                            <td style={{ textAlign: "center", padding: "5px 10px" }}>{item.quantity}</td>
                            <td style={{ textAlign: "right", padding: "5px 10px", fontFamily: "monospace" }}>${item.unit_price_usd.toFixed(2)}</td>
                            <td style={{ textAlign: "center", padding: "5px 10px" }}>{item.origin_country}</td>
                            <td style={{ textAlign: "center", padding: "5px 10px", fontFamily: "monospace" }}>{item.hs_code || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── 박스 구성 (shipping_boxes) ── */}
          {shippingBoxes.length > 0 && (
            <div style={{ padding: "0 16px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: "10pt", marginBottom: "8px" }}>📫 출고 박스 구성</div>
              {shippingBoxes.map((box) => (
                <div key={box.id} style={{ marginBottom: "10px", border: "1px solid #ddd", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{ background: "#f0f8f0", borderBottom: "1px solid #ddd", padding: "6px 10px", display: "flex", justifyContent: "space-between", fontSize: "9pt" }}>
                    <span style={{ fontWeight: 700 }}>
                      박스 {box.box_seq}
                      {box.carrier && ` — ${box.carrier}`}
                    </span>
                    <span style={{ color: "#555" }}>
                      {box.intl_tracking_no ? (
                        <span style={{ fontFamily: "monospace", fontWeight: 600 }}>송장: {box.intl_tracking_no}</span>
                      ) : (
                        <span style={{ color: "#e57" }}>송장 미입력</span>
                      )}
                      {box.weight_kg && ` · ${box.weight_kg}kg`}
                      {box.length_cm && ` · ${box.length_cm}×${box.width_cm}×${box.height_cm}cm`}
                    </span>
                  </div>
                  {box.box_items.length > 0 ? (
                    <table style={{ width: "100%", fontSize: "8.5pt", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#fafafa" }}>
                          <th style={{ textAlign: "left", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600 }}>품목</th>
                          <th style={{ textAlign: "center", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600, width: "50px" }}>수량</th>
                          <th style={{ textAlign: "right", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600, width: "80px" }}>단가 (USD)</th>
                          <th style={{ textAlign: "center", padding: "4px 10px", borderBottom: "1px solid #eee", color: "#555", fontWeight: 600, width: "60px" }}>원산지</th>
                        </tr>
                      </thead>
                      <tbody>
                        {box.box_items.map((item) => (
                          <tr key={item.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "5px 10px" }}>{item.name_en}</td>
                            <td style={{ textAlign: "center", padding: "5px 10px" }}>{item.quantity}</td>
                            <td style={{ textAlign: "right", padding: "5px 10px", fontFamily: "monospace" }}>${item.unit_price_usd.toFixed(2)}</td>
                            <td style={{ textAlign: "center", padding: "5px 10px" }}>{item.origin_country}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ padding: "7px 10px", color: "#aaa", fontSize: "9pt" }}>배정된 품목 없음</div>
                  )}
                  {box.admin_notes && (
                    <div style={{ padding: "5px 10px", borderTop: "1px solid #eee", fontSize: "8.5pt", color: "#777", fontStyle: "italic" }}>
                      메모: {box.admin_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── 작업자 확인란 ── */}
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ border: "1px solid #ccc", borderRadius: "6px", padding: "10px 12px" }}>
              <div style={{ fontWeight: 700, fontSize: "9pt", marginBottom: "8px" }}>✅ 작업자 확인</div>
              <table style={{ width: "100%", fontSize: "9pt", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    ["물품 수량 확인", ""],
                    ["포장 완료", ""],
                    ["송장 부착 확인", ""],
                    ["작업자 서명", ""],
                    ["확인 일시", ""],
                  ].map(([label]) => (
                    <tr key={label}>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #f0f0f0", width: "120px", color: "#555" }}>{label}</td>
                      <td style={{ padding: "5px 8px", borderBottom: "1px solid #f0f0f0", borderLeft: "1px solid #eee" }}>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
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
