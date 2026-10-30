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
  sheet_note: string;
  status: string;
}

export interface OfficialLabelItem {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
  print_hs: string;
  net_weight_g: string;
  origin_country: string;
}

export interface OfficialLabelData {
  order_no: string;
  shipping_method: string;
  regino: string;
  status: string;
  ems_fee: number | null;
  totweight: number;
  volume_weight: number | null;
  boxlength: number;
  boxwidth: number;
  boxheight: number;
  contents_type: string;
  posted_year: string;
  posted_month: string;
  posted_day: string;
  posted_hour: string;
  posted_min: string;
  post_office: string;
  post_office_code: string;
  sender: { name: string; tel: string; address: string; zip: string };
  recipient: {
    name: string;
    phone: string;
    email: string;
    addr1: string;
    addr2: string;
    addr3: string;
    zip: string;
    country: string;
    country_name: string;
  };
  items: OfficialLabelItem[];
}

export interface LabelBoxRow {
  box_seq?: number | null;
  weight_kg?: number | null;
  length_cm?: number | null;
  width_cm?: number | null;
  height_cm?: number | null;
  intl_tracking_no?: string | null;
}

const SERVICE_LABEL: Record<string, string> = {
  EMS: 'EMS',
  EMS_PREMIUM: 'EMS PREMIUM',
  KPACKET: 'K-PACKET',
};

const METHOD_BY_PREMIUM: Record<string, string> = {
  '31': 'EMS',
  '32': 'EMS_PREMIUM',
  '14': 'KPACKET',
};

const SENDER_NAME_EN: Record<string, string> = {
  틸리언: 'Tillion',
  스프링풀필먼트: 'Spring Fulfillment',
};

const NATION_FN: Record<string, string> = {
  JP: 'JAPAN', US: 'UNITED STATES', CN: 'CHINA', HK: 'HONG KONG', TW: 'TAIWAN',
  SG: 'SINGAPORE', TH: 'THAILAND', VN: 'VIETNAM', MY: 'MALAYSIA', PH: 'PHILIPPINES',
  AU: 'AUSTRALIA', GB: 'UNITED KINGDOM', DE: 'GERMANY', FR: 'FRANCE', CA: 'CANADA',
  NZ: 'NEW ZEALAND', ID: 'INDONESIA', IT: 'ITALY', ES: 'SPAIN', NL: 'NETHERLANDS',
  MO: 'MACAO', MN: 'MONGOLIA', IN: 'INDIA', AE: 'UNITED ARAB EMIRATES',
  SA: 'SAUDI ARABIA', SE: 'SWEDEN', CH: 'SWITZERLAND', BR: 'BRAZIL', MX: 'MEXICO',
  GR: 'GREECE', NG: 'NIGERIA', NP: 'NEPAL', NO: 'NORWAY', DK: 'DENMARK', LA: 'LAOS',
  RO: 'ROMANIA', LU: 'LUXEMBOURG', LT: 'LITHUANIA', MM: 'MYANMAR', BD: 'BANGLADESH',
  BE: 'BELGIUM', BG: 'BULGARIA', BN: 'BRUNEI', LK: 'SRI LANKA', SK: 'SLOVAKIA',
  SI: 'SLOVENIA', AR: 'ARGENTINA', IE: 'IRELAND', EE: 'ESTONIA', AT: 'AUSTRIA',
  UZ: 'UZBEKISTAN', EG: 'EGYPT', CZ: 'CZECH REPUBLIC', CL: 'CHILE', KZ: 'KAZAKHSTAN',
  KH: 'CAMBODIA', TR: 'TURKEY', PK: 'PAKISTAN', PE: 'PERU', PT: 'PORTUGAL',
  PL: 'POLAND', FI: 'FINLAND', HU: 'HUNGARY',
};

export function labelSheetNote(method: string): string {
  if (method === 'KPACKET') return 'K-Packet 송장 1장';
  if (method === 'EMS_PREMIUM') return '1장 주소기표지 · 2장 세관신고서';
  return '1장 주소기표지 · 2·3장 세관신고서';
}

export function resolveShippingMethod(method: string | null | undefined, premiumCd?: string | null): string {
  const code = (method ?? '').trim().toUpperCase();
  if (code === 'EMS' || code === 'EMS_PREMIUM' || code === 'KPACKET') return code;
  return METHOD_BY_PREMIUM[(premiumCd ?? '').trim()] ?? 'EMS';
}

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
  status?: string | null;
  ems_premium_cd?: string | null;
  ems_applied_at?: string | null;
  ems_post_office?: string | null;
  ems_post_office_code?: string | null;
  actual_weight?: number | null;
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
  const shippingMethod = resolveShippingMethod(order.shipping_method, order.ems_premium_cd);

  return {
    source: 'internal',
    order_id: order.id,
    order_no: order.order_no,
    shipping_method: shippingMethod,
    service_label: SERVICE_LABEL[shippingMethod] ?? shippingMethod,
    sheet_note: labelSheetNote(shippingMethod),
    status: order.status ?? '',
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

function envText(value: string | undefined) {
  return (value ?? '').replace(/[\r\n]/g, '').trim();
}

function kgToG(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1000);
}

