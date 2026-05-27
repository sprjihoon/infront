/**
 * 국내 입고 전 구간 API 동기화
 * - PICKUP: 우체국 GetResInfo (수거신청)
 * - DIRECT: tracker.delivery (물품등록·타택배)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getResInfo } from "@/lib/epost/client";
import {
  trackParcel,
  COURIER_TO_CARRIER_ID,
  TRACKING_STATUS,
} from "@/lib/tracking/client";

export type InboundSource = "PICKUP" | "DIRECT";

export type ParcelInboundRow = {
  id: string;
  customer_id: string;
  status: string;
  is_shippable: boolean | null;
  tracking_no: string | null;
  courier: string | null;
  tracking_carrier_id: string | null;
  inbound_source: string | null;
  epost_order_no: string | null;
  epost_req_no: string | null;
  pickup_requested_at: string | null;
  pickup_tracking_no: string | null;
  tracking_status: string | null;
  tracking_last_event: unknown;
  tracking_events: unknown;
};

const PRE_INBOUND = new Set(["PRE_REGISTERED", "PENDING_PICKUP", "PICKED_UP"]);

export function resolveInboundSource(
  p: Pick<ParcelInboundRow, "inbound_source" | "epost_order_no" | "pickup_tracking_no">,
): InboundSource {
  if (p.inbound_source === "PICKUP" || p.inbound_source === "DIRECT") return p.inbound_source;
  if (p.epost_order_no || p.pickup_tracking_no) return "PICKUP";
  return "DIRECT";
}

function carrierIdFor(p: ParcelInboundRow): string | null {
  return (
    p.tracking_carrier_id ??
    (p.courier ? COURIER_TO_CARRIER_ID[p.courier] ?? null : null) ??
    (resolveInboundSource(p) === "PICKUP" ? "kr.epost" : null)
  );
}

export type SyncOneResult =
  | { parcelId: string; action: "pickup_status" | "tracking_update" | "auto_inbound" | "skipped"; detail?: string }
  | { parcelId: string; action: "error"; detail: string };

function epostToStatus(treatStusCd: string): { status: string; is_shippable?: boolean; inbound_at?: string } | null {
  const cd = treatStusCd.padStart(2, "0");
  if (cd === "00") return null;
  if (cd === "01" || cd === "02") return { status: "PICKED_UP" };
  if (cd === "03") {
    return { status: "INBOUND", is_shippable: false, inbound_at: new Date().toISOString().slice(0, 10) };
  }
  if (parseInt(cd, 10) >= 1) return { status: "PICKED_UP" };
  return null;
}

function trackingToStatus(statusCode: string): { status: string; is_shippable?: boolean; inbound_at?: string } | null {
  if (statusCode === "DELIVERED") {
    return { status: "INBOUND", is_shippable: false, inbound_at: new Date().toISOString().slice(0, 10) };
  }
  if (["AT_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(statusCode)) {
    return { status: "PICKED_UP" };
  }
  return null;
}

async function syncPickupParcel(db: SupabaseClient, p: ParcelInboundRow): Promise<SyncOneResult> {
  if (!p.epost_order_no || !p.pickup_requested_at) {
    return { parcelId: p.id, action: "skipped", detail: "no epost order" };
  }
  if (p.epost_req_no?.startsWith("MOCK-")) {
    return { parcelId: p.id, action: "skipped", detail: "mock" };
  }

  const reqYmd = new Date(p.pickup_requested_at).toISOString().slice(0, 10).replace(/-/g, "");

  try {
    const result = await getResInfo({ reqType: "2", orderNo: p.epost_order_no, reqYmd });
    const next = epostToStatus(result.treatStusCd);
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = { tracking_synced_at: now };
    if (result.regiNo && !p.tracking_no) {
      updates.tracking_no = result.regiNo;
      updates.pickup_tracking_no = result.regiNo;
    }

    if (next && PRE_INBOUND.has(p.status)) {
      updates.status = next.status;
      if (next.is_shippable !== undefined) updates.is_shippable = next.is_shippable;
      if (next.inbound_at) updates.inbound_at = next.inbound_at;

      await db.from("parcels").update(updates).eq("id", p.id);

      const titles: Record<string, string> = { PICKED_UP: "수거 완료", INBOUND: "센터 입고" };
      if (titles[next.status]) {
        await db.from("notifications").insert({
          customer_id: p.customer_id,
          parcel_id: p.id,
          type: `PARCEL_${next.status}`,
          title: titles[next.status],
          body:
            next.status === "INBOUND"
              ? "물품이 센터에 도착했습니다. 검수 후 출고 가능합니다."
              : `운송장 ${result.regiNo ?? p.pickup_tracking_no ?? ""} 수거가 완료되었습니다.`,
        });
      }

      return {
        parcelId: p.id,
        action: next.status === "INBOUND" ? "auto_inbound" : "pickup_status",
        detail: result.treatStusNm ?? result.treatStusCd,
      };
    }

    await db.from("parcels").update(updates).eq("id", p.id);
    return { parcelId: p.id, action: "pickup_status", detail: result.treatStusNm ?? result.treatStusCd };
  } catch (e) {
    return { parcelId: p.id, action: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}

async function syncDirectParcel(db: SupabaseClient, p: ParcelInboundRow): Promise<SyncOneResult> {
  const carrierId = carrierIdFor(p);
  const trackingNo = p.tracking_no?.trim();
  if (!carrierId || !trackingNo) {
    return { parcelId: p.id, action: "skipped", detail: "no carrier/tracking" };
  }

  try {
    const result = await trackParcel(carrierId, trackingNo);
    if (!result) return { parcelId: p.id, action: "skipped", detail: "tracking API empty" };

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
      tracking_carrier_id: carrierId,
      tracking_status: result.statusCode,
      tracking_last_event: result.lastEvent,
      tracking_events: result.events,
      tracking_synced_at: now,
    };

    const next = PRE_INBOUND.has(p.status) ? trackingToStatus(result.statusCode) : null;

    if (next) {
      updates.status = next.status;
      if (next.is_shippable !== undefined) updates.is_shippable = next.is_shippable;
      if (next.inbound_at) updates.inbound_at = next.inbound_at;
    }

    await db.from("parcels").update(updates).eq("id", p.id);

    if (next?.status === "INBOUND") {
      await db.from("notifications").insert({
        customer_id: p.customer_id,
        parcel_id: p.id,
        type: "PARCEL_INBOUND",
        title: "센터에 입고되었습니다",
        body: `운송장 ${trackingNo} 물품이 센터에 도착했습니다.`,
      });
      return { parcelId: p.id, action: "auto_inbound", detail: TRACKING_STATUS[result.statusCode]?.label };
    }

    return {
      parcelId: p.id,
      action: "tracking_update",
      detail: TRACKING_STATUS[result.statusCode]?.label ?? result.statusCode,
    };
  } catch (e) {
    return { parcelId: p.id, action: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}

export async function syncParcelInbound(db: SupabaseClient, p: ParcelInboundRow): Promise<SyncOneResult> {
  const source = resolveInboundSource(p);
  if (source === "PICKUP") {
    if (p.status === "PENDING_PICKUP" || (p.epost_order_no && PRE_INBOUND.has(p.status))) {
      return syncPickupParcel(db, p);
    }
    if (p.tracking_no && PRE_INBOUND.has(p.status)) {
      return syncDirectParcel(db, p);
    }
    return { parcelId: p.id, action: "skipped", detail: "pickup done" };
  }
  return syncDirectParcel(db, p);
}

export type BatchSyncSummary = {
  checked: number;
  pickup_updated: number;
  tracking_updated: number;
  auto_inbound: number;
  skipped: number;
  errors: number;
  results: SyncOneResult[];
};

export async function syncParcelsInboundBatch(
  db: SupabaseClient,
  options?: { source?: InboundSource; parcelId?: string; limit?: number },
): Promise<BatchSyncSummary> {
  let query = db
    .from("parcels")
    .select(`
      id, customer_id, status, is_shippable,
      tracking_no, courier, tracking_carrier_id, inbound_source,
      epost_order_no, epost_req_no, pickup_requested_at, pickup_tracking_no,
      tracking_status, tracking_last_event, tracking_events
    `)
    .in("status", Array.from(PRE_INBOUND))
    .order("created_at", { ascending: true })
    .limit(options?.limit ?? 200);

  if (options?.parcelId) query = query.eq("id", options.parcelId);
  if (options?.source === "PICKUP") {
    query = query.or("inbound_source.eq.PICKUP,epost_order_no.not.is.null");
  } else if (options?.source === "DIRECT") {
    query = query.or("inbound_source.eq.DIRECT,and(epost_order_no.is.null,pickup_tracking_no.is.null)");
  }

  const { data: parcels, error } = await query;
  if (error) throw new Error(error.message);

  const summary: BatchSyncSummary = {
    checked: parcels?.length ?? 0,
    pickup_updated: 0,
    tracking_updated: 0,
    auto_inbound: 0,
    skipped: 0,
    errors: 0,
    results: [],
  };

  for (const row of parcels ?? []) {
    const p = row as ParcelInboundRow;
    if (options?.source && resolveInboundSource(p) !== options.source) {
      summary.skipped++;
      continue;
    }
    const r = await syncParcelInbound(db, p);
    summary.results.push(r);
    if (r.action === "error") summary.errors++;
    else if (r.action === "skipped") summary.skipped++;
    else if (r.action === "pickup_status") summary.pickup_updated++;
    else if (r.action === "tracking_update") summary.tracking_updated++;
    else if (r.action === "auto_inbound") summary.auto_inbound++;
  }

  return summary;
}
