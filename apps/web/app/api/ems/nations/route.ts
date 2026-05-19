import { NextRequest, NextResponse } from 'next/server';
import { getAvailableNations } from '@/lib/ems/client';

/**
 * GET /api/ems/nations?premiumcd=31
 * 발송 가능한 국가 목록 조회
 * premiumcd: 31=EMS, 32=EMS프리미엄, 14=K-Packet
 */
export async function GET(req: NextRequest) {
  const premiumcd = req.nextUrl.searchParams.get('premiumcd') ?? '31';
  try {
    const nations = await getAvailableNations(premiumcd);
    return NextResponse.json(nations);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
