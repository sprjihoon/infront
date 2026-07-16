export type ShopProductCategory =
  | "storage"
  | "pickup"
  | "domestic"
  | "intl"
  | "inspection"
  | "membership";

export type BillingType = "one_time" | "recurring";

export type CustomerType = "domestic" | "foreigner";

/** 단건/정기 결제 항목 구분 (KG이니시스 심사용) */
export type PaymentItemKey =
  | "pickup_fee"
  | "inspection_fee"
  | "packing_fee"
  | "domestic_shipping_fee"
  | "international_shipping_fee"
  | "long_term_monthly_storage_fee"
  | "monthly_membership_fee";

export type PaymentItemType = "one_time" | "recurring";

export type ShippingType = "domestic" | "intl" | "none";

export interface ShopProduct {
  id: string;
  category: ShopProductCategory;
  paymentItemKey: PaymentItemKey;
  name: string;
  nameEn: string;
  price: number;
  billingType: BillingType;
  description: string;
  descriptionEn: string;
  deliveryMethod: string;
  deliveryMethodEn: string;
  servicePeriod: string;
  servicePeriodEn: string;
  refundNote: string;
  refundNoteEn: string;
  intlTrackingNote?: string;
  intlTrackingNoteEn?: string;
  icon: "archive" | "truck" | "globe" | "package" | "box";
  badge?: string;
  badgeEn?: string;
  badgeColor?: string;
  unit?: string;
}

export const INTL_TRACKING_NOTE_KO =
  "해외배송은 EMS, EMS Premium, K-Packet 등 추적 가능한 배송수단을 사용합니다. 발송 후 운송장번호를 제공하며, 고객은 배송조회 페이지에서 배송 상태를 확인할 수 있습니다. 다만 통관 이후 현지 배송 추적 범위는 국가 및 현지 배송사 사정에 따라 일부 차이가 있을 수 있습니다.";

export const INTL_TRACKING_NOTE_EN =
  "International shipping uses trackable carriers such as EMS, EMS Premium, and K-Packet. A waybill number is provided after dispatch, and customers can check status on our tracking page. Local delivery tracking after customs may vary by country and local carrier.";

export const FOREIGN_CARD_SCOPE_NOTICE_KO =
  "해외카드는 검품/포장, 왕복배송비 등 단건 서비스 이용요금 결제에 사용할 수 있습니다. 장기보관 월 이용료는 별도 자동결제 빌링 구조로 운영됩니다.";

export const FOREIGN_CARD_SCOPE_NOTICE_EN =
  "International cards may be used for one-time service fees such as inspection/packing and round-trip shipping. Monthly long-term storage fees are billed separately via card auto-payment.";

export const SERVICE_INTRO_KO =
  "인프론트는 고객이 온라인으로 물품 수거를 신청하고, 물류센터에서 보관한 뒤, 요청에 따라 포장·검품 후 국내배송 또는 해외배송을 진행하는 수거·보관·배송대행 플랫폼입니다.";

export const SERVICE_INTRO_EN =
  "Infront is a pickup, storage, and shipping agency platform. Customers request online pickup, items are stored at our logistics center, and we inspect, pack, and ship domestically or internationally upon request.";

/** 단건 서비스 결제 시 자동으로 합산 청구되는 왕복배송비 */
export const ROUNDTRIP_SHIPPING_FEE = 7000;

