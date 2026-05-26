"use client";

import type { EmsLabelData } from "@/lib/ems/label";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function EmsLabelDocument({ data }: { data: EmsLabelData }) {
  const { sender, recipient, items } = data;

  return (
    <div
      className="bg-white mx-auto shadow-lg"
      style={{ width: "210mm", minHeight: "297mm", fontFamily: "Arial, sans-serif", fontSize: "11pt" }}
    >
      <div style={{ borderBottom: "3px solid #000", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "22pt", fontWeight: 900, letterSpacing: "2px" }}>{data.service_label}</div>
          <div style={{ fontSize: "9pt", color: "#555", marginTop: "2px" }}>국제특급우편 / Priority Airmail</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "9pt", color: "#333" }}>접수일: {fmtDate(data.created_at)}</div>
          <div style={{ fontSize: "9pt", color: "#333" }}>주문번호: {data.order_no}</div>
        </div>
      </div>

      <div style={{ padding: "10px 14px", textAlign: "center", borderBottom: "1px solid #ddd" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.barcode_url} alt={data.regino} style={{ height: "55px", maxWidth: "100%" }} />
        <div style={{ fontSize: "13pt", fontWeight: 700, letterSpacing: "3px", marginTop: "4px", fontFamily: "monospace" }}>
          {data.regino}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0", borderBottom: "2px solid #000" }}>
        <div style={{ padding: "10px 14px", borderRight: "1px solid #ccc" }}>
          <div style={{ fontSize: "9pt", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", borderBottom: "1px solid #ddd", paddingBottom: "3px" }}>
            발송인 / From
          </div>
          <div style={{ fontSize: "10pt", fontWeight: 700 }}>{sender.name}</div>
          <div style={{ fontSize: "9pt", marginTop: "3px", lineHeight: 1.5, color: "#333" }}>{sender.address}</div>
          <div style={{ fontSize: "9pt", marginTop: "3px", color: "#333" }}>ZIP: {sender.zip}</div>
          <div style={{ fontSize: "9pt", color: "#333" }}>TEL: {sender.tel}</div>
          <div style={{ fontSize: "9pt", color: "#333" }}>KOREA ({sender.country})</div>
        </div>

        <div style={{ padding: "10px 14px" }}>
          <div style={{ fontSize: "9pt", fontWeight: 700, color: "#555", marginBottom: "5px", textTransform: "uppercase", borderBottom: "1px solid #ddd", paddingBottom: "3px" }}>
            수취인 / To
          </div>
          <div style={{ fontSize: "12pt", fontWeight: 900 }}>{recipient.name}</div>
          {recipient.addr3 ? (
            <div style={{ fontSize: "9pt", marginTop: "4px", lineHeight: 1.5, color: "#000" }}>
              {recipient.addr3}
              {recipient.addr2 && <><br />{recipient.addr2}</>}
              {recipient.addr1 && <><br />{recipient.addr1}</>}
            </div>
          ) : (
            <div style={{ fontSize: "9pt", marginTop: "4px", lineHeight: 1.5, color: "#666", fontStyle: "italic" }}>
              (주소 분리 미저장 — 어드민에서 확인)
            </div>
          )}
          {recipient.zip && <div style={{ fontSize: "9pt", marginTop: "3px", color: "#333" }}>ZIP: {recipient.zip}</div>}
          {recipient.phone && <div style={{ fontSize: "9pt", color: "#333" }}>TEL: {recipient.phone}</div>}
          {recipient.email && <div style={{ fontSize: "9pt", color: "#333" }}>EMAIL: {recipient.email}</div>}
          <div style={{ fontSize: "10pt", fontWeight: 700, marginTop: "6px", color: "#000" }}>{recipient.country}</div>
        </div>
      </div>

      <div style={{ padding: "10px 14px 4px" }}>
        <div style={{ fontSize: "10pt", fontWeight: 700, borderBottom: "2px solid #000", paddingBottom: "4px", marginBottom: "6px", textTransform: "uppercase" }}>
          세관신고서 / Customs Declaration (CN22)
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr style={{ background: "#f5f5f5" }}>
              <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "left", width: "35%" }}>품목명 / Description</th>
              <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "10%" }}>수량</th>
              <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "15%" }}>단가 (USD)</th>
              <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "15%" }}>총액 (USD)</th>
              <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "13%" }}>HS Code</th>
              <th style={{ border: "1px solid #ccc", padding: "4px 6px", textAlign: "center", width: "12%" }}>Origin</th>
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
            <tr style={{ background: "#f9f9f9", fontWeight: 700 }}>
              <td style={{ border: "1px solid #ccc", padding: "5px 6px" }}>합계 / Total</td>
              <td style={{ border: "1px solid #ccc", padding: "5px 6px", textAlign: "center" }}>
                {items.reduce((s, i) => s + i.quantity, 0)}
              </td>
              <td style={{ border: "1px solid #ccc", padding: "5px 6px" }} />
              <td style={{ border: "1px solid #ccc", padding: "5px 6px", textAlign: "center" }}>
                USD {data.customs_value_usd.toFixed(2)}
              </td>
              <td colSpan={2} style={{ border: "1px solid #ccc" }} />
            </tr>
          </tbody>
        </table>
        {data.insurance_enabled && (
          <p style={{ fontSize: "9pt", color: "#1d4ed8", marginTop: "8px" }}>
            보험 가입: USD {(data.insurance_amount_usd ?? data.customs_value_usd).toFixed(2)}
          </p>
        )}
      </div>

      <div style={{ margin: "10px 14px 0", borderTop: "1px solid #ddd", paddingTop: "10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        <div>
          <div style={{ fontSize: "9pt", color: "#555", marginBottom: "22px" }}>발송인 서명 / Sender&apos;s Signature</div>
          <div style={{ borderBottom: "1px solid #000", height: "1px" }} />
        </div>
        <div>
          <div style={{ fontSize: "9pt", color: "#555" }}>
            {data.ems_fee != null
              ? `예상 우편요금: ₩${data.ems_fee.toLocaleString()}`
              : "우편요금 / Postage"}
          </div>
          <div style={{ marginTop: "4px", fontSize: "9pt", color: "#555" }}>우편물 종류: {data.service_label}</div>
          <div style={{ marginTop: "4px", fontSize: "9pt", color: "#555" }}>내용품유형: Merchandise</div>
        </div>
      </div>

      <div style={{ margin: "10px 14px 14px", fontSize: "7.5pt", color: "#888", lineHeight: 1.4, borderTop: "1px solid #eee", paddingTop: "8px" }}>
        이 우편물은 세관검사를 받을 수 있습니다. 발송인은 신고내용이 정확하고 사실임을 확인합니다.
        <br />
        This parcel may be opened by customs. The sender certifies that the particulars stated are correct and complete.
      </div>
    </div>
  );
}
