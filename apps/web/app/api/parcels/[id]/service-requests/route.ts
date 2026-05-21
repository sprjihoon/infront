import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

interface ServiceRequestItem {
  service_code: string;
  service_name: string;
  price: number;
  note?: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parcelId } = await params;
    const body = await req.json() as { services: ServiceRequestItem[]; note?: string };
    const { services, note } = body;

    if (!services || services.length === 0) {
      return NextResponse.json({ error: '서비스를 하나 이상 선택해주세요.' }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    // 본인 소포인지 확인
    const { data: parcel } = await supabase
      .from('parcels')
      .select('id, status')
      .eq('id', parcelId)
      .eq('customer_id', user.id)
      .maybeSingle();

    if (!parcel) {
      return NextResponse.json({ error: '소포를 찾을 수 없습니다.' }, { status: 404 });
    }

    // 이미 완료된 소포에는 서비스 신청 불가
    if (['SHIPPING', 'DONE'].includes(parcel.status)) {
      return NextResponse.json({ error: '이미 발송되었거나 완료된 소포입니다.' }, { status: 400 });
    }

    // 서비스 요청 일괄 등록
    const rows = services.map((s) => ({
      parcel_id: parcelId,
      customer_id: user.id,
      service_code: s.service_code,
      service_name: s.service_name,
      price: s.price ?? 0,
      note: s.note ?? note ?? null,
      status: 'REQUESTED',
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('parcel_service_requests')
      .insert(rows)
      .select();

    if (insertError) {
      console.error('[SERVICE-REQUEST] insert error:', insertError);
      return NextResponse.json({ error: '서비스 신청 저장에 실패했습니다.' }, { status: 500 });
    }

    // 알림 생성
    await supabase.from('notifications').insert({
      customer_id: user.id,
      parcel_id: parcelId,
      type: 'INBOUND',
      title: '부가서비스 신청 완료',
      body: `${services.map(s => s.service_name).join(', ')} 신청이 접수되었습니다.`,
    });

    return NextResponse.json({ success: true, count: inserted?.length ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[SERVICE-REQUEST] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: parcelId } = await params;

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

    const { data, error } = await supabase
      .from('parcel_service_requests')
      .select('*')
      .eq('parcel_id', parcelId)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ requests: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
