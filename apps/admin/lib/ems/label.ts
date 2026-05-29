/**
 * EMS 배송 라벨 데이터 (자체 생성)
 * eship 계약 OpenAPI에는 라벨 PDF 출력 API가 문서화되어 있지 않아
 * 접수 후 orders + item_list 기반으로 CN22 형식 라벨을 생성합니다.
 */

export interface EmsLabelItem {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  hs_code?: string;
  origin_country?: string;
}

export interface EmsLabelSender {
  name: string;
  address: string;
  zip: string;
  tel: string;
  country: string;
}

export interface EmsLabelRecipient {
  name: string;
  addr1: string | null;
  addr2: string | null;
  addr3: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  country: string;
}

export interface EmsLabelData {
  source: 'internal';
  order_id: string;
  order_no: string;
  shipping_method: string;
  service_label: string;
  regino: string;
  ems_applied: boolean;
  ems_fee: number | null;
  ems_req_no: string | null;
  ems_receive_seq: string | null;
  created_at: string;
  sender: EmsLabelSender;
  recipient: EmsLabelRecipient;
  items: EmsLabelItem[];
  customs_value_usd: number;
  insurance_enabled: boolean;
  insurance_amount_usd: number | null;
  barcode_url: string;
}

const SERVICE_LABEL: Record<string, string> = {
  EMS: 'EMS',
  EMS_PREMIUM: 'EMS PREMIUM',
  KPACKET: 'K-PACKET',
};

export function barcodeUrl(text: string): string {
  return `https://quickchart.io/barcode?type=code128&text=${encodeURIComponent(text)}&height=60&width=300&includetext=true&textxalign=center`;
}

export function getLabelSender(): EmsLabelSender {
  const addrParts = [
    process.env.INFRONT_SENDER_ADDR3,
    process.env.INFRONT_SENDER_ADDR2,
    process.env.INFRONT_SENDER_ADDR1,
  ].filter(Boolean);
  const telParts = [
    process.env.INFRONT_SENDER_TEL2,
    process.env.INFRONT_SENDER_TEL3,
    process.env.INFRONT_SENDER_TEL4,
  ].filter(Boolean);

  return {
    name: process.env.INFRONT_SENDER_NAME ?? 'Infront',
    address: addrParts.length > 0
      ? addrParts.join(', ')
      : (process.env.NEXT_PUBLIC_SENDER_ADDR ?? '1, Dongchon-ro, Dong-gu, Daegu, Korea'),
    zip: (process.env.INFRONT_SENDER_ZIPCODE ?? process.env.NEXT_PUBLIC_SENDER_ZIP ?? '41500').replace(/\D/g, ''),
    tel: telParts.length > 0
      ? `+${process.env.INFRONT_SENDER_TEL1 ?? '82'}-${telParts.join('-')}`
      : (process.env.NEXT_PUBLIC_SENDER_TEL ?? '+82-'),
    country: 'KR',
  };
}

type OrderRow = {
  id: string;
  order_no: string;
  shipping_method: string | null;
  ems_regino: string | null;
  ems_fee: number | null;
  ems_req_no: string | null;
  ems_receive_seq: string | null;
  recipient_name: string | null;
  recipient_country: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_addr1: string | null;
  recipient_addr2: string | null;
  recipient_addr3: string | null;
  recipient_zip: string | null;
  item_list: unknown;
  customs_value: number | null;
  insurance_enabled: boolean | null;
  insurance_amount: number | null;
  created_at: string;
};

