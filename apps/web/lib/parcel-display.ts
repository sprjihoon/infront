import { isParcelShippable } from "./parcel-shippable";

export type ParcelJourneyPhase = "IN_TRANSIT" | "AT_WAREHOUSE" | "READY_TO_SHIP" | "ATTENTION";

export type WarehouseFilterKey =
  | "ALL"
  | "IN_TRANSIT"
  | "AT_WAREHOUSE"
  | "READY_TO_SHIP"
  | "ATTENTION";

export const WAREHOUSE_FILTER_TABS: { key: WarehouseFilterKey; label: string }[] = [
  { key: "ALL", label: "전체" },
  { key: "IN_TRANSIT", label: "오는 중" },
  { key: "AT_WAREHOUSE", label: "센터 보관" },
  { key: "READY_TO_SHIP", label: "출고 가능" },
  { key: "ATTENTION", label: "확인 필요" },
];

export type TrackingLastEvent = {
  statusLabel?: string;
  description?: string;
  location?: string;
  time?: string;
};

export type ParcelDisplayInput = {
  status: string;
  inbound_at?: string | null;
  weight_actual?: number | null;
  is_shippable?: boolean | null;
  hold_reason?: string | null;
  tracking_last_event?: TrackingLastEvent | null;
};

export type ParcelDisplaySummary = {
  phase: ParcelJourneyPhase;
  badgeLabel: string;
  badgeClass: string;
  dotClass: string;
  subtitle: string;
  meta?: string;
  alert?: string;
};

const BADGE = {
  inTransit: {
    badgeClass: "text-indigo-700 bg-indigo-50 border-indigo-200",
    dotClass: "bg-indigo-400",
  },
  warehouse: {
    badgeClass: "text-purple-700 bg-purple-50 border-purple-200",
    dotClass: "bg-purple-400",
  },
  ready: {
    badgeClass: "text-green-700 bg-green-50 border-green-200",
    dotClass: "bg-green-500",
  },
  attention: {
    badgeClass: "text-red-700 bg-red-50 border-red-200",
    dotClass: "bg-red-400",
  },
  reserved: {
    badgeClass: "text-brand-700 bg-brand-50 border-brand-200",
    dotClass: "bg-brand-400",
  },
} as const;

function formatInboundDate(inboundAt: string | null | undefined): string | null {
  if (!inboundAt) return null;
  return `${new Date(inboundAt).toLocaleDateString("ko-KR")} 입고`;
}

function formatWeight(weightActual: number | null | undefined): string | null {
  if (!weightActual) return null;
  return `${(weightActual / 1000).toFixed(2)}kg`;
}

function joinMeta(parts: (string | null | undefined)[]): string | undefined {
  const joined = parts.filter(Boolean).join(" · ");
  return joined || undefined;
}

function trackingSubtitle(event: TrackingLastEvent | null | undefined, fallback: string): string {
  if (!event) return fallback;
  const label = event.statusLabel || event.description || fallback;
  const location = event.location ? ` · ${event.location}` : "";
  return `${label}${location}`;
}

export function getParcelJourneyPhase(
  parcel: Pick<ParcelDisplayInput, "status" | "is_shippable">,
): ParcelJourneyPhase {
  if (parcel.status === "PICKUP_CANCELLED" || parcel.status === "HOLD") return "ATTENTION";
  if (isParcelShippable(parcel)) return "READY_TO_SHIP";
  if (parcel.status === "INBOUND" || parcel.status === "INSPECTION") return "AT_WAREHOUSE";
  if (["PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP"].includes(parcel.status)) return "IN_TRANSIT";
  return "AT_WAREHOUSE";
}

export function matchesWarehouseFilter(
  parcel: ParcelDisplayInput,
  filter: WarehouseFilterKey,
): boolean {
  if (filter === "ALL") return true;
  return getParcelJourneyPhase(parcel) === filter;
}

