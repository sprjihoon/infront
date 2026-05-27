// tracker.delivery GraphQL API 클라이언트
// https://tracker.delivery/docs/tracking-api

const GRAPHQL_ENDPOINT = "https://apis.tracker.delivery/graphql";

export const COURIER_TO_CARRIER_ID: Record<string, string> = {
  "CJ대한통운": "kr.cjlogistics",
  "한진택배":   "kr.hanjin",
  "롯데택배":   "kr.lotte",
  "우체국택배": "kr.epost",
  "로젠택배":   "kr.logen",
  "GS25편의점택배": "kr.gspostbox",
  "쿠팡":       "kr.coupang",
  "컬리":       "kr.kurly",
  "네이버도착보장": "kr.naver",
};

export const TRACKING_STATUS: Record<string, { label: string; step: number; color: string }> = {
  INFORMATION_RECEIVED: { label: "접수 완료",   step: 1, color: "text-gray-500"  },
  AT_PICKUP:            { label: "집하 완료",   step: 2, color: "text-brand-600"  },
  IN_TRANSIT:           { label: "이동 중",     step: 3, color: "text-indigo-600" },
  OUT_FOR_DELIVERY:     { label: "배달 출발",   step: 4, color: "text-orange-600" },
  ATTEMPT_FAIL:         { label: "배달 실패",   step: 3, color: "text-red-600"   },
  AVAILABLE_FOR_PICKUP: { label: "보관 중",     step: 4, color: "text-amber-600" },
  DELIVERED:            { label: "배달 완료",   step: 5, color: "text-green-600" },
  UNKNOWN:              { label: "알 수 없음",   step: 0, color: "text-gray-400"  },
};

export interface TrackingEvent {
  time: string;
  statusCode: string;
  statusLabel: string;
  description: string;
  location: string;
}

export interface TrackingResult {
  carrierId: string;
  trackingNo: string;
  statusCode: string;
  lastEvent: TrackingEvent | null;
  events: TrackingEvent[];
}

function buildAuthHeader(): string | null {
  const clientId     = process.env.TRACKER_DELIVERY_CLIENT_ID;
  const clientSecret = process.env.TRACKER_DELIVERY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return `TRACKQL-API-KEY ${clientId}:${clientSecret}`;
}

const TRACK_QUERY = `
  query TrackParcel($carrierId: ID!, $trackingNumber: String!) {
    track(carrierId: $carrierId, trackingNumber: $trackingNumber) {
      lastEvent {
        time
        status { code name }
        description
        location { name }
      }
      events(last: 20) {
        edges {
          node {
            time
            status { code name }
            description
            location { name }
          }
        }
      }
    }
  }
`;

export async function trackParcel(
  carrierId: string,
  trackingNumber: string
): Promise<TrackingResult | null> {
  const auth = buildAuthHeader();
  if (!auth) {
    console.warn("[tracking] TRACKER_DELIVERY_CLIENT_ID/SECRET not set — skip");
    return null;
  }

  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        query: TRACK_QUERY,
        variables: { carrierId, trackingNumber },
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      console.error("[tracking] HTTP error:", res.status);
      return null;
    }

    const json = await res.json();
    if (json.errors?.length) {
      console.error("[tracking] GraphQL errors:", json.errors[0]?.message);
      return null;
    }

    const track = json.data?.track;
    if (!track) return null;

    const mapEvent = (node: {
      time: string;
      status: { code: string; name: string };
      description: string;
      location?: { name?: string };
    }): TrackingEvent => ({
      time:        node.time,
      statusCode:  node.status?.code ?? "UNKNOWN",
      statusLabel: node.status?.name ?? "",
      description: node.description ?? "",
      location:    node.location?.name ?? "",
    });

    const events: TrackingEvent[] = (track.events?.edges ?? [])
      .map((e: { node: Parameters<typeof mapEvent>[0] }) => mapEvent(e.node))
      .reverse();

    const lastEvent = track.lastEvent ? mapEvent(track.lastEvent) : (events[0] ?? null);
    const statusCode = lastEvent?.statusCode ?? "UNKNOWN";

    return { carrierId, trackingNo: trackingNumber, statusCode, lastEvent, events };
  } catch (err) {
    console.error("[tracking] fetch error:", err);
    return null;
  }
}
