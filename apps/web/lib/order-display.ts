export interface ShippingBox {
  id: string;
  box_seq: number;
  intl_tracking_no: string | null;
  carrier: string | null;
  status: string;
  weight_kg: number | null;
}

export interface OrderParcelLink {
  parcel_id: string;
  parcels?: {
    id: string;
    tracking_no: string | null;
    sender_name: string | null;
    status: string;
    pre_invoice_items?: unknown;
  } | null;
}

export interface OrderItem {
  name_en: string;
  quantity: number;
  unit_price_usd: number;
}

export interface IntlTrackingEvent {
  time: string;
  statusLabel: string;
  description: string;
  location: string;
  source?: string;
}

export interface OrderSummary {
  id: string;
  order_no: string;
  status: string;
  shipping_method: string;
  packaging_type: string;
  packaging_fee: number;
  shipping_fee: number;
  total_amount: number;
  payment_status: string;
  recipient_name: string | null;
  recipient_country: string | null;
  customs_value: number | null;
  insurance_enabled?: boolean | null;
  insurance_amount?: number | null;
  duty_prepaid?: boolean | null;
  duty_deposit_krw?: number | null;
  duty_estimate_usd?: number | null;
  duty_paid_krw?: number | null;
  item_list: OrderItem[];
  intl_tracking_no: string | null;
  intl_tracking_status?: string | null;
  intl_tracking_last_event?: IntlTrackingEvent | null;
  intl_tracking_events?: IntlTrackingEvent[] | null;
  intl_tracking_synced_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  order_parcels: OrderParcelLink[];
  shipping_boxes: ShippingBox[];
}

export interface OrderDetail extends OrderSummary {
  recipient_phone: string | null;
  recipient_address: string | null;
  recipient_addr1: string | null;
  recipient_addr2: string | null;
  recipient_addr3: string | null;
  recipient_zip: string | null;
  recipient_email: string | null;
  actual_weight: number | null;
  chargeable_weight: number | null;
  extra_fee: number | null;
  updated_at: string;
  order_parcels: OrderParcelLink[];
}

export const ORDER_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  DRAFT: { label: "신청 완료", color: "text-brand-700 bg-brand-50 border-brand-200", dot: "bg-brand-400" },
  INBOUND: { label: "입고 대기", color: "text-yellow-700 bg-yellow-50 border-yellow-200", dot: "bg-yellow-400" },
  INSPECTION: { label: "검수 중", color: "text-purple-700 bg-purple-50 border-purple-200", dot: "bg-purple-400" },
  PACKAGING_REQUESTED: { label: "포장 요청", color: "text-orange-700 bg-orange-50 border-orange-200", dot: "bg-orange-400" },
  PACKAGING_DONE: { label: "포장 완료", color: "text-teal-700 bg-teal-50 border-teal-200", dot: "bg-teal-400" },
  QUOTE_SENT: { label: "견적 발송", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-400" },
  PENDING_PAYMENT: { label: "결제 대기", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-400" },
  PAID: { label: "결제 완료", color: "text-green-700 bg-green-50 border-green-200", dot: "bg-green-400" },
  CUSTOMS_FILING: { label: "통관 처리 중", color: "text-indigo-700 bg-indigo-50 border-indigo-200", dot: "bg-indigo-400" },
  IN_TRANSIT: { label: "배송 중", color: "text-sky-700 bg-sky-50 border-sky-200", dot: "bg-sky-400" },
  DELIVERED: { label: "배송 완료", color: "text-gray-600 bg-gray-50 border-gray-200", dot: "bg-gray-400" },
  CANCELLED: { label: "취소됨", color: "text-gray-400 bg-gray-50 border-gray-200", dot: "bg-gray-300" },
};

export const SHIPPING_METHOD_LABELS: Record<string, string> = {
  EMS: "EMS",
  EMS_PREMIUM: "EMS 프리미엄",
  KPACKET: "K-Packet",
};

export const PACKAGING_TYPE_LABELS: Record<string, string> = {
  NONE: "기본",
  REPACK: "재포장",
  COMBINED: "합포장",
  SPECIAL: "안전포장",
};

export const COUNTRIES: Record<string, { name: string; flag: string }> = {
  JP: { name: "일본", flag: "🇯🇵" },
  CN: { name: "중국", flag: "🇨🇳" },
  US: { name: "미국", flag: "🇺🇸" },
  AU: { name: "호주", flag: "🇦🇺" },
  CA: { name: "캐나다", flag: "🇨🇦" },
  GB: { name: "영국", flag: "🇬🇧" },
  SG: { name: "싱가포르", flag: "🇸🇬" },
  HK: { name: "홍콩", flag: "🇭🇰" },
  TW: { name: "대만", flag: "🇹🇼" },
  TH: { name: "태국", flag: "🇹🇭" },
  VN: { name: "베트남", flag: "🇻🇳" },
  PH: { name: "필리핀", flag: "🇵🇭" },
  MY: { name: "말레이시아", flag: "🇲🇾" },
  ID: { name: "인도네시아", flag: "🇮🇩" },
  DE: { name: "독일", flag: "🇩🇪" },
  FR: { name: "프랑스", flag: "🇫🇷" },
};

export function formatRecipientAddress(order: OrderDetail): string {
  const parts = [
    order.recipient_addr3,
    order.recipient_addr2,
    order.recipient_addr1,
    order.recipient_zip,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return order.recipient_address ?? "—";
}
