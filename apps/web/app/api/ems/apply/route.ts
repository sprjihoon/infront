import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { applyEms, mockApplyEms, type EmsApplyParams } from '@/lib/ems/client';
import { getOrderInsuranceParams } from '@/lib/ems/insurance';

export const preferredRegion = 'icn1'; // 우체국 API 접근을 위해 서울 리전 고정

const USE_MOCK = process.env.EMS_MOCK === 'true';

// 인프론트 발송인 정보
const SENDER = {
  name:    process.env.INFRONT_SENDER_NAME     ?? 'Infront',
  zipcode: process.env.INFRONT_SENDER_ZIPCODE  ?? '',
  addr1:   process.env.INFRONT_SENDER_ADDR1    ?? '',
  addr2:   process.env.INFRONT_SENDER_ADDR2    ?? '',
  addr3:   process.env.INFRONT_SENDER_ADDR3    ?? '',
  tel1:    process.env.INFRONT_SENDER_TEL1     ?? '82',
  tel2:    process.env.INFRONT_SENDER_TEL2     ?? '',
  tel3:    process.env.INFRONT_SENDER_TEL3     ?? '',
  tel4:    process.env.INFRONT_SENDER_TEL4     ?? '',
};

/**
 * POST /api/ems/apply
 * EMS / K-Packet 국제발송 신청
 *
 * 요청 Body (두 가지 모드):
 *
 * [모드 1] order_id 기반 — orders 테이블에서 수취인·물품 정보 자동 조회
 *   order_id    string  DB 주문 ID
 *   totweight   number  총중량(g) — 창고 실측값
 *   boxlength   number  가로(cm)
 *   boxwidth    number  세로(cm)
 *   boxheight   number  높이(cm)
 *   item_weights? string  품목별 순중량g (;구분, 미입력 시 totweight 균등 분배)
 *
 * [모드 2] parcel_id 기반 (레거시) — 모든 필드 직접 전달
 *   parcel_id   string  DB 소포 ID
 *   premiumcd, em_ee, countrycd, totweight, boxlength, boxwidth, boxheight,
 *   receivename, receiveaddr1/2/3, contents, number, weight, value, hs_code,
 *   origin, currunitcd ... (EmsApplyParams 전체)
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  try {
    const body = await req.json() as Record<string, unknown>;
    const { order_id, parcel_id, ...rest } = body as {
      order_id?: string;
      parcel_id?: string;
    } & Partial<EmsApplyParams> & {
      totweight?: number;
      boxlength?: number;
      boxwidth?: number;
      boxheight?: number;
      item_weights?: string;
    };

    // ── 모드 1: order_id 기반 ────────────────────────────────
    if (order_id) {
      // orders + item_list 조회
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select(`
          id, order_no, shipping_method,
          recipient_name, recipient_phone, recipient_email,
          recipient_country,
          recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip,
          item_list, customs_value,
          insurance_enabled, insurance_amount
        `)
        .eq('id', order_id)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
      }

      // shipping_method → premiumcd / em_ee 변환
      const METHOD_MAP: Record<string, { premiumcd: string; em_ee: string }> = {
        EMS:         { premiumcd: '31', em_ee: 'em' },
        EMS_PREMIUM: { premiumcd: '32', em_ee: 'em' },
        KPACKET:     { premiumcd: '14', em_ee: 'rl' },
      };
      const method = METHOD_MAP[order.shipping_method ?? ''];
      if (!method) {
        return NextResponse.json({ error: `지원하지 않는 배송 방법: ${order.shipping_method}` }, { status: 400 });
      }

      // 필수값 검증
      const totweight = Number(rest.totweight);
      const boxlength = Number(rest.boxlength);
      const boxwidth  = Number(rest.boxwidth);
      const boxheight = Number(rest.boxheight);
      if (!totweight || !boxlength || !boxwidth || !boxheight) {
        return NextResponse.json(
          { error: '총중량(totweight)과 박스 크기(boxlength/width/height)는 필수입니다.' },
          { status: 400 },
        );
      }
      if (!order.recipient_addr3) {
        return NextResponse.json(
          { error: '주문에 수취인 상세주소(recipient_addr3)가 없습니다. 마이그레이션(012) 실행 여부를 확인하세요.' },
          { status: 400 },
        );
      }

      // item_list → EMS 세미콜론 구분 문자열 변환
      type ItemRow = {
        name_en: string;
        quantity: number;
        unit_price_usd: number;
        hs_code?: string;
        origin_country?: string;
      };
      const items: ItemRow[] = Array.isArray(order.item_list) ? order.item_list : [];
      if (!items.length) {
        return NextResponse.json({ error: '주문에 물품 내역(item_list)이 없습니다.' }, { status: 400 });
      }

      // 품목별 순중량: 입력값 우선, 없으면 totweight 균등 분배
      let perWeights: number[];
      if (rest.item_weights) {
        perWeights = String(rest.item_weights).split(';').map(Number);
      } else {
        const each = Math.floor(totweight / items.length);
        perWeights = items.map((_, i) =>
          i < items.length - 1 ? each : totweight - each * (items.length - 1)
        );
      }

      const ins = getOrderInsuranceParams(order);

      const applyParams: EmsApplyParams = {
        premiumcd:   method.premiumcd,
        em_ee:       method.em_ee,
        countrycd:   order.recipient_country ?? '',
        totweight,
        boxlength,
        boxwidth,
        boxheight,
        // 발송인 (인프론트 창고)
        sender:        SENDER.name,
        senderzipcode: SENDER.zipcode,
        senderaddr1:   SENDER.addr1,
        senderaddr2:   SENDER.addr2,
        senderaddr3:   SENDER.addr3,
        sendertelno1:  SENDER.tel1,
        sendertelno2:  SENDER.tel2,
        sendertelno3:  SENDER.tel3,
        sendertelno4:  SENDER.tel4,
        // 수취인
        receivename:     order.recipient_name    ?? '',
        receivezipcode:  order.recipient_zip     ?? '',
        receiveaddr1:    order.recipient_addr1   ?? '',
        receiveaddr2:    order.recipient_addr2   ?? '',
        receiveaddr3:    order.recipient_addr3   ?? '',
        receivetelno:    order.recipient_phone   ?? '',
        receivemail:     order.recipient_email   ?? '',
        // 물품 정보
        EM_gubun:   items.map(() => 'Merchandise').join(';'),
        contents:   items.map((it) => it.name_en).join(';'),
        number:     items.map((it) => it.quantity).join(';'),
        weight:     perWeights.join(';'),
        value:      items.map((it) => it.unit_price_usd).join(';'),
        hs_code:    items.map((it) => it.hs_code ?? '').join(';'),
        origin:     items.map((it) => it.origin_country ?? 'KR').join(';'),
        currunitcd: 'USD',
        orderno:    `SPB-${order_id}`,
        boyn:       ins.boyn,
        boprc:      ins.boprc,
      };

      const result = USE_MOCK ? mockApplyEms(applyParams) : await applyEms(applyParams);

      // orders 테이블에 EMS 결과 저장
      await supabase
        .from('orders')
        .update({
          ems_regino:      result.regino,
          ems_receive_seq: result.receiveseq,
          ems_req_no:      result.reqno,
          ems_fee:         parseInt(result.prerecevprc, 10),
          ems_premium_cd:  method.premiumcd,
          ems_applied_at:  new Date().toISOString(),
          intl_tracking_no: result.regino,
          status:          'PACKAGING_DONE',
          updated_at:      new Date().toISOString(),
        })
        .eq('id', order_id);

      // 알림
      const { data: orderForNotif } = await supabase
        .from('orders')
        .select('customer_id, order_no')
        .eq('id', order_id)
        .single();

      if (orderForNotif?.customer_id) {
        await supabase.from('notifications').insert({
          customer_id: orderForNotif.customer_id,
          order_id,
          type:  'SHIPPED',
          title: 'EMS 발송 신청 완료',
          body:  `${orderForNotif.order_no} 등기번호 ${result.regino} / 예상요금 ${parseInt(result.prerecevprc).toLocaleString()}원`,
          data:  { order_id, regino: result.regino },
        });
      }

      return NextResponse.json({ ok: true, ...result });
    }

    // ── 모드 2: parcel_id 기반 (레거시) ─────────────────────
    const required = [
      'premiumcd','em_ee','countrycd','totweight',
      'boxlength','boxwidth','boxheight',
      'receivename','receiveaddr1','receiveaddr2','receiveaddr3',
      'contents','number','weight','value','hs_code','origin','currunitcd',
    ];
    const missing = required.filter(k => !rest[k as keyof typeof rest]);
    if (missing.length) {
      return NextResponse.json({ error: `필수 항목 누락: ${missing.join(', ')}` }, { status: 400 });
    }

    const applyParams: EmsApplyParams = {
      ...(rest as EmsApplyParams),
      sender:        SENDER.name,
      senderzipcode: SENDER.zipcode,
      senderaddr1:   SENDER.addr1,
      senderaddr2:   SENDER.addr2,
      senderaddr3:   SENDER.addr3,
      sendertelno1:  SENDER.tel1,
      sendertelno2:  SENDER.tel2,
      sendertelno3:  SENDER.tel3,
      sendertelno4:  SENDER.tel4,
      EM_gubun:      (rest as EmsApplyParams).EM_gubun ?? 'Merchandise',
      boyn:          (rest as EmsApplyParams).boyn ?? 'N',
      orderno:       parcel_id ? `SPB-${parcel_id}` : undefined,
    };

    const result = USE_MOCK ? mockApplyEms(applyParams) : await applyEms(applyParams);

    if (parcel_id) {
      await supabase
        .from('parcels')
        .update({
          ems_regino:      result.regino,
          ems_receive_seq: result.receiveseq,
          ems_req_no:      result.reqno,
          ems_fee:         parseInt(result.prerecevprc, 10),
          ems_country:     (rest as EmsApplyParams).countrycd,
          ems_premium_cd:  (rest as EmsApplyParams).premiumcd,
          status:          'ems_applied',
          updated_at:      new Date().toISOString(),
        })
        .eq('id', parcel_id);

      const { data: parcel } = await supabase
        .from('parcels')
        .select('customer_id')
        .eq('id', parcel_id)
        .single();

      if (parcel?.customer_id) {
        await supabase.from('notifications').insert({
          customer_id: parcel.customer_id,
          type:  'ems_applied',
          title: 'EMS 발송 신청 완료',
          body:  `등기번호 ${result.regino} / 예상요금 ${parseInt(result.prerecevprc).toLocaleString()}원`,
          data:  { parcel_id, regino: result.regino },
        });
      }
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[EMS Apply]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