export const SHOP_PRODUCTS: ShopProduct[] = [
  // ── 멤버십 구독 (정기결제 빌링 심사용) ──────────────────────────────────
  {
    id: "MEMBERSHIP_BASIC",
    category: "membership",
    paymentItemKey: "monthly_membership_fee",
    name: "베이직 멤버십",
    nameEn: "Basic Membership",
    price: 9900,
    billingType: "recurring",
    unit: "월",
    description:
      "월 5건 검품·포장 처리 무료 + 무료 방문 픽업 1회 포함. 국내·해외 발송 서비스 이용 시 우선 처리 혜택을 드립니다.",
    descriptionEn:
      "Includes 5 free inspection/packaging per month + 1 free pickup visit. Priority processing for domestic and international shipments.",
    deliveryMethod: "물류센터 내 서비스 (비실물)",
    deliveryMethodEn: "In-warehouse service (non-physical)",
    servicePeriod: "월 단위 자동결제 (언제든 해지 가능)",
    servicePeriodEn: "Monthly auto-billing (cancel anytime)",
    refundNote: "해지 신청 익월부터 청구 중단. 이미 결제된 당월 요금 환불 불가",
    refundNoteEn: "Billing stops from the month after cancellation. Current month fee non-refundable",
    icon: "box",
    badge: "멤버십",
    badgeEn: "Membership",
    badgeColor: "bg-violet-100 text-violet-700",
  },
  // ── 단건 서비스 ──────────────────────────────────────────────────────────
  {
    id: "INSPECTION_PACK_S",
    category: "inspection",
    paymentItemKey: "inspection_fee",
    name: "소형 검품/포장 서비스",
    nameEn: "Small Inspection & Packaging Service",
    price: 6000,
    billingType: "one_time",
    description: "소형 물품(30×25×20cm 이하)의 상태 확인 및 안전 포장을 진행하는 서비스입니다.",
    descriptionEn: "Inspection and safe packaging for small items (up to 30×25×20cm).",
    deliveryMethod: "물류센터 내 작업",
    deliveryMethodEn: "In-warehouse service",
    servicePeriod: "수거 후 당일~1영업일 내 완료",
    servicePeriodEn: "Completed same day or within 1 business day after pickup",
    refundNote: "검품/포장 작업 완료 후 작업비 환불 불가",
    refundNoteEn: "Service fee non-refundable after inspection/packaging is complete",
    icon: "package",
    badge: "소형",
    badgeEn: "Small",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "INSPECTION_PACK_M",
    category: "inspection",
    paymentItemKey: "inspection_fee",
    name: "중형 검품/포장 서비스",
    nameEn: "Medium Inspection & Packaging Service",
    price: 8000,
    billingType: "one_time",
    description: "중형 물품(40×35×25cm 이하)의 상태 확인 및 안전 포장을 진행하는 서비스입니다.",
    descriptionEn: "Inspection and safe packaging for medium items (up to 40×35×25cm).",
    deliveryMethod: "물류센터 내 작업",
    deliveryMethodEn: "In-warehouse service",
    servicePeriod: "수거 후 당일~1영업일 내 완료",
    servicePeriodEn: "Completed same day or within 1 business day after pickup",
    refundNote: "검품/포장 작업 완료 후 작업비 환불 불가",
    refundNoteEn: "Service fee non-refundable after inspection/packaging is complete",
    icon: "package",
    badge: "중형",
    badgeEn: "Medium",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    id: "INSPECTION_PACK_L",
    category: "inspection",
    paymentItemKey: "inspection_fee",
    name: "대형 검품/포장 서비스",
    nameEn: "Large Inspection & Packaging Service",
    price: 12000,
    billingType: "one_time",
    description: "대형 물품(50×45×35cm 이하)의 상태 확인 및 안전 포장을 진행하는 서비스입니다.",
    descriptionEn: "Inspection and safe packaging for large items (up to 50×45×35cm).",
    deliveryMethod: "물류센터 내 작업",
    deliveryMethodEn: "In-warehouse service",
    servicePeriod: "수거 후 당일~1영업일 내 완료",
    servicePeriodEn: "Completed same day or within 1 business day after pickup",
    refundNote: "검품/포장 작업 완료 후 작업비 환불 불가",
    refundNoteEn: "Service fee non-refundable after inspection/packaging is complete",
    icon: "package",
    badge: "대형",
    badgeEn: "Large",
    badgeColor: "bg-orange-100 text-orange-700",
  },
];

export const ONE_TIME_PRODUCTS = SHOP_PRODUCTS.filter((p) => p.billingType === "one_time");
export const RECURRING_PRODUCTS = SHOP_PRODUCTS.filter((p) => p.billingType === "recurring");