export function getParcelDisplaySummary(
  parcel: ParcelDisplayInput,
  options?: { isReserved?: boolean },
): ParcelDisplaySummary {
  const isReserved = options?.isReserved ?? false;
  const phase = getParcelJourneyPhase(parcel);

  if (isReserved) {
    return {
      phase: "READY_TO_SHIP",
      badgeLabel: "출고 신청 중",
      ...BADGE.reserved,
      subtitle: "배송현황에서 진행 상황을 확인하세요",
    };
  }

  switch (parcel.status) {
    case "PRE_REGISTERED":
      return {
        phase,
        badgeLabel: "오는 중",
        ...BADGE.inTransit,
        subtitle: trackingSubtitle(parcel.tracking_last_event, "센터 도착 전 · 택배 배송 대기"),
      };
    case "PENDING_PICKUP":
      return {
        phase,
        badgeLabel: "오는 중",
        ...BADGE.inTransit,
        subtitle: "우체국 수거 예약 · 집배원 방문 예정",
      };
    case "PICKED_UP":
      return {
        phase,
        badgeLabel: "오는 중",
        ...BADGE.inTransit,
        subtitle: trackingSubtitle(parcel.tracking_last_event, "수거 완료 · 센터로 이동 중"),
      };
    case "PICKUP_CANCELLED":
      return {
        phase,
        badgeLabel: "확인 필요",
        ...BADGE.attention,
        subtitle: "수거 신청이 취소됨 · 다시 수거 신청하세요",
      };
    case "INBOUND":
      if (isParcelShippable(parcel)) {
        return {
          phase,
          badgeLabel: "출고 가능",
          ...BADGE.ready,
          subtitle: "검수 완료 · 해외배송 신청 가능",
          meta: joinMeta([formatInboundDate(parcel.inbound_at), formatWeight(parcel.weight_actual)]),
        };
      }
      return {
        phase,
        badgeLabel: "센터 보관",
        ...BADGE.warehouse,
        subtitle: "센터 입고 · 검수 진행 중",
        meta: joinMeta([formatInboundDate(parcel.inbound_at), formatWeight(parcel.weight_actual)]),
      };
    case "INSPECTION":
      return {
        phase,
        badgeLabel: "센터 보관",
        ...BADGE.warehouse,
        subtitle: "검수 중",
        meta: joinMeta([formatInboundDate(parcel.inbound_at), formatWeight(parcel.weight_actual)]),
      };
    case "HOLD":
      return {
        phase,
        badgeLabel: "확인 필요",
        ...BADGE.attention,
        subtitle: parcel.hold_reason ?? "보류 중 · 고객 확인 필요",
        alert: parcel.hold_reason ?? undefined,
      };
    default:
      return {
        phase,
        badgeLabel: "센터 보관",
        ...BADGE.warehouse,
        subtitle: formatInboundDate(parcel.inbound_at) ?? "처리 중",
        meta: formatWeight(parcel.weight_actual) ?? undefined,
      };
  }
}

export function getWarehouseEmptyMessage(filter: WarehouseFilterKey): { title: string; desc: string } {
  switch (filter) {
    case "IN_TRANSIT":
      return {
        title: "오는 중인 물품이 없어요",
        desc: "수거 신청 또는 물품 등록 후\n센터 도착 전 상태가 여기에 표시됩니다",
      };
    case "AT_WAREHOUSE":
      return {
        title: "센터에 보관 중인 물품이 없어요",
        desc: "입고 후 검수가 진행되면\n여기에서 확인할 수 있어요",
      };
    case "READY_TO_SHIP":
      return {
        title: "출고 가능한 물품이 없어요",
        desc: "검수가 완료되면\n해외배송을 신청할 수 있어요",
      };
    case "ATTENTION":
      return {
        title: "확인이 필요한 물품이 없어요",
        desc: "보류·수거 취소 등\n조치가 필요한 물품이 여기에 표시됩니다",
      };
    default:
      return {
        title: "등록된 물품이 없어요",
        desc: "쇼핑몰에서 창고 주소로 발송한 물품을\n미리 등록해두세요",
      };
  }
}
