import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchEmsTraceEvents,
  isEmsDelivered,
  resolveOrderRegino,
  toIntlTrackingLastEvent,
  type EmsTraceEvent,
} from '@/lib/ems/tracking';
import { trackParcel } from '@/lib/tracking/client';

const SYNC_STATUSES = ['IN_TRANSIT', 'CUSTOMS_FILING'] as const;

const INTL_CARRIER: Record<string, string> = {
  EMS: 'kr.epost',
  EMS_PREMIUM: 'kr.epost',
  KPACKET: 'kr.epost',
};

export type IntlSyncResult = 'delivered' | 'updated' | 'skipped' | 'error';

type OrderRow = {
  id: string;
  order_no: string;
  customer_id: string;
  status: string;
  shipping_method: string | null;
  ems_regino: string | null;
  intl_tracking_no: string | null;
  shipping_boxes?: Array<{ intl_tracking_no?: string | null }> | null;
};

function eventsFromTracker(
  regino: string,
  events: Array<{ time: string; statusCode: string; statusLabel: string; description: string; location: string }>,
) {
  return events.map((e) => ({
    regino,
    processDe: e.time,
    processSttus: e.statusLabel || e.statusCode,
    nowLc: e.location,
    detailDc: e.description,
  } satisfies EmsTraceEvent));
}

async function fetchTrackingEvents(
  regino: string,
  shippingMethod: string | null,
): Promise<EmsTraceEvent[] | null> {
  const emsEvents = await fetchEmsTraceEvents(regino);
  if (emsEvents && emsEvents.length > 0) return emsEvents;

  const carrierId = shippingMethod ? INTL_CARRIER[shippingMethod] : 'kr.epost';
  const tracked = await trackParcel(carrierId, regino);
  if (!tracked?.events.length) return emsEvents ?? null;

  return eventsFromTracker(regino, tracked.events);
}

export async function syncOrderIntlTracking(
  supabase: SupabaseClient,
  order: OrderRow,
): Promise<IntlSyncResult> {
  if (!SYNC_STATUSES.includes(order.status as (typeof SYNC_STATUSES)[number])) {
    return 'skipped';
  }

  const regino = resolveOrderRegino(order);
  if (!regino) return 'skipped';

  const events = await fetchTrackingEvents(regino, order.shipping_method);
  if (events === null) return 'error';

  const now = new Date().toISOString();
  const latest = events[0] ?? null;
  const delivered = isEmsDelivered(events) ||
    events.some((e) => /DELIVERED/i.test(e.processSttus));

  const trackingPayload = {
    intl_tracking_events: events.map(toIntlTrackingLastEvent),
    intl_tracking_last_event: latest ? toIntlTrackingLastEvent(latest) : null,
    intl_tracking_synced_at: now,
    intl_tracking_status: delivered ? 'DELIVERED' : 'IN_TRANSIT',
    updated_at: now,
  };

  if (delivered) {
    await supabase
      .from('orders')
      .update({
        ...trackingPayload,
        status: 'DELIVERED',
        delivered_at: now,
      })
      .eq('id', order.id);

    await supabase
      .from('shipping_boxes')
      .update({ status: 'DELIVERED', updated_at: now })
      .eq('order_id', order.id);

    const { data: links } = await supabase
      .from('order_parcels')
      .select('parcel_id')
      .eq('order_id', order.id);

    if (links?.length) {
      await supabase
        .from('parcels')
        .update({ status: 'DONE', updated_at: now })
        .in('id', links.map((l) => l.parcel_id));
    }

    await supabase.from('notifications').insert({
      customer_id: order.customer_id,
      order_id: order.id,
      type: 'ORDER_DELIVERED',
      title: '배송이 완료되었습니다 🎉',
      body: `주문 ${order.order_no} · 등기번호 ${regino}`,
      data: { order_id: order.id, regino },
    });

    return 'delivered';
  }

  await supabase.from('orders').update(trackingPayload).eq('id', order.id);
  return 'updated';
}

export async function syncIntlTrackingBatch(
  supabase: SupabaseClient,
  options?: { customerId?: string; orderId?: string; limit?: number },
): Promise<{ checked: number; delivered: number; updated: number; skipped: number; errors: number }> {
  let query = supabase
    .from('orders')
    .select(`
      id, order_no, customer_id, status, shipping_method,
      ems_regino, intl_tracking_no,
      shipping_boxes (intl_tracking_no)
    `)
    .in('status', [...SYNC_STATUSES])
    .order('updated_at', { ascending: true })
    .limit(options?.limit ?? 100);

  if (options?.customerId) query = query.eq('customer_id', options.customerId);
  if (options?.orderId) query = query.eq('id', options.orderId);

  const { data: orders, error } = await query;
  if (error) throw new Error(error.message);

  const stats = { checked: 0, delivered: 0, updated: 0, skipped: 0, errors: 0 };

  for (const order of orders ?? []) {
    stats.checked++;
    const result = await syncOrderIntlTracking(supabase, order as OrderRow);
    if (result === 'delivered') stats.delivered++;
    else if (result === 'updated') stats.updated++;
    else if (result === 'skipped') stats.skipped++;
    else stats.errors++;

    // 공공 API rate limit 완화
    await new Promise((r) => setTimeout(r, 200));
  }

  return stats;
}
