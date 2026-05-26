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

/** 고객이 직접 취소 가능 (처리 전 · 신청 완료) */
export const CUSTOMER_CANCELABLE_ORDER_STATUSES = ["DRAFT"] as const;

export function isActiveOrderStatus(status: string): boolean {
  return (ACTIVE_ORDER_STATUSES as readonly string[]).includes(status);
}

export function canCustomerCancelOrder(status: string, paymentStatus: string): boolean {
  if (!(CUSTOMER_CANCELABLE_ORDER_STATUSES as readonly string[]).includes(status)) {
    return false;
  }
  return paymentStatus !== "PAID";
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
