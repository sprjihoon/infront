import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { applyEms, mockApplyEms, type EmsApplyParams } from '@/lib/ems/client';

export const preferredRegion = 'icn1'; // EMS API 접근을 위해 서울 리전 고정

const USE_MOCK = process.env.EMS_MOCK === 'true';

const METHOD_MAP: Record<string, { premiumcd: string; em_ee: string }> = {
  EMS:         { premiumcd: '31', em_ee: 'em' },
  EMS_PREMIUM: { premiumcd: '32', em_ee: 'em' },
  KPACKET:     { premiumcd: '14', em_ee: 'rl' },
};

const SENDER = {
  name:    process.env.INFRONT_CENTER_NAME    ?? 'Infront',
  zipcode: (process.env.INFRONT_CENTER_ZIPCODE ?? '').replace(/-/g, ''),
  addr1:   process.env.INFRONT_CENTER_ADDR1   ?? '',
  addr2:   process.env.INFRONT_CENTER_ADDR2   ?? '',
  addr3:   '',
  tel1:    '82',
  tel2:    (process.env.INFRONT_CENTER_PHONE  ?? '').replace(/^0/, '').split('-')[0] ?? '',
  tel3:    (process.env.INFRONT_CENTER_PHONE  ?? '').split('-')[1] ?? '',
  tel4:    (process.env.INFRONT_CENTER_PHONE  ?? '').split('-')[2] ?? '',
};

/**
 * POST /api/payment/confirm
 * Toss Payments 결제 승인 처리 + 결제 완료 시 EMS 자동 접수
 */
