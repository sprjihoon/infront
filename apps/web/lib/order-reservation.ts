/** 진행 중인 주문 — 이 상태면 소포가 출고 신청에 묶인 것으로 간주 */
export const ACTIVE_ORDER_STATUSES = [
  "DRAFT",
  "INBOUND",
  "INSPECTION",
  "PACKAGING_REQUESTED",
  "PACKAGING_DONE",
  "QUOTE_SENT",
  "PENDING_PAYMENT",
  "PAID",
  "CUSTOMS_FILING",
  "IN_TRANSIT",
] as const;

/** 고객이 직접 취소 가능 — 신청 완료(DRAFT) 단계만 */
export const CUSTOMER_CANCELABLE_ORDER_STATUSES = ["DRAFT"] as const;

/** 창고 출고·견적·국제배송 처리 시작 후 (취소 불가) */
export const ORDER_POST_OUTBOUND_STATUSES = [
  "INBOUND",
  "INSPECTION",
  "PACKAGING_REQUESTED",
  "PACKAGING_DONE",
  "QUOTE_SENT",
  "PENDING_PAYMENT",
  "PAID",
  "CUSTOMS_FILING",
  "IN_TRANSIT",
  "DELIVERED",
] as const;

export function isActiveOrderStatus(status: string): boolean {
  return (ACTIVE_ORDER_STATUSES as readonly string[]).includes(status);
}

export function isPostOutboundOrderStatus(status: string): boolean {
  return (ORDER_POST_OUTBOUND_STATUSES as readonly string[]).includes(status);
}

export function canCustomerCancelOrder(status: string, paymentStatus: string): boolean {
  if (status === "CANCELLED" || status === "DELIVERED") return false;
  if (paymentStatus === "PAID" || paymentStatus === "CANCELLED") return false;
  if (isPostOutboundOrderStatus(status)) return false;
  return status === "DRAFT";
}

/** 취소 버튼 비노출 시 안내 문구 */
export function getCustomerCancelBlockReason(
  status: string,
  paymentStatus: string,
): string | null {
  if (canCustomerCancelOrder(status, paymentStatus)) return null;
  if (status === "CANCELLED") return "이미 취소된 신청입니다.";
  if (paymentStatus === "PAID" || status === "PAID") {
    return "결제·출고 처리가 완료되어 직접 취소할 수 없습니다. 고객센터로 문의해 주세요.";
  }
  if (status === "IN_TRANSIT" || status === "CUSTOMS_FILING") {
    return "국제 배송이 시작되어 취소할 수 없습니다.";
  }
  if (isPostOutboundOrderStatus(status)) {
    return "창고 출고 처리가 시작되어 취소할 수 없습니다. 고객센터로 문의해 주세요.";
  }
  return "현재 상태에서는 직접 취소할 수 없습니다. 고객센터로 문의해 주세요.";
}

type OrderParcelsRow = {
  parcel_id: string;
  orders: { status: string; customer_id?: string } | { status: string; customer_id?: string }[];
};

/** 진행 중 주문에 묶인 소포 ID (출고 선택 목록에서 제외) */
export function parcelIdsInActiveOrders(
  rows: OrderParcelsRow[] | null | undefined,
  customerId: string
): Set<string> {
  const reserved = new Set<string>();
  for (const row of rows ?? []) {
    const order = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    if (!order) continue;
    if (order.customer_id && order.customer_id !== customerId) continue;
    if (isActiveOrderStatus(order.status)) reserved.add(row.parcel_id);
  }
  return reserved;
}
