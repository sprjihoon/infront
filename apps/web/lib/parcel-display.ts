import { isParcelShippable } from "./parcel-shippable";

export type ParcelJourneyPhase = "INCOMING" | "SHIPPABLE" | "HOLD";

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
  incoming: {
    badgeClass: "text-indigo-700 bg-indigo-50 border-indigo-200",
    dotClass: "bg-indigo-400",
  },
  shippable: {
    badgeClass: "text-green-700 bg-green-50 border-green-200",
    dotClass: "bg-green-500",
  },
  hold: {
    badgeClass: "text-orange-700 bg-orange-50 border-orange-200",
    dotClass: "bg-orange-400",
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
  if (parcel.status === "HOLD" || parcel.status === "PICKUP_CANCELLED") return "HOLD";
  if (isParcelShippable(parcel)) return "SHIPPABLE";
  return "INCOMING";
}

export function getParcelDisplaySummary(
  parcel: ParcelDisplayInput,
  options?: { isReserved?: boolean },
): ParcelDisplaySummary {
  const isReserved = options?.isReserved ?? false;
  const phase = getParcelJourneyPhase(parcel);

  if (isReserved) {
    return {
      phase: "SHIPPABLE",
      badgeLabel: "출고 신청 중",
      ...BADGE.reserved,
      subtitle: "배송현황에서 진행 상황을 확인하세요",
    };
  }

  // 보류
  if (phase === "HOLD") {
    return {
      phase,
      badgeLabel: "보류",
      ...BADGE.hold,
      subtitle: parcel.hold_reason ?? "보류 중 · 고객 확인 필요",
      alert: parcel.hold_reason ?? undefined,
    };
  }

  // 출고가능
  if (phase === "SHIPPABLE") {
    return {
      phase,
      badgeLabel: "출고 가능",
      ...BADGE.shippable,
      subtitle: "검수 완료 · 출고신청 가능",
      meta: joinMeta([formatInboundDate(parcel.inbound_at), formatWeight(parcel.weight_actual)]),
    };
  }

  // 입고중 — status에 따라 서브타이틀만 세분화
  const inboundMeta = joinMeta([formatInboundDate(parcel.inbound_at), formatWeight(parcel.weight_actual)]);
  const incomingBase = { phase: phase as ParcelJourneyPhase, badgeLabel: "입고중", ...BADGE.incoming };

  switch (parcel.status) {
    case "PRE_REGISTERED":
      return { ...incomingBase, subtitle: trackingSubtitle(parcel.tracking_last_event, "센터 도착 전 · 택배 배송 대기") };
    case "PENDING_PICKUP":
      return { ...incomingBase, subtitle: "우체국 수거 예약 · 집배원 방문 예정" };
    case "PICKED_UP":
      return { ...incomingBase, subtitle: trackingSubtitle(parcel.tracking_last_event, "수거 완료 · 센터로 이동 중") };
    case "INBOUND":
      return { ...incomingBase, subtitle: "센터 입고 완료 · 검수 중", meta: inboundMeta ?? undefined };
    case "INSPECTION":
    case "INSPECTING":
      return { ...incomingBase, subtitle: "검수 진행 중", meta: inboundMeta ?? undefined };
    default:
      return { ...incomingBase, subtitle: formatInboundDate(parcel.inbound_at) ?? "처리 중", meta: formatWeight(parcel.weight_actual) ?? undefined };
  }
}
