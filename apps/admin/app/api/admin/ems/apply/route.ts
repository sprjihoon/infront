import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { applyEms, mockApplyEms, type EmsApplyParams } from '@/lib/ems/client';

export const preferredRegion = 'icn1';

const USE_MOCK = process.env.EMS_MOCK === 'true';

const SENDER = {
  name:    process.env.INFRONT_SENDER_NAME    ?? 'Infront',
  zipcode: process.env.INFRONT_SENDER_ZIPCODE ?? '',
  addr1:   process.env.INFRONT_SENDER_ADDR1   ?? '',
  addr2:   process.env.INFRONT_SENDER_ADDR2   ?? '',
  addr3:   process.env.INFRONT_SENDER_ADDR3   ?? '',
  tel1:    process.env.INFRONT_SENDER_TEL1    ?? '82',
  tel2:    process.env.INFRONT_SENDER_TEL2    ?? '',
  tel3:    process.env.INFRONT_SENDER_TEL3    ?? '',
  tel4:    process.env.INFRONT_SENDER_TEL4    ?? '',
};

const METHOD_MAP: Record<string, { premiumcd: string; em_ee: string }> = {
  EMS:         { premiumcd: '31', em_ee: 'em' },
  EMS_PREMIUM: { premiumcd: '32', em_ee: 'em' },
  KPACKET:     { premiumcd: '14', em_ee: 'rl' },
};

/**
 * POST /api/admin/ems/apply
 * 어드민 전용 — 주문 단위 EMS/K-Packet 우체국 접수
 *
 * Body:
 *   order_id    string  주문 UUID
 *   totweight   number  총중량(g)  — 창고 실측값
 *   boxlength   number  가로(cm)
 *   boxwidth    number  세로(cm)
 *   boxheight   number  높이(cm)
 *   item_weights? string  품목별 순중량 g (;구분, 미입력 시 totweight 균등 분배)
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as {
      order_id: string;
      totweight: number;
      boxlength: number;
      boxwidth: number;
      boxheight: number;
      item_weights?: string;
    };

    const { order_id, totweight, boxlength, boxwidth, boxheight, item_weights } = body;

    if (!order_id)  return NextResponse.json({ error: 'order_id 필수' }, { status: 400 });
    if (!totweight || !boxlength || !boxwidth || !boxheight) {
      return NextResponse.json(
        { error: '총중량(totweight)과 박스 크기(boxlength/width/height)가 필요합니다.' },
        { status: 400 },
      );
    }

    // 주문 조회
    const { data: order, error: orderErr } = await adminDb
      .from('orders')
      .select(`
        id, order_no, shipping_method, customer_id,
        recipient_name, recipient_phone, recipient_email,
        recipient_country,
        recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip,
        item_list, ems_regino
      `)
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.ems_regino) {
      return NextResponse.json(
        { error: `이미 EMS 접수된 주문입니다. 등기번호: ${order.ems_regino}` },
        { status: 409 },
      );
    }

    const method = METHOD_MAP[order.shipping_method ?? ''];
    if (!method) {
      return NextResponse.json(
        { error: `지원하지 않는 배송방법: ${order.shipping_method}` },
        { status: 400 },
      );
    }

    if (!order.recipient_addr3) {
      return NextResponse.json(
        { error: '수취인 상세주소(recipient_addr3)가 없습니다. SQL 마이그레이션(012) 실행 여부를 확인하세요.' },
        { status: 400 },
      );
    }

    // item_list → EMS 세미콜론 구분 문자열
    type ItemRow = {
      name_en: string;
      quantity: number;
      unit_price_usd: number;
      hs_code?: string;
      origin_country?: string;
    };
    const items: ItemRow[] = Array.isArray(order.item_list) ? order.item_list : [];
    if (!items.length) {
      return NextResponse.json({ error: '인보이스 물품(item_list)이 없습니다.' }, { status: 400 });
    }

    // 품목별 순중량
    let perWeights: number[];
    if (item_weights) {
      perWeights = String(item_weights).split(';').map(Number);
    } else {
      const each = Math.floor(totweight / items.length);
      perWeights = items.map((_, i) =>
        i < items.length - 1 ? each : totweight - each * (items.length - 1)
      );
    }

    const applyParams: EmsApplyParams = {
      premiumcd:   method.premiumcd,
      em_ee:       method.em_ee,
      countrycd:   order.recipient_country ?? '',
      totweight:   Number(totweight),
      boxlength:   Number(boxlength),
      boxwidth:    Number(boxwidth),
      boxheight:   Number(boxheight),
      sender:        SENDER.name,
      senderzipcode: SENDER.zipcode,
      senderaddr1:   SENDER.addr1,
      senderaddr2:   SENDER.addr2,
      senderaddr3:   SENDER.addr3,
      sendertelno1:  SENDER.tel1,
      sendertelno2:  SENDER.tel2,
      sendertelno3:  SENDER.tel3,
      sendertelno4:  SENDER.tel4,
      receivename:    order.recipient_name    ?? '',
      receivezipcode: order.recipient_zip     ?? '',
      receiveaddr1:   order.recipient_addr1   ?? '',
      receiveaddr2:   order.recipient_addr2   ?? '',
      receiveaddr3:   order.recipient_addr3   ?? '',
      receivetelno:   order.recipient_phone   ?? '',
      receivemail:    order.recipient_email   ?? '',
      EM_gubun:   items.map(() => 'Merchandise').join(';'),
      contents:   items.map(it => it.name_en).join(';'),
      number:     items.map(it => it.quantity).join(';'),
      weight:     perWeights.join(';'),
      value:      items.map(it => it.unit_price_usd).join(';'),
      hs_code:    items.map(it => it.hs_code ?? '').join(';'),
      origin:     items.map(it => it.origin_country ?? 'KR').join(';'),
      currunitcd: 'USD',
      orderno:    `SPB-${order_id}`,
      boyn:       'N',
    };

    const result = USE_MOCK ? mockApplyEms(applyParams) : await applyEms(applyParams);
    const emsFeeParsed = parseInt(result.prerecevprc, 10);

    // orders 테이블 업데이트
    await adminDb
      .from('orders')
      .update({
        ems_regino:       result.regino,
        ems_receive_seq:  result.receiveseq,
        ems_req_no:       result.reqno,
        ems_fee:          emsFeeParsed,
        ems_premium_cd:   method.premiumcd,
        ems_applied_at:   new Date().toISOString(),
        intl_tracking_no: result.regino,
        status:           'IN_TRANSIT',
        updated_at:       new Date().toISOString(),
      })
      .eq('id', order_id);

    // 고객 알림
    await adminDb.from('notifications').insert({
      customer_id: order.customer_id,
      order_id,
      type:  'SHIPPED',
      title: '물품이 발송되었습니다 ✈️',
      body:  `${order.order_no} · 등기번호 ${result.regino} · 예상요금 ${emsFeeParsed.toLocaleString()}원`,
      data:  { order_id, regino: result.regino },
    });

    // 연결된 parcel 상태 → SHIPPING
    const { data: parcelLinks } = await adminDb
      .from('order_parcels')
      .select('parcel_id')
      .eq('order_id', order_id);
    if (parcelLinks?.length) {
      await adminDb.from('parcels').update({ status: 'SHIPPING' }).in('id', parcelLinks.map(p => p.parcel_id));
    }

    return NextResponse.json({ ok: true, ...result, ems_fee: emsFeeParsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Admin EMS Apply]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