export function getShopProduct(id: string): ShopProduct | undefined {
  return SHOP_PRODUCTS.find((p) => p.id === id);
}

export function getOneTimeProduct(id: string): ShopProduct | undefined {
  const p = getShopProduct(id);
  return p?.billingType === "one_time" ? p : undefined;
}

/**
 * 보관(정기결제)을 제외한 모든 단건 서비스는 왕복배송비(ROUNDTRIP_SHIPPING_FEE)를
 * 결제 시 자동으로 합산 청구합니다.
 */
export function getBundledShippingFee(product: ShopProduct): number {
  if (product.billingType !== "one_time") return 0;
  return ROUNDTRIP_SHIPPING_FEE;
}

export function getOrderTotal(product: ShopProduct): number {
  return product.price + getBundledShippingFee(product);
}

export function getShippingType(product: ShopProduct): ShippingType {
  if (product.category === "domestic") return "domestic";
  if (product.category === "intl") return "intl";
  return "none";
}

export function getPaymentItemType(product: ShopProduct): PaymentItemType {
  return product.billingType === "recurring" ? "recurring" : "one_time";
}

export function formatKrw(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 국내 결제수단 */
export const DOMESTIC_PAYMENT_METHODS = [
  { id: "card", label: "신용카드", labelEn: "Credit Card", code: "CARD" },
  { id: "bank", label: "계좌이체", labelEn: "Bank Transfer", code: "BANK_TRANSFER" },
  { id: "vbank", label: "가상계좌", labelEn: "Virtual Account", code: "VIRTUAL_ACCOUNT" },
  { id: "easy", label: "간편결제", labelEn: "Easy Pay", code: "EASY_PAY" },
] as const;

/** 해외/글로벌 결제수단 — 외국인 회원 + 단건결제에서만 노출 */
export const GLOBAL_PAYMENT_METHODS = [
  { id: "intl_card", label: "해외카드", labelEn: "International Card", code: "FOREIGN_CARD" },
  { id: "alipay", label: "Alipay", labelEn: "Alipay", code: "ALIPAY" },
  { id: "wechat", label: "WeChat Pay", labelEn: "WeChat Pay", code: "WECHAT_PAY" },
] as const;

export type DomesticPaymentMethodId = (typeof DOMESTIC_PAYMENT_METHODS)[number]["id"];
export type GlobalPaymentMethodId = (typeof GLOBAL_PAYMENT_METHODS)[number]["id"];
export type PaymentMethodId = DomesticPaymentMethodId | GlobalPaymentMethodId;

const GLOBAL_IDS = new Set<string>(GLOBAL_PAYMENT_METHODS.map((m) => m.id));

export function isGlobalPaymentMethod(id: string): boolean {
  return GLOBAL_IDS.has(id);
}

export function canShowGlobalPaymentMethods(customerType: CustomerType): boolean {
  return customerType === "foreigner";
}

export function getPaymentMethodLabel(id: string, lang: "ko" | "en" = "ko"): string {
  const all = [...DOMESTIC_PAYMENT_METHODS, ...GLOBAL_PAYMENT_METHODS];
  const m = all.find((x) => x.id === id);
  if (!m) return id;
  return lang === "ko" ? m.label : m.labelEn;
}

export function getPaymentMethodCode(id: string): string {
  const all = [...DOMESTIC_PAYMENT_METHODS, ...GLOBAL_PAYMENT_METHODS];
  return all.find((x) => x.id === id)?.code ?? id.toUpperCase();
}

export const CUSTOMER_TYPE_LABEL: Record<CustomerType, string> = {
  domestic: "내국인",
  foreigner: "외국인/해외고객",
};

export function isTrackingAvailable(product: ShopProduct, emsRegino?: string | null): boolean {
  if (product.category === "intl") return true;
  if (product.category === "domestic") return true;
  return !!emsRegino;
}
