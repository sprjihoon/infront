export interface DashboardParcel {
  id: string;
  status: string;
  pickup_date: string | null;
  epost_pickup_date: string | null;
}

export interface DashboardOrder {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export interface ActionCard {
  id: string;
  priority: number;
  emoji: string;
  message: string;
  highlight?: boolean;
  button?: { label: string; href: string };
}

const PICKUP_STATUSES = new Set(["PENDING_PICKUP", "PICKUP_REQUESTED"]);

export function formatPickupDate(
  pickupDate: string | null,
  epostDate: string | null,
): string {
  if (pickupDate) {
    return new Date(pickupDate).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });
  }
  if (epostDate && epostDate.length >= 8) {
    const y = epostDate.substring(0, 4);
    const m = epostDate.substring(4, 6);
    const d = epostDate.substring(6, 8);
    return new Date(`${y}-${m}-${d}`).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });
  }
  return "일정 확인 중";
}

const PAYMENT_STATUSES = new Set(["PENDING_PAYMENT", "QUOTE_SENT"]);

export function buildActionCards(
  parcels: DashboardParcel[],
  orders: DashboardOrder[],
): ActionCard[] {
  const cards: ActionCard[] = [];

  const pendingPayment = orders.filter((o) => PAYMENT_STATUSES.has(o.status));
  if (pendingPayment.length > 0) {
    const order = pendingPayment[0];
    cards.push({
      id: "payment",
      priority: 1,
      emoji: "🔴",
      message: `견적이 도착했어요 — ${Number(order.total_amount).toLocaleString("ko-KR")}원 결제 대기 중`,
      highlight: true,
      button: { label: "결제하기", href: `/orders/${order.id}` },
    });
  }

  const inbound = parcels.filter((p) => p.status === "INBOUND");
  if (inbound.length > 0) {
    cards.push({
      id: "inbound",
      priority: 2,
      emoji: "📦",
      message: `창고에 ${inbound.length}개 보관 중 — 지금 출고신청 가능`,
      button: { label: "출고신청하기", href: "/shipping-request" },
    });
  }

  const pickupScheduled = parcels.filter((p) => PICKUP_STATUSES.has(p.status));
  if (pickupScheduled.length > 0) {
    const earliest = pickupScheduled.reduce((a, b) => {
      const dateA = a.pickup_date ?? a.epost_pickup_date ?? "";
      const dateB = b.pickup_date ?? b.epost_pickup_date ?? "";
      return dateA <= dateB ? a : b;
    });
    cards.push({
      id: "pickup",
      priority: 3,
      emoji: "🚚",
      message: `수거 예정 ${pickupScheduled.length}건 — ${formatPickupDate(earliest.pickup_date, earliest.epost_pickup_date)} 방문 예정`,
      button: { label: "수거 현황 보기", href: "/warehouse" },
    });
  }

  const inTransit = orders.filter((o) => o.status === "IN_TRANSIT");
  if (inTransit.length > 0) {
    cards.push({
      id: "in-transit",
      priority: 4,
      emoji: "✈️",
      message: `배송 중 ${inTransit.length}건`,
      button: { label: "배송현황 보기", href: "/orders" },
    });
  }

  return cards.sort((a, b) => a.priority - b.priority).slice(0, 3);
}
