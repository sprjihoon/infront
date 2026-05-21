import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cancelOrder } from '@/lib/epost/client';

export const preferredRegion = 'icn1';

/**
 * DELETE /api/pickup/[id]
 * 수거 신청 취소: 우체국 전산 취소 후 parcel 상태를 PRE_REGISTERED로 복원
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  // 본인 소포 확인
  const { data: parcel } = await supabase
    .from('parcels')
    .select('id, status, epost_req_no, epost_res_no, pickup_tracking_no, pickup_requested_at')
    .eq('id', id)
    .eq('customer_id', user.id)
    .maybeSingle();

  if (!parcel) return NextResponse.json({ error: '수거 건을 찾을 수 없습니다.' }, { status: 404 });

  if (parcel.status !== 'PENDING_PICKUP') {
    return NextResponse.json(
      { error: '수거 신청 완료 상태에서만 취소할 수 있습니다.' },
      { status: 400 }
    );
  }

  const isMock = !parcel.epost_req_no || parcel.epost_req_no.startsWith('MOCK-');
  const hasEpostEnv = !!process.env.EPOST_SECURITY_KEY && !!process.env.EPOST_CUSTOMER_ID;

  // 실제 우체국 API 취소 (Mock이 아니고 환경변수 있을 때만)
  if (!isMock && hasEpostEnv) {
    try {
      const reqYmd = parcel.pickup_requested_at
        ? new Date(parcel.pickup_requested_at).toISOString().slice(0, 10).replace(/-/g, '')
        : new Date().toISOString().slice(0, 10).replace(/-/g, '');

      await cancelOrder({
        custNo:  (process.env.EPOST_CUSTOMER_ID ?? '').trim(),
        apprNo:  (process.env.EPOST_APPROVAL_NO ?? '').trim(),
        reqType: '2',
        payType: '2',
        reqNo:   parcel.epost_req_no!,
        resNo:   parcel.epost_res_no ?? '',
        regiNo:  parcel.pickup_tracking_no ?? '',
        reqYmd,
        delYn:   'Y',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('[PICKUP CANCEL] 우체국 API 취소 실패:', message);
      // 우체국 API 실패해도 DB는 취소 처리 (이미 집하된 경우 등 예외 상황)
    }
  }

  // DB 상태 업데이트 (PICKUP_CANCELLED로 명시적 표기)
  const { error: updateError } = await supabase
    .from('parcels')
    .update({
      status:              'PICKUP_CANCELLED',
      pickup_tracking_no:  null,
      tracking_no:         null,
      courier:             null,
      tracking_carrier_id: null,
      tracking_status:     null,
      tracking_last_event: null,
      tracking_events:     null,
      tracking_synced_at:  null,
      epost_req_no:        null,
      epost_res_no:        null,
      epost_order_no:      null,
      epost_pickup_date:   null,
      epost_price:         null,
      pickup_requested_at: null,
    })
    .eq('id', id)
    .eq('customer_id', user.id);

  if (updateError) {
    return NextResponse.json({ error: '취소 처리에 실패했습니다.' }, { status: 500 });
  }

  // 알림
  await supabase.from('notifications').insert({
    customer_id: user.id,
    parcel_id:   id,
    type:        'INBOUND',
    title:       '수거 신청 취소',
    body:        '수거 신청이 취소되었습니다. 다시 수거 신청을 진행해주세요.',
  });

  return NextResponse.json({ ok: true });
}
