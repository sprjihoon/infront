import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { syncIntlTrackingBatch } from '@/lib/orders/intl-tracking-sync';

export const preferredRegion = 'icn1';
export const maxDuration = 60;

function createAdminSupabase() {
  const srk = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!srk) throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.');
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    srk,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

/**
 * GET /api/cron/sync-intl-tracking
 * IN_TRANSIT / CUSTOMS_FILING 주문의 EMS 행방을 조회해 배달완료 시 DELIVERED 처리
 */
export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminSupabase();
    const limit = parseInt(new URL(req.url).searchParams.get('limit') ?? '50', 10);
    const stats = await syncIntlTrackingBatch(supabase, { limit });
    return NextResponse.json({ ok: true, ...stats });
  } catch (e) {
    console.error('[cron/sync-intl-tracking]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'sync failed' },
      { status: 500 },
    );
  }
}
