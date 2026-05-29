import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/supabase/server';
import { insertOrder, formatEpostOrderNo } from '@/lib/epost/client';

export const preferredRegion = 'icn1';

const SENDER = {
  name:    process.env.INFRONT_SENDER_NAME    ?? '인프론트',
  zip:     process.env.INFRONT_SENDER_ZIPCODE ?? '',
  addr1:   process.env.INFRONT_SENDER_ADDR1   ?? '',
  addr2:   process.env.INFRONT_SENDER_ADDR2   ?? '',
  tel:     process.env.INFRONT_SENDER_TEL2    ?? '',
  mob:     process.env.INFRONT_SENDER_TEL2    ?? '',
};

// 내용품코드: 40 = 의류 (우체국 소포 표준코드)
const DEFAULT_CONT_CD = process.env.EPOST_CONT_CD ?? '40';

/**
 * POST /api/admin/epost/book-domestic
 * 국내 배송 신청 건을 우체국 소포 API로 접수합니다.
 *
 * Body:
 *   domestic_order_id  string  UUID
 *   weight_g           number  총중량(g)
 *   vol_length?        number  가로(cm)
 *   vol_width?         number  세로(cm)
 *   vol_height?        number  높이(cm)
 *   test_yn?           'Y'|'N' 테스트 여부 (기본 'N')
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await req.json() as {
      domestic_order_id: string;
      weight_g: number;
      vol_length?: number;
      vol_width?: number;
      vol_height?: number;
      test_yn?: 'Y' | 'N';
    };

    const { domestic_order_id, weight_g, vol_length, vol_width, vol_height, test_yn } = body;
    if (!domestic_order_id) return NextResponse.json({ error: 'domestic_order_id 필수' }, { status: 400 });
    if (!weight_g)          return NextResponse.json({ error: 'weight_g(총중량g) 필수' }, { status: 400 });

    // 국내 배송 신청 조회
    const { data: order, error: orderErr } = await adminDb
      .from('domestic_orders')
      .select(`
        id, status, customer_id, epost_regi_no,
        recipient_name, recipient_phone, recipient_zip,
        recipient_addr1, recipient_addr2,
        items_desc, delivery_msg, total_quantity:parcel_ids
      `)
      .eq('id', domestic_order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: '국내 배송 신청을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (order.status !== 'PENDING') {
      return NextResponse.json(
        { error: `이미 처리된 신청입니다. 현재 상태: ${order.status}` },
        { status: 409 },
      );
    }

    if (order.epost_regi_no) {
      return NextResponse.json(
        { error: `이미 우체국 접수된 신청입니다. 운송장번호: ${order.epost_regi_no}` },
        { status: 409 },
      );
    }

    const orderNo = formatEpostOrderNo('DOM', 1);

    // 부피 (cm → cm³ 용적환산: L×W×H / 5000 * 1000 = cm³ 기준이 아닌 우체국 규격 cm)
    let volume = 60;
    if (vol_length && vol_width && vol_height) {
      volume = Math.floor((vol_length * vol_width * vol_height) / 5000);
      volume = Math.max(60, volume);
    }

    const result = await insertOrder({
      custNo: '',           // 환경변수에서 자동 사용
      apprNo: '',
      payType: '2',         // 신용 (월 정산)
      reqType: '1',         // 발송
      orderNo,
      recNm:    order.recipient_name,
      recZip:   order.recipient_zip,
      recAddr1: order.recipient_addr1,
      recAddr2: order.recipient_addr2 || '없음',
      recMob:   order.recipient_phone,
      contCd:   DEFAULT_CONT_CD,
      goodsNm:  order.items_desc || '의류',
      ordCompNm: SENDER.name,
      ordNm:    SENDER.name,
      ordZip:   SENDER.zip,
      ordAddr1: SENDER.addr1,
      ordAddr2: SENDER.addr2,
      ordTel:   SENDER.tel,
      ordMob:   SENDER.mob,
      weight:   Math.max(1, Math.floor(weight_g / 1000)),
      volume,
      delivMsg: order.delivery_msg || '',
      testYn:   test_yn ?? 'N',
      printYn:  'Y',
    });

    const price = parseInt(result.price ?? '0', 10);

    // DB 업데이트
    await adminDb
      .from('domestic_orders')
      .update({
        epost_order_no:   orderNo,
        epost_regi_no:    result.regiNo,
        epost_req_no:     result.reqNo,
        epost_res_no:     result.resNo,
        epost_regi_po:    result.regiPoNm,
        epost_price:      price,
        epost_applied_at: new Date().toISOString(),
        weight_g,
        vol_length:  vol_length ?? null,
        vol_width:   vol_width  ?? null,
        vol_height:  vol_height ?? null,
        status:      'BOOKED',
        updated_at:  new Date().toISOString(),
      })
      .eq('id', domestic_order_id);

    // 고객 알림
    await adminDb.from('notifications').insert({
      customer_id: order.customer_id,
      order_id:    null,
      type:        'DOMESTIC_SHIPPED',
      title:       '국내 배송이 접수되었습니다 📦',
      body:        `운송장번호 ${result.regiNo} · 요금 ${price.toLocaleString()}원`,
      data:        { domestic_order_id, regi_no: result.regiNo },
    });

    return NextResponse.json({ ok: true, ...result, price });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[Admin EPost Domestic]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