function cmOf(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

function printHs(code: string) {
  const digits = code.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(0, 10);
  if (!digits) return '';
  return digits.padEnd(10, '0');
}

function postedParts(iso: string | null | undefined) {
  if (!iso) return { year: '', month: '', day: '', hour: '', minute: '' };
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { year: '', month: '', day: '', hour: '', minute: '' };
  const bag: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    bag[part.type] = part.value;
  }
  return {
    year: bag.year ?? '',
    month: bag.month ?? '',
    day: bag.day ?? '',
    hour: bag.hour ?? '',
    minute: bag.minute ?? '',
  };
}

function officialSender() {
  const base = getLabelSender();
  const parts = [
    envText(process.env.INFRONT_SENDER_ADDR1),
    envText(process.env.INFRONT_SENDER_ADDR2),
    envText(process.env.INFRONT_SENDER_ADDR3),
  ].filter(Boolean);
  return {
    name: SENDER_NAME_EN[base.name.trim()] ?? base.name.trim(),
    address: parts.length > 0 ? parts.join(', ') : base.address,
    zip: base.zip,
    tel: base.tel,
  };
}

function labelItems(raw: unknown, totweight: number): OfficialLabelItem[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const item = row as Record<string, unknown>;
    const name = String(item.name_en || item.name || '').trim();
    if (!name) return [];
    const quantity = Number(item.quantity ?? item.qty ?? 1) || 1;
    const unit = Number(item.unit_price_usd ?? item.price ?? 0) || 0;
    return [{
      name_en: name,
      quantity,
      unit_price_usd: unit,
      print_hs: printHs(String(item.hs_code ?? '')),
      net_weight_g: '',
      origin_country: String(item.origin_country || item.origin || 'KR').trim() || 'KR',
    }];
  });
  if (totweight > 0 && items.length === 1) {
    items[0].net_weight_g = String(totweight);
  } else if (totweight > 0 && items.length > 1) {
    const each = Math.floor(totweight / items.length);
    items.forEach((item, index) => {
      item.net_weight_g = String(
        index < items.length - 1 ? each : totweight - each * (items.length - 1),
      );
    });
  }
  return items;
}

function pickBox(boxes: LabelBoxRow[], regino: string | null) {
  const rows = [...boxes].sort((a, b) => Number(a.box_seq ?? 0) - Number(b.box_seq ?? 0));
  if (regino) {
    const matched = rows.find((box) => (box.intl_tracking_no ?? '').trim() === regino);
    if (matched) return matched;
  }
  return rows[0];
}

/** 우체국 양식 PDF에 넣을 접수 값. 중량·크기는 출고 박스 실측을 쓴다. */
export function toOfficialLabel(order: OrderRow, boxes: LabelBoxRow[] = []): OfficialLabelData {
  const method = resolveShippingMethod(order.shipping_method, order.ems_premium_cd);
  const box = pickBox(boxes, order.ems_regino);
  const totweight = kgToG(box?.weight_kg) || kgToG(order.actual_weight);
  const boxlength = cmOf(box?.length_cm);
  const boxwidth = cmOf(box?.width_cm);
  const boxheight = cmOf(box?.height_cm);
  const volume = method === 'KPACKET' || !(boxlength && boxwidth && boxheight)
    ? null
    : Math.ceil((boxlength * boxwidth * boxheight) / (method === 'EMS_PREMIUM' ? 5 : 6));
  const posted = postedParts(order.ems_applied_at || order.created_at);
  const country = (order.recipient_country ?? '').trim().toUpperCase();
  const fee = order.ems_fee == null ? null : Math.trunc(Number(order.ems_fee));

  return {
    order_no: order.order_no,
    shipping_method: method,
    regino: (order.ems_regino || box?.intl_tracking_no || order.order_no || '').trim(),
    status: order.status === 'CANCELLED' ? 'canceled' : (order.status ?? ''),
    ems_fee: fee != null && Number.isFinite(fee) ? fee : null,
    totweight,
    volume_weight: volume,
    boxlength,
    boxwidth,
    boxheight,
    contents_type: 'parcel',
    posted_year: posted.year,
    posted_month: posted.month,
    posted_day: posted.day,
    posted_hour: posted.hour,
    posted_min: posted.minute,
    post_office: (order.ems_post_office || envText(process.env.INFRONT_POST_OFFICE)).trim(),
    post_office_code: (order.ems_post_office_code || envText(process.env.INFRONT_POST_OFFICE_CODE)).trim(),
    sender: officialSender(),
    recipient: {
      name: order.recipient_name ?? '',
      phone: order.recipient_phone ?? '',
      email: order.recipient_email ?? '',
      addr1: order.recipient_addr1 ?? '',
      addr2: order.recipient_addr2 ?? '',
      addr3: order.recipient_addr3 ?? '',
      zip: order.recipient_zip ?? '',
      country,
      country_name: NATION_FN[country] ?? country,
    },
    items: labelItems(order.item_list, totweight),
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
    <span style="flex:1;font-weight:600">${esc(data.order_no)} · ${esc(data.service_label)} 라벨</span>
    ${data.ems_applied ? '' : '<span style="color:#fbbf24;font-size:12px">⚠ 우체국 미접수 — 임시 출력</span>'}
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
