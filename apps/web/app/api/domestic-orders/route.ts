import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function createSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
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

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) return null;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    srk,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/**
 * GET /api/domestic-orders — 본인의 국내 배송 신청 목록
 */
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });

  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!customer) return NextResponse.json({ orders: [] });

  const { data: orders } = await admin
    .from('domestic_orders')
    .select('id, status, recipient_name, recipient_addr1, epost_regi_no, epost_price, items_desc, parcel_ids, created_at')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ orders: orders ?? [] });
}

/**
 * POST /api/domestic-orders — 국내 배송 신청 생성
 *
 * Body:
 *   recipient_name    string
 *   recipient_phone   string
 *   recipient_zip     string
 *   recipient_addr1   string
 *   recipient_addr2   string
 *   parcel_ids        string[]
 *   items_desc        string
 *   delivery_msg?     string
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createSupabase(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const admin = createAdminSupabase();
  if (!admin) return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });

  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!customer) return NextResponse.json({ error: '고객 정보를 찾을 수 없습니다.' }, { status: 404 });

  const body = await req.json() as {
    recipient_name: string;
    recipient_phone: string;
    recipient_zip: string;
    recipient_addr1: string;
    recipient_addr2?: string;
    parcel_ids: string[];
    items_desc?: string;
    delivery_msg?: string;
  };

  const { recipient_name, recipient_phone, recipient_zip, recipient_addr1, parcel_ids } = body;

  if (!recipient_name || !recipient_phone || !recipient_zip || !recipient_addr1) {
    return NextResponse.json({ error: '수령인 정보를 모두 입력해주세요.' }, { status: 400 });
  }
  if (!parcel_ids?.length) {
    return NextResponse.json({ error: '배송할 물품을 선택해주세요.' }, { status: 400 });
  }

  // 선택된 소포가 본인 소유이고 출고 가능한지 확인
  const { data: parcels } = await admin
    .from('parcels')
    .select('id, status, is_shippable, customer_id')
    .in('id', parcel_ids);

  for (const p of parcels ?? []) {
    if (String(p.customer_id) !== String(customer.id)) {
      return NextResponse.json({ error: '본인 소유의 물품만 선택할 수 있습니다.' }, { status: 403 });
    }
    if (p.status !== 'INBOUND' || !p.is_shippable) {
      return NextResponse.json(
        { error: '출고 가능 상태인 물품만 선택할 수 있습니다.' },
        { status: 400 },
      );
    }
  }

  const { data: inserted, error } = await admin
    .from('domestic_orders')
    .insert({
      customer_id:    customer.id,
      recipient_name,
      recipient_phone,
      recipient_zip,
      recipient_addr1,
      recipient_addr2: body.recipient_addr2 ?? '',
      parcel_ids,
      items_desc:     body.items_desc ?? '의류',
      delivery_msg:   body.delivery_msg ?? null,
      status:         'PENDING',
    })
    .select('id')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? '신청 생성 실패' }, { status: 500 });
  }

  // 선택된 소포 상태 → PACKING (출고 예약)
  await admin
    .from('parcels')
    .update({ status: 'PACKING', updated_at: new Date().toISOString() })
    .in('id', parcel_ids);

  return NextResponse.json({ ok: true, id: inserted.id });
}
