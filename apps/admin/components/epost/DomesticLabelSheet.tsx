import React from "react";

export interface DomesticLabelData {
  trackingNo: string;

  // 주문 정보
  orderDate: string;
  orderNumber: string;

  // 보내는 분 (인프론트 창고 — 고정)
  senderAddress: string;
  senderName: string;
  senderPhone: string;

  // 받는 분 (고객 국내 주소)
  recipientName: string;
  recipientPhone: string;
  recipientZipcode: string;
  recipientAddress: string;

  // 상품 정보
  totalQuantity: number;
  itemsList: string;
  weight?: string;
  volume?: string;
  memo?: string;

  // 우체국 분류코드 (접수 API 응답)
  deliveryPlaceCode?: string;
  deliveryTeamCode?: string;
  deliverySequence?: string;
  sortCode1?: string;
  sortCode2?: string;
  sortCode3?: string;
  sortCode4?: string;
  printAreaCd?: string;
}

interface LabelLayoutElement {
  fieldKey: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isBold: boolean;
  borderColor?: string;
  letterSpacing?: number;
  type: "text" | "barcode";
}

const LABEL_WIDTH_MM = 168;
const LABEL_HEIGHT_MM = 107;
const DPI = 96;
const mmToPx = (mm: number) => mm * (DPI / 25.4);
const pxToMm = (px: number) => px * (25.4 / DPI);
const BASE_WIDTH = 800;
const BASE_HEIGHT = BASE_WIDTH * (LABEL_HEIGHT_MM / LABEL_WIDTH_MM);

const FONT_STYLE: React.CSSProperties = {
  fontFamily: '"Nanum Gothic", "Malgun Gothic", Dotum, sans-serif',
  lineHeight: "1.2",
  color: "#000",
};

const BRAND_NAME =
  process.env.NEXT_PUBLIC_BRAND_NAME ?? "인프론트";

const createDefaultLayout = (): LabelLayoutElement[] => {
  const labelWidth = BASE_WIDTH - mmToPx(10);
  const scale = labelWidth / mmToPx(LABEL_WIDTH_MM);
  const scaleFont = (size: number) => Math.max(10, size * scale * 0.8);

  const elements = [
    { fieldKey: "output_label",        x: labelWidth / 2 - 40, y: 10,  width: 80,            height: 20, fontSize: scaleFont(14), isBold: true,  type: "text" as const },
    { fieldKey: "sorting_code_large",  x: labelWidth * 0.38,   y: 5,   width: 400,           height: 55, fontSize: scaleFont(40), isBold: true,  type: "text" as const, letterSpacing: 12 },
    { fieldKey: "delivery_center_info",x: labelWidth * 0.54,   y: 55,  width: 250,           height: 20, fontSize: scaleFont(15), isBold: true,  type: "text" as const, letterSpacing: 10 },
    { fieldKey: "order_date",          x: 10,                  y: 30,  width: 150,           height: 20, fontSize: scaleFont(12), isBold: false, type: "text" as const },
    { fieldKey: "orderer_name",        x: 10,                  y: 55,  width: 150,           height: 18, fontSize: scaleFont(11), isBold: false, type: "text" as const },
    { fieldKey: "order_number",        x: 10,                  y: 78,  width: 200,           height: 18, fontSize: scaleFont(11), isBold: false, type: "text" as const },
    { fieldKey: "package_info",        x: 10,                  y: 101, width: 250,           height: 18, fontSize: scaleFont(11), isBold: false, type: "text" as const },
    { fieldKey: "zipcode_barcode",     x: 10,                  y: 150, width: 120,           height: 60, fontSize: scaleFont(12), isBold: false, type: "barcode" as const },
    { fieldKey: "total_quantity",      x: 140,                 y: 155, width: 80,            height: 20, fontSize: scaleFont(12), isBold: false, type: "text" as const },
    { fieldKey: "items_list",          x: 10,                  y: 220, width: 250,           height: 150,fontSize: scaleFont(13), isBold: false, type: "text" as const },
    { fieldKey: "sender_address",      x: labelWidth * 0.43,   y: 95,  width: labelWidth * 0.55, height: 40, fontSize: scaleFont(12), isBold: false, type: "text" as const },
    { fieldKey: "sender_name",         x: labelWidth * 0.43,   y: 140, width: 100,           height: 20, fontSize: scaleFont(12), isBold: false, type: "text" as const },
    { fieldKey: "sender_phone",        x: labelWidth * 0.43 + 110, y: 140, width: 120,       height: 20, fontSize: scaleFont(12), isBold: false, type: "text" as const },
    { fieldKey: "receiver_address",    x: labelWidth * 0.43,   y: 170, width: labelWidth * 0.55, height: 40, fontSize: scaleFont(16), isBold: true, type: "text" as const },
    { fieldKey: "receiver_name",       x: labelWidth * 0.43,   y: 220, width: 100,           height: 22, fontSize: scaleFont(14), isBold: true,  type: "text" as const },
    { fieldKey: "receiver_phone",      x: labelWidth * 0.43 + 110, y: 220, width: 120,       height: 22, fontSize: scaleFont(14), isBold: true,  type: "text" as const },
    { fieldKey: "tracking_no_text",    x: labelWidth * 0.43,   y: 255, width: 250,           height: 20, fontSize: scaleFont(12), isBold: false, type: "text" as const },
    { fieldKey: "waybill_statement",   x: labelWidth * 0.43,   y: 280, width: 300,           height: 20, fontSize: scaleFont(12), isBold: true,  type: "text" as const },
    { fieldKey: "tracking_no_barcode", x: labelWidth * 0.43,   y: 305, width: 280,           height: 70, fontSize: scaleFont(12), isBold: false, type: "barcode" as const },
    { fieldKey: "bottom_info",         x: 10, y: BASE_HEIGHT - mmToPx(10) - 25, width: 200,  height: 20, fontSize: scaleFont(12), isBold: false, type: "text" as const },
  ];

  const scaleFactor = BASE_WIDTH / mmToPx(LABEL_WIDTH_MM);
  return elements.map((el) => ({
    ...el,
    x: pxToMm(el.x / scaleFactor),
    y: pxToMm(el.y / scaleFactor),
    width: pxToMm(el.width / scaleFactor),
    height: pxToMm(el.height / scaleFactor),
  }));
};

