import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getResInfo } from '@/lib/epost/client';

export const preferredRegion = 'icn1';

export async function GET(
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

  const { data: parcel, error } = await supabase
    .from('parcels')
    .select('id, status, epost_order_no, pickup_requested_at, pickup_tracking_no, epost_req_no')
    .eq('id', id)
    .eq('customer_id', user.id)
    .single();

  if (error || !parcel) {
    return NextResponse.json({ error: '수거 건을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (!parcel.epost_order_no || !parcel.pickup_requested_at) {
    return NextResponse.json({ error: '수거 상태 조회에 필요한 정보가 없습니다.' }, { status: 400 });
  }

  // 테스트(Mock) 데이터는 실제 API 조회 불가
  if (parcel.epost_req_no?.startsWith('MOCK-')) {
    return NextResponse.json({
      is_test: true,
      treatStusCd: '00',
      treatStusNm: '신청접수(테스트)',
      parcel_status: parcel.status,
    });
  }

  const reqYmd = new Date(parcel.pickup_requested_at)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');

  try {
    const result = await getResInfo({
      reqType: '2',
      orderNo: parcel.epost_order_no,
      reqYmd,
    });

    // 집하완료(01) 이상이면 PICKED_UP으로 상태 업데이트
    if (
      parseInt(result.treatStusCd) >= 1 &&
      parcel.status === 'PENDING_PICKUP'
    ) {
      await supabase
        .from('parcels')
        .update({ status: 'PICKED_UP' })
        .eq('id', parcel.id);

      await supabase.from('notifications').insert({
        customer_id: user.id,
        parcel_id: parcel.id,
        type: 'INBOUND',
        title: '수거 완료',
        body: `운송장 ${parcel.pickup_tracking_no ?? parcel.epost_order_no} 물품이 수거되었습니다.`,
      });
    }

    return NextResponse.json({
      is_test: false,
      treatStusCd: result.treatStusCd,
      treatStusNm: result.treatStusNm,
      regiNo: result.regiNo,
      regiPoNm: result.regiPoNm,
      resDate: result.resDate,
      parcel_status: parseInt(result.treatStusCd) >= 1 ? 'PICKED_UP' : parcel.status,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[PICKUP STATUS]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
