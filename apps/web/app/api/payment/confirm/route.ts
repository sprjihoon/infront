import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * POST /api/payment/confirm
 * Toss Payments 결제 승인 처리
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

    // order_no로 order 찾기
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, customer_id, total_amount')
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

    // 알림
    await supabase.from('notifications').insert({
      customer_id: user.id,
      order_id: order.id,
      type: 'PAYMENT',
      title: '결제 완료',
      body: `${amount.toLocaleString()}원 결제가 완료되었습니다. 배송 준비를 시작합니다.`,
    });

    return NextResponse.json({ success: true, order_id: order.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[PAYMENT] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