const formatTrackingNo = (trackingNo: string) => {
  const cleaned = trackingNo.replace(/\D/g, "");
  if (cleaned.length === 13) {
    return `${cleaned.slice(0, 5)}-${cleaned.slice(5, 9)}-${cleaned.slice(9)}`;
  }
  return trackingNo;
};

const mapField = (fieldKey: string, data: DomesticLabelData): string => {
  const mapping: Record<string, (d: DomesticLabelData) => string> = {
    output_label:         () => "소포",
    sorting_code_large:   (d) => {
      if (d.printAreaCd) return d.printAreaCd;
      const codes = [d.sortCode1, d.sortCode2, d.sortCode3, d.sortCode4].filter(Boolean);
      return codes.join(" ");
    },
    delivery_center_info: (d) => {
      const parts: string[] = [];
      if (d.deliveryPlaceCode) parts.push(d.deliveryPlaceCode);
      if (d.deliveryTeamCode)  parts.push(d.deliveryTeamCode);
      if (d.deliverySequence) {
        let seq = d.deliverySequence;
        if (!seq.includes("-")) seq = `-${seq}-`;
        parts.push(seq);
      }
      return parts.join("  ");
    },
    order_date:       (d) => `신청일: ${d.orderDate}`,
    orderer_name:     (d) => `수령인: ${d.recipientName}`,
    order_number:     (d) => `주문번호: ${d.orderNumber}`,
    package_info:     (d) => `중량:${d.weight ?? "2"}kg 용적:${d.volume ?? "60"}cm 요금: 신용 0`,
    zipcode_barcode:  (d) => d.recipientZipcode,
    total_quantity:   (d) => `[총 ${d.totalQuantity}개]`,
    items_list:       (d) => d.itemsList || "1. 의류-1개",
    sender_address:   (d) => d.senderAddress,
    sender_name:      (d) => d.senderName || BRAND_NAME,
    sender_phone:     (d) => d.senderPhone,
    receiver_address: (d) => d.recipientAddress,
    receiver_name:    (d) => d.recipientName,
    receiver_phone:   (d) => d.recipientPhone,
    tracking_no_text:  (d) => `등기번호: ${formatTrackingNo(d.trackingNo)}`,
    waybill_statement: () => `${BRAND_NAME}에서 제공되는 서비스입니다.`,
    tracking_no_barcode: (d) => d.trackingNo,
    bottom_info:       (d) => `[총 ${d.totalQuantity}개] [국내 소포]`,
  };
  return mapping[fieldKey]?.(data) ?? "";
};

interface Props {
  data: DomesticLabelData;
}

export function DomesticLabelSheet({ data }: Props) {
  const layout = createDefaultLayout();
  const actualWidthPx = 635;
  const layoutBaseWidthPx = 800;
  const fontScaleFactor = actualWidthPx / layoutBaseWidthPx;

  return (
    <div className="domestic-label-container">
      <style>{`
        .domestic-label-container {
          font-family: "Nanum Gothic", "Malgun Gothic", Dotum, sans-serif;
        }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden !important; }
          .domestic-label-container, .domestic-label-container * { visibility: visible !important; }
          .domestic-label-container { position: absolute !important; left: 0 !important; top: 0 !important; width: 168mm !important; height: 106.5mm !important; overflow: hidden !important; page-break-inside: avoid !important; page-break-after: avoid !important; }
          .domestic-label-content { width: 635px !important; height: 404px !important; transform: none !important; border: none !important; background: white !important; }
          @page { size: 168mm 107mm; margin: 0 !important; }
        }
      `}</style>
      <div
        className="domestic-label-content"
        style={{
          position: "relative",
          width: "635px",
          height: "404px",
          backgroundColor: "#fff",
          margin: "0 auto",
          border: "1px solid #ddd",
          transformOrigin: "top center",
        }}
      >
        {layout.map((el, i) => {
          const x = mmToPx(el.x);
          const y = mmToPx(el.y);
          const w = mmToPx(el.width);
          const h = mmToPx(el.height);
          const fontSize = el.fontSize * fontScaleFactor;
          const value = mapField(el.fieldKey, data);
          if (!value) return null;

          if (el.type === "barcode") {
            return (
              <div
                key={`${el.fieldKey}-${i}`}
                style={{ position: "absolute", left: x, top: y, width: w, height: h, overflow: "hidden" }}
              >
                <img
                  src={`https://barcode.tec-it.com/barcode.ashx?data=${encodeURIComponent(value)}&code=Code128&dpi=203&translate-esc=on`}
                  alt={el.fieldKey}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
              </div>
            );
          }

          return (
            <div
              key={`${el.fieldKey}-${i}`}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: w,
                height: h,
                ...FONT_STYLE,
                fontSize,
                fontWeight: el.isBold ? "bold" : "normal",
                whiteSpace: "pre-wrap",
                overflow: "visible",
                wordBreak: "break-word",
                letterSpacing: el.letterSpacing ? `${el.letterSpacing}px` : "normal",
              }}
            >
              {value}
            </div>
          );
        })}
      </div>
    </div>
  );
}