export function buildOrderLabelData(order: OrderRow): EmsLabelData {
  const items: EmsLabelItem[] = Array.isArray(order.item_list)
    ? (order.item_list as EmsLabelItem[])
    : [];
  const customsFromItems = items.reduce(
    (s, i) => s + i.unit_price_usd * i.quantity,
    0,
  );
  const regino = order.ems_regino ?? order.order_no;

  return {
    source: 'internal',
    order_id: order.id,
    order_no: order.order_no,
    shipping_method: order.shipping_method ?? 'EMS',
    service_label: SERVICE_LABEL[order.shipping_method ?? ''] ?? order.shipping_method ?? 'EMS',
    regino,
    ems_applied: Boolean(order.ems_regino),
    ems_fee: order.ems_fee,
    ems_req_no: order.ems_req_no,
    ems_receive_seq: order.ems_receive_seq,
    created_at: order.created_at,
    sender: getLabelSender(),
    recipient: {
      name: order.recipient_name ?? '',
      addr1: order.recipient_addr1,
      addr2: order.recipient_addr2,
      addr3: order.recipient_addr3,
      zip: order.recipient_zip,
      phone: order.recipient_phone,
      email: order.recipient_email,
      country: order.recipient_country ?? '',
    },
    items,
    customs_value_usd: Number(order.customs_value ?? customsFromItems),
    insurance_enabled: Boolean(order.insurance_enabled),
    insurance_amount_usd: order.insurance_enabled
      ? Number(order.insurance_amount ?? order.customs_value ?? customsFromItems)
      : null,
    barcode_url: barcodeUrl(regino),
  };
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 인쇄용 독립 HTML (GET ?format=html) */
export function renderLabelHtml(data: EmsLabelData): string {
  const { sender, recipient, items } = data;
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  const itemRows = items.map((item) => `
    <tr>
      <td style="border:1px solid #ccc;padding:4px 6px">${esc(item.name_en)}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:center">${item.quantity}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:center">${item.unit_price_usd.toFixed(2)}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:center">${(item.unit_price_usd * item.quantity).toFixed(2)}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:center;font-size:8pt">${esc(item.hs_code ?? '-')}</td>
      <td style="border:1px solid #ccc;padding:4px 6px;text-align:center">${esc(item.origin_country ?? 'KR')}</td>
    </tr>`).join('');

  const recipientAddr = recipient.addr3
    ? [recipient.addr3, recipient.addr2, recipient.addr1].filter((s): s is string => Boolean(s)).map(esc).join('<br />')
    : '<span style="color:#666;font-style:italic">(주소 분리 미저장)</span>';

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${esc(data.order_no)} EMS Label</title>
  <style>
    @page { size: A4; margin: 8mm; }
    @media print { body { margin: 0; } .no-print { display: none !important; } }
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 0; background: #f3f4f6; }
    .sheet { width: 210mm; min-height: 297mm; margin: 16px auto; background: #fff; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
  </style>
</head>
<body>
  <div class="no-print" style="background:#111827;color:#fff;padding:12px 20px;display:flex;gap:12px;align-items:center">
    <span style="flex:1;font-weight:600">${esc(data.order_no)} · EMS 라벨</span>
    ${data.ems_applied ? '' : '<span style="color:#fbbf24;font-size:12px">⚠ EMS 미접수 — 임시 출력</span>'}
    <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;font-weight:600">인쇄</button>
  </div>
  <div class="sheet">
    <div style="border-bottom:3px solid #000;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:22pt;font-weight:900;letter-spacing:2px">${esc(data.service_label)}</div>
        <div style="font-size:9pt;color:#555;margin-top:2px">국제특급우편 / Priority Airmail</div>
      </div>
      <div style="text-align:right;font-size:9pt;color:#333">
        <div>접수일: ${esc(fmtDate(data.created_at))}</div>
        <div>주문번호: ${esc(data.order_no)}</div>
      </div>
    </div>
    <div style="padding:10px 14px;text-align:center;border-bottom:1px solid #ddd">
      <img src="${esc(data.barcode_url)}" alt="${esc(data.regino)}" style="height:55px;max-width:100%" />
      <div style="font-size:13pt;font-weight:700;letter-spacing:3px;margin-top:4px;font-family:monospace">${esc(data.regino)}</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:2px solid #000">
      <div style="padding:10px 14px;border-right:1px solid #ccc">
        <div style="font-size:9pt;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:3px">발송인 / From</div>
        <div style="font-size:10pt;font-weight:700">${esc(sender.name)}</div>
        <div style="font-size:9pt;margin-top:3px;line-height:1.5;color:#333">${esc(sender.address)}</div>
        <div style="font-size:9pt;margin-top:3px;color:#333">ZIP: ${esc(sender.zip)}</div>
        <div style="font-size:9pt;color:#333">TEL: ${esc(sender.tel)}</div>
        <div style="font-size:9pt;color:#333">KOREA (${esc(sender.country)})</div>
      </div>
      <div style="padding:10px 14px">
        <div style="font-size:9pt;font-weight:700;color:#555;margin-bottom:5px;text-transform:uppercase;border-bottom:1px solid #ddd;padding-bottom:3px">수취인 / To</div>
        <div style="font-size:12pt;font-weight:900">${esc(recipient.name)}</div>
        <div style="font-size:9pt;margin-top:4px;line-height:1.5;color:#000">${recipientAddr}</div>
        ${recipient.zip ? `<div style="font-size:9pt;margin-top:3px;color:#333">ZIP: ${esc(recipient.zip)}</div>` : ''}
        ${recipient.phone ? `<div style="font-size:9pt;color:#333">TEL: ${esc(recipient.phone)}</div>` : ''}
        ${recipient.email ? `<div style="font-size:9pt;color:#333">EMAIL: ${esc(recipient.email)}</div>` : ''}
        <div style="font-size:10pt;font-weight:700;margin-top:6px;color:#000">${esc(recipient.country)}</div>
      </div>
    </div>
    <div style="padding:10px 14px 4px">
      <div style="font-size:10pt;font-weight:700;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:6px;text-transform:uppercase">
        세관신고서 / Customs Declaration (CN22)
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:9pt">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="border:1px solid #ccc;padding:4px 6px;text-align:left;width:35%">품목명 / Description</th>
            <th style="border:1px solid #ccc;padding:4px 6px;text-align:center;width:10%">수량</th>
            <th style="border:1px solid #ccc;padding:4px 6px;text-align:center;width:15%">단가 (USD)</th>
            <th style="border:1px solid #ccc;padding:4px 6px;text-align:center;width:15%">총액 (USD)</th>
            <th style="border:1px solid #ccc;padding:4px 6px;text-align:center;width:13%">HS Code</th>
            <th style="border:1px solid #ccc;padding:4px 6px;text-align:center;width:12%">Origin</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr style="background:#f9f9f9;font-weight:700">
            <td style="border:1px solid #ccc;padding:5px 6px">합계 / Total</td>
            <td style="border:1px solid #ccc;padding:5px 6px;text-align:center">${totalQty}</td>
            <td style="border:1px solid #ccc;padding:5px 6px"></td>
            <td style="border:1px solid #ccc;padding:5px 6px;text-align:center">USD ${data.customs_value_usd.toFixed(2)}</td>
            <td colspan="2" style="border:1px solid #ccc"></td>
          </tr>
        </tbody>
      </table>
      ${data.insurance_enabled ? `<p style="font-size:9pt;color:#1d4ed8;margin-top:8px">보험 가입: USD ${(data.insurance_amount_usd ?? data.customs_value_usd).toFixed(2)}</p>` : ''}
    </div>
    <div style="margin:10px 14px 0;border-top:1px solid #ddd;padding-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="font-size:9pt;color:#555;margin-bottom:22px">발송인 서명 / Sender&apos;s Signature</div>
        <div style="border-bottom:1px solid #000;height:1px"></div>
      </div>
      <div style="font-size:9pt;color:#555">
        <div>${data.ems_fee != null ? `예상 우편요금: ₩${data.ems_fee.toLocaleString()}` : '우편요금 / Postage'}</div>
        <div style="margin-top:4px">우편물 종류: ${esc(data.service_label)}</div>
        <div style="margin-top:4px">내용품유형: Merchandise</div>
      </div>
    </div>
    <div style="margin:10px 14px 14px;font-size:7.5pt;color:#888;line-height:1.4;border-top:1px solid #eee;padding-top:8px">
      이 우편물은 세관검사를 받을 수 있습니다. 발송인은 신고내용이 정확하고 사실임을 확인합니다.<br />
      This parcel may be opened by customs. The sender certifies that the particulars stated are correct and complete.
    </div>
  </div>
</body>
</html>`;
}
