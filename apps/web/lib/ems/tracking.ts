/**
 * 우체국 EMS 행방조회 (공공데이터 OpenAPI)
 * http://openapi.epost.go.kr/trace/retrieveLongitudinalEMSService/.../getLongitudinalEMSList
 */

const EMS_TRACE_URL =
  'http://openapi.epost.go.kr/trace/retrieveLongitudinalEMSService/retrieveLongitudinalEMSService/getLongitudinalEMSList';

export interface EmsTraceEvent {
  regino: string;
  processDe: string;
  processSttus: string;
  nowLc?: string;
  detailDc?: string;
}

function stripCdata(raw: string): string {
  const m = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return m ? m[1].trim() : raw;
}

function parseAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(stripCdata(m[1].trim()));
  return out;
}

const DELIVERED_PATTERNS = [
  /배달완료/,
  /배송완료/,
  /배달\s*완료/,
  /delivered/i,
  /delivery complete/i,
  /successfully delivered/i,
  /수령완료/,
  /수취완료/,
];

export function isEmsDelivered(events: EmsTraceEvent[]): boolean {
  return events.some((e) => {
    const text = `${e.processSttus} ${e.detailDc ?? ''}`;
    return DELIVERED_PATTERNS.some((p) => p.test(text));
  });
}

export function resolveOrderRegino(order: {
  ems_regino?: string | null;
  intl_tracking_no?: string | null;
  shipping_boxes?: Array<{ intl_tracking_no?: string | null }> | null;
}): string | null {
  if (order.ems_regino?.trim()) return order.ems_regino.trim();
  if (order.intl_tracking_no?.trim()) return order.intl_tracking_no.trim();
  const boxNo = order.shipping_boxes?.find((b) => b.intl_tracking_no?.trim())?.intl_tracking_no;
  return boxNo?.trim() ?? null;
}

export async function fetchEmsTraceEvents(regino: string): Promise<EmsTraceEvent[] | null> {
  const serviceKey = process.env.EPOST_TRACE_SERVICE_KEY?.trim();
  if (!serviceKey) {
    console.warn('[ems/tracking] EPOST_TRACE_SERVICE_KEY not set — skip');
    return null;
  }

  const url = new URL(EMS_TRACE_URL);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('rgist', regino);

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/xml, text/xml, */*' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.error('[ems/tracking] HTTP', res.status, regino);
      return null;
    }

    const xml = await res.text();
    if (xml.includes('<error_code>') || xml.includes('ERR-')) {
      console.warn('[ems/tracking] API error for', regino, xml.slice(0, 200));
      return null;
    }

    const processDes = parseAll(xml, 'processDe');
    const processSttus = parseAll(xml, 'processSttus');
    const nowLcs = parseAll(xml, 'nowLc');
    const detailDcs = parseAll(xml, 'detailDc');
    const rgists = parseAll(xml, 'rgist');

    if (processDes.length === 0) return [];

    return processDes.map((processDe, i) => ({
      regino: rgists[i] ?? regino,
      processDe,
      processSttus: processSttus[i] ?? '',
      nowLc: nowLcs[i],
      detailDc: detailDcs[i],
    }));
  } catch (e) {
    console.error('[ems/tracking] fetch error:', e instanceof Error ? e.message : e);
    return null;
  }
}

/** EmsTraceEvent → order intl_tracking_last_event JSON 형식 */
export function toIntlTrackingLastEvent(event: EmsTraceEvent) {
  return {
    time: event.processDe,
    statusLabel: event.processSttus,
    description: event.detailDc ?? event.processSttus,
    location: event.nowLc ?? '',
    source: 'epost_ems_trace' as const,
  };
}
