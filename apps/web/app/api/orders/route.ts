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
    }
  );
}

export interface CreateOrderBody {
  parcel_ids: string[];
  shipping_method: 'EMS' | 'EMS_PREMIUM' | 'KPACKET';
  packaging_options: {
    safe_pack: boolean;
    repack: boolean;
    consolidate: boolean;
    note?: string;
  };
  overseas_address: {
    country_code: string;
    name: string;
    phone?: string;
    overseas_addr1: string;
    overseas_addr2: string;
    overseas_addr3: string;
    overseas_zip?: string;
    email?: string;
  };
  item_list: Array<{
    name_en: string;
    quantity: number;
    unit_price_usd: number;
    hs_code?: string;
    origin_country?: string;
  }>;
  estimated_shipping_fee: number;
  packaging_fee: number;
}

/**
 * POST /api/orders
 * 해외배송 주문 생성
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabase(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await req.json() as CreateOrderBody;
    const {
      parcel_ids,
      shipping_method,
      packaging_options,
      overseas_address,
      item_list,
      estimated_shipping_fee,
      packaging_fee,
    } = body;

    // 필수 검증
    if (!parcel_ids?.length) {
      return NextResponse.json({ error: '물품을 1개 이상 선택해주세요.' }, { status: 400 });
    }
    if (!shipping_method) {
      return NextResponse.json({ error: '배송 방법을 선택해주세요.' }, { status: 400 });
    }
    if (!overseas_address?.name || !overseas_address?.overseas_addr3) {
      return NextResponse.json({ error: '해외 배송지를 입력해주세요.' }, { status: 400 });
    }
    if (!item_list?.length) {
      return NextResponse.json({ error: '인보이스 물품을 1개 이상 입력해주세요.' }, { status: 400 });
    }

    // 선택한 parcel들이 본인 것인지 검증
    const { data: parcels, error: parcelsErr } = await supabase
      .from('parcels')
      .select('id, status')
      .in('id', parcel_ids)
      .eq('customer_id', user.id);

    if (parcelsErr || !parcels || parcels.length !== parcel_ids.length) {
      return NextResponse.json({ error: '유효하지 않은 물품이 포함되어 있습니다.' }, { status: 400 });
    }

    // 주문번호 생성
    const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true });
    const seq = ((count ?? 0) + 1).toString().padStart(4, '0');
    const dateStr = new Date().toISOString().replace(/\D/g, '').substring(0, 8);
    const order_no = `SPB-ORD-${dateStr}-${seq}`;

    // 총 금액 계산
    const total_amount = (estimated_shipping_fee ?? 0) + (packaging_fee ?? 0);
    const customs_value = item_list.reduce(
      (sum, item) => sum + item.unit_price_usd * item.quantity,
      0
    );

    // packaging_type 결정
    let packaging_type = 'NONE';
    if (packaging_options.consolidate) packaging_type = 'COMBINED';
    else if (packaging_options.repack) packaging_type = 'REPACK';
    else if (packaging_options.safe_pack) packaging_type = 'SPECIAL';

    // 주문 생성
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        customer_id: user.id,
        order_no,
        status: 'DRAFT',
        shipping_method,
        packaging_type,
        packaging_fee: packaging_fee ?? 0,
        shipping_fee: estimated_shipping_fee ?? 0,
        total_amount,
        payment_status: 'UNPAID',
        recipient_name: overseas_address.name,
        recipient_phone: overseas_address.phone ?? null,
        recipient_address: [
          overseas_address.overseas_addr3,
          overseas_address.overseas_addr2,
          overseas_address.overseas_addr1,
        ].filter(Boolean).join(', '),
        recipient_country: overseas_address.country_code,
        customs_value,
        item_list,
      })
      .select()
      .single();

    if (orderErr || !order) {
      console.error('[ORDERS] order insert error:', orderErr);
      return NextResponse.json({ error: '주문 생성에 실패했습니다.' }, { status: 500 });
    }

    // order_parcels 연결
    const orderParcelsData = parcel_ids.map(pid => ({
      order_id: order.id,
      parcel_id: pid,
    }));
    const { error: opErr } = await supabase.from('order_parcels').insert(orderParcelsData);
    if (opErr) {
      console.error('[ORDERS] order_parcels insert error:', opErr);
    }

    // order_services 생성 (포장 옵션)
    const serviceEntries: Array<{ code: string; price: number }> = [];
    if (packaging_options.safe_pack) serviceEntries.push({ code: 'SAFE_PACK', price: 3000 });
    if (packaging_options.repack)    serviceEntries.push({ code: 'REPACK',    price: 2000 });
    if (packaging_options.consolidate) serviceEntries.push({ code: 'CONSOLIDATE', price: 2000 });

    if (serviceEntries.length > 0) {
      const { data: services } = await supabase
        .from('services')
        .select('id, code, price')
        .in('code', serviceEntries.map(s => s.code));

      if (services?.length) {
        const orderServicesData = services.map(svc => ({
          order_id: order.id,
          service_id: svc.id,
          quantity: 1,
          unit_price: svc.price,
          total_price: svc.price,
          requested_by: 'CUSTOMER',
          note: packaging_options.note ?? null,
        }));
        await supabase.from('order_services').insert(orderServicesData);
      }
    }

    // packaging_requests 생성 (창고 작업 지시)
    if (packaging_type !== 'NONE') {
      await supabase.from('packaging_requests').insert({
        order_id: order.id,
        type: packaging_type,
        instruction: packaging_options.note ?? null,
        status: 'PENDING',
      });
    }

    // 알림 생성
    await supabase.from('notifications').insert({
      customer_id: user.id,
      order_id: order.id,
      type: 'INBOUND',
      title: '해외배송 신청 완료',
      body: `주문번호 ${order_no}로 해외배송이 신청되었습니다. 물품 입고 후 견적을 안내해드립니다.`,
    });

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_no,
      total_amount,
      status: 'DRAFT',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[ORDERS] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/orders
 * 본인 주문 목록 조회
 */
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createSupabase(cookieStore);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);

    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id, order_no, status, shipping_method, packaging_type,
        packaging_fee, shipping_fee, total_amount, payment_status,
        recipient_name, recipient_country,
        customs_value, item_list, intl_tracking_no,
        created_at, updated_at,
        order_parcels (parcel_id),
        shipping_boxes (id, box_seq, intl_tracking_no, carrier, status, weight_kg)
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: orders ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
