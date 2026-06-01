import { COUNTRIES } from "@/lib/order-display";

export type OrderListFilterKey =
  | "ALL"
  | "DRAFT"
  | "PROCESSING"
  | "PAYMENT"
  | "SHIPPING"
  | "DONE"
  | "CANCELLED";

export const ORDER_LIST_FILTER_TABS: { key: OrderListFilterKey; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "DRAFT", label: "신청 완료" },
  { key: "PROCESSING", label: "처리 중" },
  { key: "PAYMENT", label: "결제 대기" },
  { key: "SHIPPING", label: "배송 중" },
  { key: "DONE", label: "배송 완료" },
  { key: "CANCELLED", label: "취소됨" },
];

export const ORDERS_LIST_PAGE_SIZE = 10;

export type OrderListFilterInput = {
  status: string;
  order_no?: string;
  recipient_name?: string | null;
  recipient_country?: string | null;
};

export function matchesOrderListFilter(
  order: OrderListFilterInput,
  filter: OrderListFilterKey,
): boolean {
  switch (filter) {
    case "ALL":
      return order.status !== "CANCELLED";
    case "DRAFT":
      return order.status === "DRAFT";
    case "PROCESSING":
      return ["INBOUND", "INSPECTION", "PACKAGING_REQUESTED", "PACKAGING_DONE"].includes(
        order.status,
      );
    case "PAYMENT":
      return order.status === "QUOTE_SENT" || order.status === "PENDING_PAYMENT";
    case "SHIPPING":
      return ["PAID", "CUSTOMS_FILING", "IN_TRANSIT"].includes(order.status);
    case "DONE":
      return order.status === "DELIVERED";
    case "CANCELLED":
      return order.status === "CANCELLED";
    default:
      return true;
  }
}

export function matchesOrderSearch(order: OrderListFilterInput, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (order.order_no?.toLowerCase().includes(q)) return true;
  if (order.recipient_name?.toLowerCase().includes(q)) return true;
  const country = COUNTRIES[order.recipient_country ?? ""];
  if (country?.name.toLowerCase().includes(q)) return true;
  return false;
}

export function getOrdersListEmptyMessage(filter: OrderListFilterKey): {
  title: string;
  desc: string;
} {
  switch (filter) {
    case "DRAFT":
      return {
        title: "신청 완료된 배송이 없어요",
        desc: "스토리지에서 출고 신청하면\n여기에 표시됩니다",
      };
    case "PROCESSING":
      return {
        title: "처리 중인 배송이 없어요",
        desc: "입고·검수·포장 단계의\n주문이 여기에 표시됩니다",
      };
    case "PAYMENT":
      return {
        title: "결제 대기 중인 배송이 없어요",
        desc: "견적 발송 후 결제 대기 주문이\n여기에 표시됩니다",
      };
    case "SHIPPING":
      return {
        title: "배송 중인 건이 없어요",
        desc: "국제 운송이 시작된 주문이\n여기에 표시됩니다",
      };
    case "DONE":
      return {
        title: "배송 완료된 건이 없어요",
        desc: "수취 완료된 주문이\n여기에 표시됩니다",
      };
    case "CANCELLED":
      return {
        title: "취소된 신청이 없어요",
        desc: "취소 처리된 주문이\n여기에 표시됩니다",
      };
    default:
      return {
        title: "배송 내역이 없어요",
        desc: "스토리지에서 해외배송을 신청해보세요",
      };
  }
}
