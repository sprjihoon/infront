import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { syncIntlTrackingBatch } from '@/lib/orders/intl-tracking-sync';

export const preferredRegion = 'icn1';

function createUserSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) =>
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          ),
      },
    },
  );
}

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    srk,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

/**
 * POST /api/orders/sync-intl-tracking
 * 본인 IN_TRANSIT 주문 행방 동기화 (선택: order_id 쿼리)
 */
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createUserSupabase(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const orderId = new URL(req.url).searchParams.get('order_id') ?? undefined;

  try {
    const admin = createAdminSupabase();
    const stats = await syncIntlTrackingBatch(admin, {
      customerId: user.id,
      orderId,
      limit: orderId ? 1 : 20,
    });
    return NextResponse.json({ ok: true, ...stats });
  } catch (e) {
    console.error('[orders/sync-intl-tracking]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'sync failed' },
      { status: 500 },
    );
  }
}
