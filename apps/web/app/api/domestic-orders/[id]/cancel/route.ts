import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) return null;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    srk,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

function createUserSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );
}

/**
 * POST /api/domestic-orders/[id]/cancel
 * 국내 배송 신청 취소 + 연결된 소포 출고가능 상태로 원복
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const userSupa = createUserSupabase(cookieStore);

  const { data: { user } } = await userSupa.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });

  // 소유권 확인 (admin client로 조회 후 코드 레벨에서 검증)
  const { data: order, error: fetchErr } = await admin
    .from('domestic_orders')
    .select('id, status, customer_id, parcel_ids, epost_regi_no')
    .eq('id', id)
    .single();

  if (fetchErr || !order) {
    return NextResponse.json({ error: '국내 배송 신청을 찾을 수 없습니다.' }, { status: 404 });
  }

  if (String(order.customer_id) !== String(user.id)) {
    return NextResponse.json({ error: '본인 신청만 취소할 수 있습니다.' }, { status: 403 });
  }

  if (order.status === 'CANCELLED') {
    return NextResponse.json({ error: '이미 취소된 신청입니다.' }, { status: 409 });
  }

  // 우체국 접수된 경우 (BOOKED 이후) 취소 불가 안내
  // 실제 운용 시 필요하면 우체국 cancelOrder API 호출 추가
  if (order.status !== 'PENDING') {
    return NextResponse.json(
      { error: '우체국 접수 이후에는 고객센터를 통해 취소해주세요.', code: 'ALREADY_BOOKED' },
      { status: 409 },
    );
  }

  // 1. 국내 배송 신청 → CANCELLED
  const { error: cancelErr } = await admin
    .from('domestic_orders')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', id);

  if (cancelErr) {
    return NextResponse.json({ error: cancelErr.message }, { status: 500 });
  }

  // 2. 연결된 소포 → INBOUND + is_shippable = true (원복)
  const parcelIds: string[] = Array.isArray(order.parcel_ids) ? order.parcel_ids : [];
  if (parcelIds.length > 0) {
    await admin
      .from('parcels')
      .update({ status: 'INBOUND', is_shippable: true, updated_at: new Date().toISOString() })
      .in('id', parcelIds);
  }

  return NextResponse.json({ ok: true, restored_parcel_count: parcelIds.length });
}