export async function POST(req: NextRequest) {
  try {
    const { paymentKey, orderId, amount } = await req.json();

    if (!paymentKey || !orderId || !amount) {
      return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
    }

    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ error: 'Toss 설정이 없습니다.' }, { status: 500 });
    }

    // Toss 결제 승인 API 호출
    const encoded = Buffer.from(`${secretKey}:`).toString('base64');
    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });

    const tossData = await tossRes.json();

    if (!tossRes.ok) {
      console.error('[PAYMENT] Toss confirm error:', tossData);
      return NextResponse.json(
        { error: tossData.message ?? '결제 승인에 실패했습니다.' },
        { status: 400 }
      );
    }

    // DB 업데이트
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) =>
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    // order_no로 order 찾기 (EMS 자동 접수를 위해 필드 더 가져옴)
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id, customer_id, order_no, total_amount, shipping_method,
        recipient_name, recipient_phone, recipient_email,
        recipient_country, recipient_addr1, recipient_addr2, recipient_addr3, recipient_zip,
        item_list, ems_regino
      `)
      .eq('order_no', orderId)
      .eq('customer_id', user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 결제 금액 검증
    if (Number(order.total_amount) !== Number(amount)) {
      console.error('[PAYMENT] Amount mismatch:', order.total_amount, amount);
      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
    }

    // orders 상태 업데이트
    await supabase
      .from('orders')
      .update({
        payment_status: 'PAID',
        payment_key: paymentKey,
        status: 'PAID',
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    // payments 테이블에 기록
    await supabase.from('payments').insert({
      order_id: order.id,
      amount,
      method: tossData.method,
      toss_payment_key: paymentKey,
      toss_order_id: orderId,
      status: 'DONE',
      approved_at: tossData.approvedAt,
      raw: tossData,
    });

    // 결제 완료 알림
    await supabase.from('notifications').insert({
      customer_id: user.id,
      order_id: order.id,
      type: 'PAYMENT',
      title: '결제 완료',
      body: `${amount.toLocaleString()}원 결제가 완료되었습니다. EMS 접수를 진행합니다.`,
    });

    // ─── EMS 자동 접수 ─────────────────────────────────────────────
    // 이미 접수된 경우 스킵
    if (!order.ems_regino) {
      try {
        // 첫 번째 shipping_box에서 실측값 조회
        const { data: boxes } = await supabase
          .from('shipping_boxes')
          .select('weight_kg, length_cm, width_cm, height_cm')
          .eq('order_id', order.id)
          .order('box_seq')
          .limit(1);

        const box = boxes?.[0];
        const hasMeasurements = box?.weight_kg && box?.length_cm && box?.width_cm && box?.height_cm;
        const method = METHOD_MAP[order.shipping_method as string];
        const hasAddress = order.recipient_addr3;

        type ItemRow = { name_en: string; quantity: number; unit_price_usd: number; hs_code?: string; origin_country?: string };
        const items: ItemRow[] = Array.isArray(order.item_list) ? order.item_list : [];

        if (hasMeasurements && method && hasAddress && items.length > 0) {
          const totweightG = Math.round(box.weight_kg! * 1000);
          const each = Math.floor(totweightG / items.length);
          const perWeights = items.map((_, i) =>
            i < items.length - 1 ? each : totweightG - each * (items.length - 1)
          );

          const emsParams: EmsApplyParams = {
            premiumcd:   method.premiumcd,
            em_ee:       method.em_ee,
            countrycd:   order.recipient_country ?? '',
            totweight:   totweightG,
            boxlength:   box.length_cm!,
            boxwidth:    box.width_cm!,
            boxheight:   box.height_cm!,
            sender:         SENDER.name,
            senderzipcode:  SENDER.zipcode,
            senderaddr1:    SENDER.addr1,
            senderaddr2:    SENDER.addr2,
            senderaddr3:    SENDER.addr3,
            sendertelno1:   SENDER.tel1,
            sendertelno2:   SENDER.tel2,
            sendertelno3:   SENDER.tel3,
            sendertelno4:   SENDER.tel4,
            receivename:    order.recipient_name    ?? '',
            receivezipcode: order.recipient_zip     ?? '',
            receiveaddr1:   order.recipient_addr1   ?? '',
            receiveaddr2:   order.recipient_addr2   ?? '',
            receiveaddr3:   order.recipient_addr3   ?? '',
            receivetelno:   order.recipient_phone   ?? '',
            receivemail:    order.recipient_email   ?? '',
            EM_gubun:   items.map(() => 'Merchandise').join(';'),
            contents:   items.map((it) => it.name_en).join(';'),
            number:     items.map((it) => it.quantity).join(';'),
            weight:     perWeights.join(';'),
            value:      items.map((it) => it.unit_price_usd).join(';'),
            hs_code:    items.map((it) => it.hs_code ?? '').join(';'),
            origin:     items.map((it) => it.origin_country ?? 'KR').join(';'),
            currunitcd: 'USD',
            orderno:    `IFT-${order.id}`,
            boyn:       'N',
          };

          const result = USE_MOCK ? mockApplyEms(emsParams) : await applyEms(emsParams);
          const emsFeeParsed = parseInt(result.prerecevprc, 10);

          // 주문 업데이트 (EMS 접수 완료)
          await supabase.from('orders').update({
            ems_regino:       result.regino,
            ems_receive_seq:  result.receiveseq,
            ems_req_no:       result.reqno,
            ems_fee:          emsFeeParsed,
            ems_premium_cd:   method.premiumcd,
            ems_applied_at:   new Date().toISOString(),
            intl_tracking_no: result.regino,
            status:           'CUSTOMS_FILING',
            updated_at:       new Date().toISOString(),
          }).eq('id', order.id);

          // shipping_box 운송장 업데이트
          if (boxes && boxes.length > 0) {
            await supabase.from('shipping_boxes').update({
              intl_tracking_no: result.regino,
              carrier: order.shipping_method === 'KPACKET' ? 'K_PACKET' : 'EMS',
              status: 'PACKED',
              updated_at: new Date().toISOString(),
            }).eq('order_id', order.id).eq('box_seq', 1);
          }

          // 연결된 parcel 상태 업데이트
          const { data: parcelLinks } = await supabase
            .from('order_parcels').select('parcel_id').eq('order_id', order.id);
          if (parcelLinks?.length) {
            await supabase.from('parcels').update({ status: 'SHIPPING' }).in('id', parcelLinks.map(p => p.parcel_id));
          }

          // 운송장 발급 알림
          await supabase.from('notifications').insert({
            customer_id: user.id,
            order_id: order.id,
            type: 'SHIPPED',
            title: 'EMS 접수 완료 ✈️',
            body: `등기번호 ${result.regino} · 예상요금 ${emsFeeParsed.toLocaleString()}원`,
            data: { order_id: order.id, regino: result.regino },
          });
        }
      } catch (emsErr: unknown) {
        // EMS 접수 실패는 결제 성공을 막지 않음 — 로그 후 관리자 수동 처리
        console.error('[PAYMENT] EMS auto-apply failed:', emsErr instanceof Error ? emsErr.message : emsErr);
        await supabase.from('notifications').insert({
          customer_id: user.id,
          order_id: order.id,
          type: 'PAYMENT',
          title: '결제 완료 (EMS 접수 수동 필요)',
          body: '결제는 완료되었습니다. EMS 접수를 관리자가 처리합니다.',
        });
      }
    }

    return NextResponse.json({ success: true, order_id: order.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[PAYMENT] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
